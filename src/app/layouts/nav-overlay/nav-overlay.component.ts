import { A11yModule } from '@angular/cdk/a11y';
import { isPlatformBrowser, NgClass } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
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

import type { NavModule } from '../nav/models/nav-module.interface';
import { NavSectionsComponent } from '../nav/nav-sections/nav-sections.component';
import { NavStateService } from '../nav/nav-state.service';
import { PrimaryTitleToolbarComponent } from '../primary-title-toolbar/primary-title-toolbar.component';

const NG_MODULES = [A11yModule, NgClass, RouterModule];
const LOCAL_COMPONENTS = [NavSectionsComponent, PrimaryTitleToolbarComponent];

type MobileView = 'modules' | 'sections';

/**
 * Mega-menu de navegación con dos surfaces:
 *
 * **Desktop (≥md):** panel flotante anclado al botón "Categorías" (ServiceNow /
 * SAP Fiori pattern). Columna 1 de L1 modules con hover preview, columna 2 con
 * el layout L2/L3 del módulo previsualizado (mega-menu multi-columna).
 *
 * **Mobile (<md):** pantalla completa, single-column con drill-in de 1 paso.
 * Patrón Notion / Linear / SAP Fiori / Shopify Admin mobile — probado para
 * árboles de navegación profundos con labels largos:
 *   - Vista `modules`: lista full-width de L1 modules, cada uno como fila
 *     táctil con chevron `›`. Tap → drill a `sections`.
 *   - Vista `sections`: header `‹ [Module Name]` con back. Contenido
 *     full-width: L2 como headers no interactivos + todas las L3 como
 *     routerLinks. Tap leaf → commit del módulo, navegar, cerrar.
 *
 * Rationale de NO usar 2 columnas en mobile: labels como "Canal de Denuncias",
 * "Contactabilidad Clientes", "Adm. Clientes" en viewport <430px condenan
 * ambas columnas al truncado. Single-col aprovecha los ~375px completos.
 * Tradeoff: pierdes visibilidad simultánea de L1 (requiere back para cambiar
 * módulo), pero sigues en 2 taps a destino.
 */
@Component({
  selector: 'app-nav-overlay',
  imports: [NG_MODULES, LOCAL_COMPONENTS],
  templateUrl: './nav-overlay.component.html',
  styleUrl: './nav-overlay.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(window:keydown.escape)': 'onEscape()',
    '(document:click)': 'onDocumentClick($event)',
  },
})
export class NavOverlayComponent {
  protected nav = inject(NavStateService);
  private injector = inject(Injector);
  private platformId = inject(PLATFORM_ID);

  /** Ref al botón "back" del drill en sections — para enfocar al drill-in. */
  private backButtonRef = viewChild<ElementRef<HTMLButtonElement>>('backBtn');

  /**
   * Element desde donde el usuario drilleó (el botón L1 de módulo). Lo
   * guardamos para restaurar el foco al hacer back. Sin esto, cerrar el drill
   * con teclado deja el foco flotante (el botón origen se re-monta pero el
   * browser no recuerda).
   */
  private drilledFromElement: HTMLElement | null = null;

  // ─── Desktop state (hover preview) ───────────────────────────────────────
  protected readonly selectedId = computed(
    () => this.nav.hoveredModuleId() ?? this.nav.activeModuleId(),
  );

  protected readonly selectedModule = computed<NavModule | undefined>(() => {
    const id = this.selectedId();
    return this.nav.modules.find((m) => m.id === id);
  });

  // ─── Mobile state ────────────────────────────────────────────────────────
  /** Vista activa del drill mobile. Arranca en 'modules', drill pone 'sections'. */
  protected readonly mobileView = signal<MobileView>('modules');

  /** Módulo sobre el que se drilleó (undefined mientras la vista es 'modules'). */
  protected readonly mobileDrilledModuleId = signal<string | null>(null);

  protected readonly mobileDrilledModule = computed<NavModule | undefined>(
    () =>
      this.nav.modules.find((m) => m.id === this.mobileDrilledModuleId()),
  );

  constructor() {
    // Reset del drill state cuando el overlay cierra — próxima apertura
    // siempre arranca en la lista de módulos. Sin esto, el usuario reabre
    // el menú y aparece dentro de un módulo random que visitó antes.
    effect(() => {
      const isOpen = this.nav.sidebarOpen();
      if (!isOpen) {
        untracked(() => {
          this.mobileView.set('modules');
          this.mobileDrilledModuleId.set(null);
        });
      }
    });
  }

  // ─── Desktop handlers ────────────────────────────────────────────────────
  preview(id: string): void {
    this.nav.hoveredModuleId.set(id);
  }

  onLeafClicked(): void {
    const hoveredId = this.nav.hoveredModuleId();
    if (hoveredId) this.nav.setActiveModule(hoveredId);
    this.close();
  }

  // ─── Mobile handlers ─────────────────────────────────────────────────────
  drillIntoModule(id: string): void {
    // Guardamos el element origen ANTES de cambiar de vista — el botón del
    // módulo está por desaparecer del DOM cuando mobileView conmute.
    if (isPlatformBrowser(this.platformId)) {
      const active = document.activeElement;
      this.drilledFromElement =
        active instanceof HTMLElement ? active : null;
    }
    this.mobileDrilledModuleId.set(id);
    this.mobileView.set('sections');
    // Tras el swap de vista, enfocamos el botón back — entry point natural
    // para keyboard-only users (Escape/Enter). Sin esto el foco queda en
    // <body> y Tab arranca desde cero.
    afterNextRender(
      () => {
        this.backButtonRef()?.nativeElement.focus();
      },
      { injector: this.injector },
    );
  }

  backToModules(): void {
    this.mobileView.set('modules');
    this.mobileDrilledModuleId.set(null);
    // Restauramos el foco al botón del módulo origen — preserva el ritmo
    // visual "estoy exactamente donde estaba antes de drillear" (patrón
    // iOS Settings, Android nested list).
    const origin = this.drilledFromElement;
    this.drilledFromElement = null;
    if (!origin) return;
    afterNextRender(
      () => {
        // El nodo puede haber sido re-creado por el render del @if — si
        // aún es conexión live del DOM, enfocar; si no, fallback neutro.
        if (origin.isConnected) origin.focus();
      },
      { injector: this.injector },
    );
  }

  onMobileLeafClicked(): void {
    const id = this.mobileDrilledModuleId();
    if (id) this.nav.setActiveModule(id);
    this.close();
  }

  /**
   * Transición al search overlay — delega el mutex a NavStateService. El
   * método `openSearch` del service cierra los otros 3 overlays (incluido el
   * propio nav) antes de abrir search; consumer solo expresa la intención.
   */
  openSearch(): void {
    this.nav.clearHoverImmediate();
    this.nav.openSearch();
  }

  // ─── Shared ──────────────────────────────────────────────────────────────
  close(): void {
    this.nav.clearHoverImmediate();
    this.nav.sidebarOpen.set(false);
  }

  /**
   * Escape desde la vista `sections` → back al listado de módulos (drill
   * gradual, pattern Gmail/Shopify); desde `modules` → cierra el overlay
   * completo. Evita que el usuario pierda el contexto con una sola pulsación.
   */
  onEscape(): void {
    if (!this.nav.sidebarOpen()) return;
    if (this.mobileView() === 'sections') {
      this.backToModules();
    } else {
      this.close();
    }
  }

  /**
   * Click-outside handler — relevante solo en desktop (el backdrop con mask
   * del mega-menu cubre el resto del viewport). En mobile el panel es
   * full-viewport desde `top-0` y no hay "fuera del panel" tocable, así que
   * este handler queda idle ahí.
   *
   * `[data-nav-panel]` marker está en ambos paneles (mobile + desktop) porque
   * coexisten en el DOM, aunque solo uno renderice vía `md:hidden` /
   * `hidden md:flex`. Un `viewChild` habría capturado solo uno y el click
   * sobre el otro contaría como "fuera" cerrando el overlay.
   *
   * `[data-nav-trigger]` se excluye porque tiene su propio (click) toggle —
   * sin este guard el click primero cerraría el overlay y el toggle lo
   * reabriría.
   */
  onDocumentClick(event: MouseEvent): void {
    if (!this.nav.sidebarOpen()) return;
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (target.closest('[data-nav-panel]')) return;
    if (target.closest('[data-nav-trigger]')) return;
    this.close();
  }
}
