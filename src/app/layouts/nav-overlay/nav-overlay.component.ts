import { NgClass } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  viewChild,
} from '@angular/core';

import type { NavModule } from '../nav/models/nav-module.interface';
import { NavSectionsComponent } from '../nav/nav-sections/nav-sections.component';
import { NavStateService } from '../nav/nav-state.service';

const NG_MODULES = [NgClass];
const LOCAL_COMPONENTS = [NavSectionsComponent];

/**
 * Left-anchored overlay mega-menu (ServiceNow / SAP Fiori pattern — variant
 * that keeps the top global chrome visible). Two columns:
 *   1. L1 modules (icon + label)
 *   2. L2/L3 of the previewed module (hover on L1) or active module (no hover)
 *
 * Positioned below the toolbar + breadcrumb bar via `top-28` (h-16 + h-12 = 7rem).
 * Click an L3 leaf → commit that module, navigate, close overlay.
 * ESC / backdrop click → close.
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
  private panelRef = viewChild<ElementRef<HTMLElement>>('panelEl');

  protected readonly selectedId = computed(
    () => this.nav.hoveredModuleId() ?? this.nav.activeModuleId(),
  );

  protected readonly selectedModule = computed<NavModule | undefined>(() => {
    const id = this.selectedId();
    return this.nav.modules.find((m) => m.id === id);
  });

  /**
   * Mega-menu column count: se reparte L2/L3 en varias columnas cuando hay
   * muchas secciones (patrón Lider / Santa Isabel / Google Cloud mega-menu).
   * Umbrales conservadores — 1-5 secciones entran cómodas en una sola
   * columna; pasa a 2 en 6-10; 3 si excede. Scroll vertical como último
   * recurso cuando ni 3 columnas caben.
   */
  protected readonly columnCount = computed<number>(() => {
    const len = this.selectedModule()?.sections.length ?? 0;
    if (len <= 3) return 1;
    if (len <= 8) return 2;
    return 3;
  });

  preview(id: string): void {
    this.nav.hoveredModuleId.set(id);
  }

  onLeafClicked(): void {
    const hoveredId = this.nav.hoveredModuleId();
    if (hoveredId) this.nav.setActiveModule(hoveredId);
    this.close();
  }

  close(): void {
    this.nav.clearHoverImmediate();
    this.nav.sidebarOpen.set(false);
  }

  onEscape(): void {
    if (this.nav.sidebarOpen()) this.close();
  }

  /**
   * Click-outside handler. El backdrop nativo solo cubre desde top-16 hacia
   * abajo (para no tapar el toolbar), así que los clicks en el toolbar no lo
   * activan. Este listener global cierra el overlay cuando el target está
   * fuera del panel Y fuera del trigger (el botón "Categorías" tiene su
   * propio (click) que hace toggle — no queremos que el click ahí cierre y
   * luego el toggle re-abra).
   */
  onDocumentClick(event: MouseEvent): void {
    if (!this.nav.sidebarOpen()) return;
    const target = event.target as HTMLElement | null;
    if (!target) return;
    const panel = this.panelRef()?.nativeElement;
    if (panel && panel.contains(target)) return;
    if (target.closest('[data-nav-trigger]')) return;
    this.close();
  }
}
