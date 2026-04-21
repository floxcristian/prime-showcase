import { NgClass } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { RouterModule } from '@angular/router';

import type { NavModule } from '../nav/models/nav-module.interface';
import { NavSectionsComponent } from '../nav/nav-sections/nav-sections.component';
import { NavStateService } from '../nav/nav-state.service';

const NG_MODULES = [NgClass, RouterModule];
const LOCAL_COMPONENTS = [NavSectionsComponent];

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
    this.mobileDrilledModuleId.set(id);
    this.mobileView.set('sections');
  }

  backToModules(): void {
    this.mobileView.set('modules');
    this.mobileDrilledModuleId.set(null);
  }

  onMobileLeafClicked(): void {
    const id = this.mobileDrilledModuleId();
    if (id) this.nav.setActiveModule(id);
    this.close();
  }

  // ─── Shared ──────────────────────────────────────────────────────────────
  close(): void {
    this.nav.clearHoverImmediate();
    this.nav.sidebarOpen.set(false);
  }

  onEscape(): void {
    if (this.nav.sidebarOpen()) this.close();
  }

  /**
   * Click-outside handler — solo relevante en desktop (el backdrop con mask
   * cubre el viewport debajo del toolbar). En mobile el panel es full-screen
   * y no hay "fuera del panel" visible, así que este handler es idle.
   *
   * Usa `[data-nav-panel]` como marker en ambos paneles (mobile y desktop)
   * porque un `viewChild('panelEl')` solo habría capturado uno — al estar
   * los dos siempre en el DOM (ocultos con `hidden`/`md:hidden`), el click
   * en el panel mobile contaría como "fuera" del ref desktop y cerraría.
   *
   * El trigger (`[data-nav-trigger]`) es excluido porque tiene su propio
   * (click) que hace toggle — sin este guard, el click primero cerraría el
   * overlay y luego el toggle lo reabriría.
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
