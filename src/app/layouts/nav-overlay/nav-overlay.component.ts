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
  untracked,
  viewChild,
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
 * id del panel del overlay para conectar aria-controls desde el trigger.
 * Expuesto como constante para que el toolbar lo referencie sin hardcodear
 * el string en dos sitios.
 */
export const NAV_OVERLAY_PANEL_ID = 'nav-overlay-panel';

/**
 * Offset horizontal (px) desde `triggerLeft()` al centro visual del icono
 * hamburger, usado para anclar la flecha del mega-menu. Derivado del layout
 * del botón trigger en toolbar.component.html:
 *   px-3 (12px padding-left) + w-4/2 (8px medio-icono) + ajuste de 2px.
 * Si el trigger cambia (padding, icon size), actualizar acá.
 */
const ARROW_X_OFFSET_FROM_TRIGGER = 22;

/**
 * Mega-menu de navegación. Dos surfaces:
 *
 * **Desktop (lg+):** disclosure pattern APG — panel flotante anclado al
 * trigger con L1 modules + L2 sections + L3 leaves. Hover/focus en L1
 * previsualiza su contenido en L2 (JS-driven porque el preview depende de
 * state compartido, no de :hover local).
 *
 * **Mobile (<lg):** pantalla completa, single-column con drill-in de 1 paso.
 * Patrón Notion / Linear / Shopify Admin mobile.
 *
 * ARIA: el trigger tiene `aria-haspopup="true"` + `aria-expanded` +
 * `aria-controls` apuntando al panel. Cada botón L1 desktop también declara
 * `aria-expanded` (true si es el previsualizado) + `aria-controls` al
 * `<section>` L2. El wrapper NO es `role="dialog"` ni lleva `aria-modal`
 * porque un mega-menu dismissable por click-fuera NO es modal (el foco no
 * queda atrapado en cierre por pointer). Usar disclosure es lo correcto per
 * ARIA Authoring Practices Guide §Disclosure.
 *
 * Keyboard (desktop):
 *   - Tab / Shift+Tab: recorre trigger → L1 buttons → L2/L3 items.
 *   - ArrowDown/ArrowUp dentro de L1: movimiento entre módulos (preview
 *     sigue el foco para parity con mouse hover).
 *   - Home / End dentro de L1: primer / último módulo.
 *   - ArrowRight / Enter en L1: commit del módulo + foco al primer L3 leaf
 *     de la sección previsualizada.
 *   - Escape (desde cualquier lugar del overlay): cierra el overlay y
 *     devuelve foco al trigger.
 *
 * State ownership: `hoveredModuleId` vive LOCAL acá (no en NavStateService)
 * porque es transient al lifetime del overlay — al cerrar/reabrir debe
 * resetearse. Signal global introducía leaks de estado entre aperturas.
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
  protected readonly arrowXOffset = ARROW_X_OFFSET_FROM_TRIGGER;

  /** Ref al botón "back" del drill mobile — se enfoca al drill-in. */
  private backButtonRef = viewChild<ElementRef<HTMLButtonElement>>('backBtn');
  /** Ref al contenedor scrollable de L1 desktop — entry point de keyboard nav. */
  private l1ListRef = viewChild<ElementRef<HTMLDivElement>>('l1List');
  /** Ref a la sección L2 desktop — target para focus tras Enter/ArrowRight en L1. */
  private l2SectionRef = viewChild<ElementRef<HTMLElement>>('l2Section');

  /**
   * Element desde donde el usuario drilleó mobile (el botón L1 de módulo).
   * Se restaura su foco al hacer back. Sin esto, cerrar el drill con teclado
   * deja el foco flotante.
   */
  private drilledFromElement: HTMLElement | null = null;

  /**
   * Element que tenía foco ANTES de abrir el overlay — tipicamente el
   * trigger del toolbar. Se restaura al cerrar para cumplir con el patrón
   * APG disclosure "return focus to invoking element".
   */
  private invokingElement: HTMLElement | null = null;

  // ─── Desktop state (hover/focus preview) ─────────────────────────────────
  /**
   * Módulo actualmente en modo "preview" por hover o focus del teclado en
   * desktop. null cuando nadie está hovereado. Este estado es transient al
   * lifetime del overlay — se resetea automáticamente al cerrar vía effect.
   */
  protected readonly hoveredModuleId = signal<string | null>(null);

  /**
   * Id del módulo cuyo contenido L2 renderizar. Si hay hover/focus activo,
   * ese gana; si no, el módulo committeado (activo).
   */
  protected readonly selectedId = computed(
    () => this.hoveredModuleId() ?? this.nav.activeModuleId(),
  );

  protected readonly selectedModule = computed<NavModule | undefined>(() => {
    const id = this.selectedId();
    return this.nav.modules.find((m) => m.id === id);
  });

  // ─── Mobile state ────────────────────────────────────────────────────────
  /** Vista activa del drill mobile. Arranca en 'modules', drill pone 'sections'. */
  protected readonly mobileView = signal<MobileView>('modules');

  /** Módulo sobre el que se drilleó (null mientras la vista es 'modules'). */
  protected readonly mobileDrilledModuleId = signal<string | null>(null);

  protected readonly mobileDrilledModule = computed<NavModule | undefined>(
    () =>
      this.nav.modules.find((m) => m.id === this.mobileDrilledModuleId()),
  );

  // ─── Document click (click-outside) — bound only when open ───────────────
  private documentClickTeardown: (() => void) | null = null;

  constructor() {
    // Reset del drill mobile + preview desktop cuando el overlay cierra.
    // Single source of truth: el signal `sidebarOpen` domina, toda cleanup
    // se deriva de su cambio a false. Así cualquier camino de cierre
    // (Escape, click-out, tap del back, navegación, mutex override) limpia
    // consistentemente sin handlers ad-hoc en cada caller.
    effect(() => {
      const isOpen = this.nav.sidebarOpen();
      if (!isOpen) {
        untracked(() => {
          this.mobileView.set('modules');
          this.mobileDrilledModuleId.set(null);
          this.hoveredModuleId.set(null);
          this.drilledFromElement = null;
          // Restaurar foco al trigger tras cerrar — APG disclosure pattern.
          // afterNextRender porque el @if del template aún no removió el DOM
          // en este frame; posponer al siguiente frame evita race con el
          // router change detection.
          const invoking = this.invokingElement;
          this.invokingElement = null;
          if (invoking?.isConnected) {
            afterNextRender(() => invoking.focus(), { injector: this.injector });
          }
        });
      } else if (isPlatformBrowser(this.platformId)) {
        untracked(() => {
          // Capturar el elemento invocador (foco actual) al abrir, para
          // poder restaurar al cerrar.
          const active = document.activeElement;
          this.invokingElement =
            active instanceof HTMLElement ? active : null;
        });
      }
    });

    // click-outside listener — bound dinámicamente al open, teardown al
    // close. Evita pagar el costo del listener en todo click del app
    // cuando el overlay no está abierto. Pattern Radix/Headless UI.
    if (isPlatformBrowser(this.platformId)) {
      effect(() => {
        const isOpen = this.nav.sidebarOpen();
        if (isOpen) {
          const handler = (event: MouseEvent) => this.onDocumentClick(event);
          document.addEventListener('click', handler, { capture: false });
          this.documentClickTeardown = () => {
            document.removeEventListener('click', handler);
          };
        } else if (this.documentClickTeardown) {
          this.documentClickTeardown();
          this.documentClickTeardown = null;
        }
      });

      this.destroyRef.onDestroy(() => {
        if (this.documentClickTeardown) {
          this.documentClickTeardown();
          this.documentClickTeardown = null;
        }
      });
    }
  }

  // ─── Desktop handlers ────────────────────────────────────────────────────
  /**
   * Activa preview del módulo por hover/focus. Sticky hasta que el usuario
   * hoveree otro módulo, cierre el overlay, o navegue. No hay `clearPreview`
   * dispatch-eado por `mouseleave` — un leave del `<nav>` L1 al cruzar a L2
   * haría zumbar el preview al active y tiraría abajo la sección que el
   * usuario está por seleccionar. El auto-cleanup vive en el effect que
   * observa `sidebarOpen()`.
   */
  protected preview(id: string): void {
    this.hoveredModuleId.set(id);
  }

  /** Click/Enter en L1 desktop — commit del módulo y cierre del overlay. */
  protected selectModule(id: string): void {
    this.nav.setActiveModule(id);
    this.close();
  }

  protected onLeafClicked(): void {
    const hoveredId = this.hoveredModuleId();
    if (hoveredId) this.nav.setActiveModule(hoveredId);
    this.close();
  }

  // ─── Keyboard navigation (desktop L1) ────────────────────────────────────
  /**
   * Handler de keydown en el wrapper de L1 desktop. Implementa el patrón
   * APG Disclosure Navigation Menu:
   *   ArrowDown: mover al siguiente módulo (wrap al inicio al final)
   *   ArrowUp: mover al anterior (wrap al final al inicio)
   *   Home: primer módulo
   *   End: último módulo
   *   ArrowRight / Enter: commit módulo y mover foco al primer L3 leaf
   *   ArrowLeft: si foco viene de L2/L3, volver a L1 (handled en L2)
   *
   * La relación foco ↔ preview se mantiene: mover foco a un módulo
   * actualiza hoveredModuleId (igual que un mouse hover). Keyboard users
   * ven el mismo preview que mouse users.
   */
  protected onL1Keydown(event: KeyboardEvent): void {
    const list = this.l1ListRef()?.nativeElement;
    if (!list) return;
    const buttons = Array.from(
      list.querySelectorAll<HTMLButtonElement>('button[data-l1-item]'),
    );
    if (buttons.length === 0) return;
    const currentIdx = buttons.indexOf(
      document.activeElement as HTMLButtonElement,
    );

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
      case 'ArrowRight': {
        // Mover al primer L3 leaf de la sección preview. Enter también lo
        // hace pero Enter es el commit primario; ArrowRight es el "peek
        // into".
        event.preventDefault();
        const firstLeaf = this.l2SectionRef()
          ?.nativeElement.querySelector<HTMLAnchorElement>('a[href]');
        firstLeaf?.focus();
        break;
      }
    }
  }

  /**
   * Invocado desde `<app-nav-sections>` cuando el usuario presiona ArrowLeft
   * en un L3 leaf. Devuelve el foco al botón L1 correspondiente al módulo
   * actualmente previsualizado — mantiene la "posición" mental del usuario
   * en la navegación bidireccional L1↔L3.
   */
  protected focusPreviewedL1(): void {
    const id = this.selectedId();
    const btn = this.l1ListRef()?.nativeElement.querySelector<HTMLButtonElement>(
      `button[data-l1-item][aria-expanded="true"]`,
    );
    if (btn) {
      btn.focus();
      return;
    }
    // Fallback: si ninguno marca aria-expanded="true" (debería match al
    // selectedId), buscar el que corresponde al módulo activo.
    const buttons = Array.from(
      this.l1ListRef()?.nativeElement.querySelectorAll<HTMLButtonElement>(
        'button[data-l1-item]',
      ) ?? [],
    );
    const target = buttons.find(
      (b, i) => this.nav.modules[i]?.id === id,
    );
    target?.focus();
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
    afterNextRender(
      () => {
        if (origin.isConnected) origin.focus();
      },
      { injector: this.injector },
    );
  }

  protected onMobileLeafClicked(): void {
    const id = this.mobileDrilledModuleId();
    if (id) this.nav.setActiveModule(id);
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
   * Escape desde la vista `sections` → back al listado de módulos (drill
   * gradual, pattern Gmail/Shopify); desde `modules` → cierra el overlay
   * completo. Evita que el usuario pierda el contexto con una sola pulsación.
   */
  protected onEscape(): void {
    if (!this.nav.sidebarOpen()) return;
    if (this.mobileView() === 'sections') {
      this.backToModules();
    } else {
      this.close();
    }
  }

  /**
   * Click-outside handler — registrado dinámicamente al abrir (ver effect
   * en constructor). Cierra si el click cae fuera del panel/trigger.
   *
   * `[data-nav-panel]` marker está en ambos paneles (mobile/tablet + desktop)
   * porque coexisten en el DOM aunque solo uno renderice vía `lg:hidden` /
   * `hidden lg:flex`. Un viewChild capturaría solo uno y el click sobre el
   * otro contaría como "fuera" cerrando el overlay.
   *
   * `[data-nav-trigger]` se excluye porque tiene su propio (click) toggle —
   * sin este guard el click primero cerraría el overlay y el toggle lo
   * reabriría.
   */
  private onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (target.closest('[data-nav-panel]')) return;
    if (target.closest('[data-nav-trigger]')) return;
    this.close();
  }
}
