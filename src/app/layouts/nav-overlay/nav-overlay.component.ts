import { isPlatformBrowser, NgClass } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  PLATFORM_ID,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { RouterModule } from '@angular/router';

import { BackButtonComponent } from '../../shared/back-button/back-button.component';
import type { NavModule } from '../nav/models/nav-module.interface';
import { NavSectionsComponent } from '../nav/nav-sections/nav-sections.component';
import { NavStateService } from '../nav/nav-state.service';
import { PrimaryTitleToolbarComponent } from '../primary-title-toolbar/primary-title-toolbar.component';

const NG_MODULES = [NgClass, RouterModule];
const LOCAL_COMPONENTS = [
  BackButtonComponent,
  NavSectionsComponent,
  PrimaryTitleToolbarComponent,
];

type MobileView = 'modules' | 'sections';

/**
 * Razón por la que el overlay se cerró — determina si restaurar foco al
 * trigger. `leaf`/`module-click`/`navigation` implican que el usuario activó
 * una ruta nueva; devolver foco al trigger pisaría el destino que el browser
 * le asigna a la página nueva (WCAG 2.4.3 Focus Order). Solo restaurar en
 * cierres "meramente de overlay" (Escape, backdrop click, mutex).
 */
type CloseReason = 'dismiss' | 'navigation';

/** id del panel — referenciado por `aria-controls` del trigger del toolbar. */
export const NAV_OVERLAY_PANEL_ID = 'nav-overlay-panel';

/**
 * Delay (ms) antes de activar preview desde estado sin hover. Evita que un
 * cursor en tránsito diagonal (L1 → L2) gatille previews flickering en
 * módulos que el usuario solo pasa por arriba. Switch inter-módulo es
 * instantáneo (si ya hay un preview activo). Valores alineados con MS
 * Fluent / APG hover-intent: 150ms open idle, 0ms switch, sin close delay
 * porque el preview es sticky hasta commit o cierre.
 */
const HOVER_OPEN_DELAY_MS = 150;

/**
 * Mega-menu de navegación (disclosure pattern per APG §Disclosure Nav Menu).
 *
 * ### Arquitectura del estado
 * - `hoveredModuleId` vive LOCAL (no en NavStateService) — es transient al
 *   lifetime del overlay; al cerrar/reabrir debe resetearse. Audit anterior
 *   lo tenía en singleton lo que permitía leaks cross-apertura.
 * - `focusRestoreToken` — secuencia monotónica que invalida restores
 *   pendientes si open/close rápidos se encadenan (race protection).
 * - `l1Buttons` via `viewChildren()` signal — array de refs siempre up-to-
 *   date con el template. Reemplaza `querySelectorAll` per-keystroke.
 *
 * ### Lifecycle (single effect sobre `sidebarOpen`)
 * - open: captura invokingElement, resetea closeReason, auto-focus al botón
 *   L1 del módulo activo (keyboard parity), registra document click-outside.
 * - close: teardown click-outside, limpia transient state, restaura foco al
 *   trigger SOLO si cierre fue `dismiss` (no `navigation`).
 *
 * ### Keyboard (desktop L1)
 *   ArrowDown/ArrowUp: mover entre módulos con wrap (APG disclosure).
 *   Home/End: primer/último.
 *   ArrowRight/Enter: pin preview + foco al primer L3 leaf.
 *   (Click L1 = mismo comportamiento que Enter — no commit+close.)
 *
 * ### Keyboard (desktop L3)
 *   ArrowUp/ArrowDown/Home/End: cicla entre leaves (en NavSectionsComponent).
 *   ArrowLeft: emite `requestReturnToL1` → focusPreviewedL1() acá.
 *   Enter: default del `<a>` — navega por routerLink.
 *   Escape: global — cierra overlay.
 *
 * ### L2 scroll memory
 * Cuando el preview cambia, el `<app-nav-sections>` se remonta. Antes el
 * scroll de L2 se reseteaba a 0 en cada switch. Ahora persistimos scrollTop
 * por moduleId en `l2ScrollByModule` y restauramos vía afterNextRender
 * al siguiente switch.
 */
@Component({
  selector: 'app-nav-overlay',
  imports: [NG_MODULES, LOCAL_COMPONENTS],
  templateUrl: './nav-overlay.component.html',
  styleUrl: './nav-overlay.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(window:keydown.escape)': 'onEscape()',
  },
})
export class NavOverlayComponent {
  protected nav = inject(NavStateService);
  private injector = inject(Injector);
  private destroyRef = inject(DestroyRef);
  private platformId = inject(PLATFORM_ID);

  protected readonly panelId = NAV_OVERLAY_PANEL_ID;
  protected readonly l2SectionId = `${NAV_OVERLAY_PANEL_ID}-l2`;

  // ─── Template refs ───────────────────────────────────────────────────────
  /** Botones L1 desktop — refs signal, reemplaza querySelectorAll. */
  private l1Buttons = viewChildren<ElementRef<HTMLButtonElement>>('l1Item');
  /** Section L2 desktop — target para ArrowRight focus. */
  private l2SectionRef = viewChild<ElementRef<HTMLElement>>('l2Section');
  /** Botón back mobile drill — focus post-drill. */
  private backButtonRef = viewChild<ElementRef<HTMLButtonElement>>('backBtn');

  // ─── Desktop state ───────────────────────────────────────────────────────
  protected readonly hoveredModuleId = signal<string | null>(null);

  protected readonly selectedId = computed(
    () => this.hoveredModuleId() ?? this.nav.activeModuleId(),
  );

  protected readonly selectedModule = computed<NavModule | undefined>(() => {
    const id = this.selectedId();
    return this.nav.modules.find((m) => m.id === id);
  });

  // ─── Mobile state ────────────────────────────────────────────────────────
  protected readonly mobileView = signal<MobileView>('modules');
  protected readonly mobileDrilledModuleId = signal<string | null>(null);
  protected readonly mobileDrilledModule = computed<NavModule | undefined>(
    () => this.nav.modules.find((m) => m.id === this.mobileDrilledModuleId()),
  );

  // ─── Transient imperative state ──────────────────────────────────────────
  /** Element del trigger al abrir — se restaura al cerrar (APG pattern). */
  private invokingElement: HTMLElement | null = null;
  /** Origen del drill mobile — restaurar al hacer back. */
  private drilledFromElement: HTMLElement | null = null;
  /** Por qué cerró — decide si restaurar foco o ceder al browser (navegación). */
  private closeReason: CloseReason = 'dismiss';
  /** Timer del hover-intent open delay. */
  private hoverTimer: ReturnType<typeof setTimeout> | null = null;
  /** Teardown del document click-outside listener. */
  private documentClickTeardown: (() => void) | null = null;
  /**
   * Sequence token — incrementa en cada open/close. Los callbacks de
   * `afterNextRender` capturan el token al agendarse; si cuando corren el
   * token ya no matchea, abortan. Protege contra race rapid open→close→open.
   */
  private focusRestoreToken = 0;
  /** scrollTop de L2 persistido por moduleId. */
  private readonly l2ScrollByModule = new Map<string, number>();

  constructor() {
    // ── Single effect sobre sidebarOpen ──────────────────────────────────
    // Consolidado de 2 effects anteriores — garantiza orden determinístico
    // entre open/close branches y elimina race con document-click listener.
    effect(() => {
      const isOpen = this.nav.sidebarOpen();
      const token = ++this.focusRestoreToken;

      if (isOpen) {
        this.onOpen(token);
      } else {
        this.onClose(token);
      }
    });

    this.destroyRef.onDestroy(() => {
      this.clearHoverTimer();
      if (this.documentClickTeardown) {
        this.documentClickTeardown();
        this.documentClickTeardown = null;
      }
    });
  }

  // ─── Lifecycle handlers ──────────────────────────────────────────────────
  private onOpen(token: number): void {
    if (!isPlatformBrowser(this.platformId)) return;

    // Capturar invokingElement para restore al cerrar.
    const active = document.activeElement;
    this.invokingElement = active instanceof HTMLElement ? active : null;

    // Reset closeReason al abrir — defaults a 'dismiss' salvo que un path
    // (leaf click, module commit) lo cambie a 'navigation' antes del close.
    this.closeReason = 'dismiss';

    // Click-outside: registrar listener ahora, teardown al cerrar.
    // Deferido con queueMicrotask para evitar que el click que abrió el
    // overlay sea capturado por este mismo listener en bubble-up.
    queueMicrotask(() => {
      if (this.focusRestoreToken !== token) return;
      const handler = (event: MouseEvent) => this.onDocumentClick(event);
      document.addEventListener('click', handler, { capture: false });
      this.documentClickTeardown = () => {
        document.removeEventListener('click', handler);
      };
    });

    // Auto-focus keyboard parity — al abrir, el botón del módulo activo
    // recibe foco. Mouse users no notan (siguen pudiendo clickear). Keyboard
    // users arrancan en el lugar correcto sin un Tab extra.
    // `autoFocusInProgress` previene que el `(focus)` handler dispare
    // `previewImmediate` y rompa la protección cold-open (ver flag doc).
    afterNextRender(
      () => {
        if (this.focusRestoreToken !== token) return;
        const activeId = this.nav.activeModuleId();
        const btn = this.l1Buttons().find(
          (ref) => ref.nativeElement.dataset['l1Id'] === activeId,
        );
        // Fallback: si no encontró el activo (ej. data-race), enfocar el
        // primer L1 disponible para no dejar el foco flotante.
        const target = btn ?? this.l1Buttons()[0];
        this.autoFocusInProgress = true;
        target?.nativeElement.focus({ preventScroll: true });
        this.autoFocusInProgress = false;
      },
      { injector: this.injector },
    );
  }

  private onClose(token: number): void {
    // Teardown listeners / timers primero — cleanup defensivo.
    this.clearHoverTimer();
    if (this.documentClickTeardown) {
      this.documentClickTeardown();
      this.documentClickTeardown = null;
    }

    // Reset transient state (orden: preview ANTES de activeModuleId clear
    // reduce CD a un solo frame — si hoveredModuleId quedara seteado al
    // cambiar activeModuleId, selectedId recomputaría 2 veces).
    this.hoveredModuleId.set(null);
    this.mobileView.set('modules');
    this.mobileDrilledModuleId.set(null);
    this.drilledFromElement = null;

    // Restaurar foco al invokingElement SOLO si el cierre fue dismiss
    // (Escape, backdrop, mutex). Si fue navigation (leaf click, module
    // commit), el browser está por asignar foco al destino — no pisar.
    const reason = this.closeReason;
    const invoking = this.invokingElement;
    this.invokingElement = null;

    if (!isPlatformBrowser(this.platformId)) return;
    if (reason !== 'dismiss') return;
    if (!invoking?.isConnected) return;
    // Si el trigger quedó display:none (ej. viewport cambió a mobile), no
    // intentar focusearlo — .focus() silencioso no hace nada pero es
    // misleading; fallback a body evita focus floating.
    if (invoking instanceof HTMLElement && invoking.offsetParent === null) {
      return;
    }

    afterNextRender(
      () => {
        if (this.focusRestoreToken !== token) return;
        if (!invoking.isConnected) return;
        if (invoking.offsetParent === null) return;
        invoking.focus();
      },
      { injector: this.injector },
    );
  }

  // ─── Desktop handlers ────────────────────────────────────────────────────
  /**
   * Activa preview del módulo por hover/focus. Hover-intent: si no hay
   * preview activo, delay 150ms para evitar flickering durante cursor en
   * tránsito. Con preview activo, switch es instantáneo.
   */
  protected preview(id: string): void {
    const current = this.hoveredModuleId();
    if (current === id) return;
    this.clearHoverTimer();

    const isColdOpen =
      current === null && this.nav.activeModuleId() !== id;
    if (isColdOpen) {
      this.hoverTimer = setTimeout(() => {
        this.hoveredModuleId.set(id);
        this.hoverTimer = null;
      }, HOVER_OPEN_DELAY_MS);
    } else {
      this.hoveredModuleId.set(id);
    }
  }

  /**
   * Cancela delay pendiente. Llamado por `(focus)` del botón — los users
   * keyboard no quieren delay; el foco en un item es señal explícita. Si el
   * foco viene del auto-focus inicial del overlay (abrir), el flag
   * `autoFocusInProgress` suprime la activación para preservar el estado
   * cold-open (null) que habilita la protección de flicker en el primer
   * hover real del usuario.
   */
  protected previewImmediate(id: string): void {
    if (this.autoFocusInProgress) return;
    this.clearHoverTimer();
    this.hoveredModuleId.set(id);
  }

  private clearHoverTimer(): void {
    if (this.hoverTimer !== null) {
      clearTimeout(this.hoverTimer);
      this.hoverTimer = null;
    }
  }

  /**
   * Click o Enter sobre L1 — "pin preview + go into": pin el módulo como
   * activo, mover foco al primer L3 leaf. NO cierra overlay (patrón
   * Windows 365 / Shopify Admin — click L1 no navega porque L1 no tiene
   * URL; el commit ocurre cuando el usuario elige un L3 leaf). Si el user
   * quiere cerrar sin navegar: Escape.
   *
   * `afterNextRender` es necesario: cambiar `hoveredModuleId` desencadena
   * re-render de la sección L2 con los nuevos leaves. Si el querySelector
   * corre síncronamente, encuentra los leaves ANTERIORES (DOM stale) que
   * están por desmontarse — focus en un nodo about-to-unmount termina en
   * body. afterNextRender espera a CD + DOM commit.
   *
   * Si el módulo no tiene leaves (data incompleta), `firstLeaf` será null
   * y el foco queda en el L1 button (no hay error silencioso — la sección
   * L2 vacía es el feedback visual).
   */
  protected activateModule(id: string): void {
    this.previewImmediate(id);
    afterNextRender(
      () => {
        const firstLeaf = this.l2SectionRef()
          ?.nativeElement.querySelector<HTMLAnchorElement>('a[href]');
        firstLeaf?.focus();
      },
      { injector: this.injector },
    );
  }

  /**
   * Click en L3 leaf — commit + close. El routerLink navegó; marcamos
   * `closeReason = 'navigation'` para que el onClose NO restaure foco al
   * trigger (el browser está por darle foco al destino).
   */
  protected onLeafClicked(): void {
    const hoveredId = this.hoveredModuleId();
    if (hoveredId) this.nav.setActiveModule(hoveredId);
    this.closeReason = 'navigation';
    this.close();
  }

  // ─── Keyboard nav L1 ─────────────────────────────────────────────────────
  protected onL1Keydown(event: KeyboardEvent): void {
    const buttons = this.l1Buttons().map((r) => r.nativeElement);
    if (buttons.length === 0) return;
    const active = document.activeElement as HTMLButtonElement | null;
    const currentIdx = active ? buttons.indexOf(active) : -1;

    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault();
        const next = currentIdx < 0 ? 0 : (currentIdx + 1) % buttons.length;
        buttons[next].focus();
        break;
      }
      case 'ArrowUp': {
        event.preventDefault();
        const prev =
          currentIdx < 0
            ? buttons.length - 1
            : (currentIdx - 1 + buttons.length) % buttons.length;
        buttons[prev].focus();
        break;
      }
      case 'Home': {
        event.preventDefault();
        buttons[0].focus();
        break;
      }
      case 'End': {
        event.preventDefault();
        buttons[buttons.length - 1].focus();
        break;
      }
      case 'ArrowRight':
      case 'Enter': {
        // ArrowRight y Enter: pin preview + foco al primer L3 leaf.
        event.preventDefault();
        const id = active?.dataset['l1Id'];
        if (id) this.activateModule(id);
        break;
      }
    }
  }

  /**
   * Invocado desde `<app-nav-sections>` cuando el usuario presiona
   * ArrowLeft en un L3 leaf. Devuelve foco al botón L1 correspondiente al
   * módulo en preview. Lookup via `data-l1-id` en los view children — ya
   * no depende de DOM order vs signal order.
   */
  protected focusPreviewedL1(): void {
    const id = this.selectedId();
    const btn = this.l1Buttons().find(
      (r) => r.nativeElement.dataset['l1Id'] === id,
    );
    btn?.nativeElement.focus();
  }

  /** scrollTop persistido del L2 para un moduleId (0 si no registrado). */
  protected l2ScrollForModule(id: string): number {
    return this.l2ScrollByModule.get(id) ?? 0;
  }

  /**
   * Flag de supresión del `(focus)` handler de L1 — activado durante el
   * auto-focus al abrir el overlay para que la llamada programática a
   * `.focus()` NO dispare `previewImmediate`. Sin esto, el auto-focus seteaba
   * `hoveredModuleId` instantly → la protección cold-open delay de 150ms
   * nunca se activaba (dead code). Con el flag: auto-focus enfoca visualmente
   * el active L1 sin setear preview; el próximo hover del usuario SÍ activa
   * la protección. Reset automático dentro del mismo task tras el focus()
   * call (que dispara el (focus) handler síncronamente).
   */
  private autoFocusInProgress = false;

  /** Callback emitido por `<app-nav-sections>` al scrollear. Persiste por id. */
  protected onL2ScrollChange(scrollTop: number): void {
    const id = this.selectedId();
    if (!id) return;
    this.l2ScrollByModule.set(id, scrollTop);
  }

  // ─── Mobile handlers ─────────────────────────────────────────────────────
  protected drillIntoModule(id: string): void {
    if (isPlatformBrowser(this.platformId)) {
      const active = document.activeElement;
      this.drilledFromElement =
        active instanceof HTMLElement ? active : null;
    }
    this.mobileDrilledModuleId.set(id);
    this.mobileView.set('sections');
    afterNextRender(
      () => this.backButtonRef()?.nativeElement.focus(),
      { injector: this.injector },
    );
  }

  protected backToModules(): void {
    this.mobileView.set('modules');
    this.mobileDrilledModuleId.set(null);
    const origin = this.drilledFromElement;
    this.drilledFromElement = null;
    if (!origin) return;
    // Token guard para race rapid back→close: si el overlay se cierra
    // antes que el render next-frame complete, no restaurar foco stale.
    const token = this.focusRestoreToken;
    afterNextRender(
      () => {
        if (this.focusRestoreToken !== token) return;
        if (!origin.isConnected) return;
        if (origin.offsetParent === null) return;
        origin.focus();
      },
      { injector: this.injector },
    );
  }

  protected onMobileLeafClicked(): void {
    const id = this.mobileDrilledModuleId();
    if (id) this.nav.setActiveModule(id);
    this.closeReason = 'navigation';
    this.close();
  }

  protected openSearch(): void {
    this.nav.openSearch();
  }

  // ─── Shared ──────────────────────────────────────────────────────────────
  protected close(): void {
    this.nav.close('nav');
  }

  /**
   * Escape:
   *   - mobile drill en 'sections' view (viewport <lg) → back al listado.
   *   - resto (incluyendo desktop viewport aunque mobileView sea stale
   *     'sections' por una rotación previa) → cierra overlay.
   * El cierre vía Escape es 'dismiss' (default), restaura foco al trigger.
   *
   * La verificación de viewport (`matchMedia('(max-width: 1023px)')`)
   * previene el bug de rotación: usuario abre en mobile → drill a sections
   * → rota a desktop → desktop panel renderiza pero `mobileView()` sigue
   * 'sections'. Sin la guardia, Escape haría `backToModules` (no-op visual
   * en desktop) en vez de cerrar. Con la guardia, Escape siempre cierra
   * cuando el viewport es desktop.
   */
  protected onEscape(): void {
    if (!this.nav.sidebarOpen()) return;
    const isMobileViewport =
      isPlatformBrowser(this.platformId) &&
      window.matchMedia('(max-width: 1023px)').matches;
    if (isMobileViewport && this.mobileView() === 'sections') {
      this.backToModules();
    } else {
      this.close();
    }
  }

  /**
   * Click-outside. Registrado dinámicamente al open (ver onOpen).
   * `[data-nav-panel]` marker está en ambos paneles (mobile/desktop) porque
   * coexisten en DOM aunque solo uno renderice por media query, y también
   * en la flecha (para que clickearla no cierre por accidente).
   */
  private onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (target.closest('[data-nav-panel]')) return;
    if (target.closest('[data-nav-trigger]')) return;
    this.close();
  }
}
