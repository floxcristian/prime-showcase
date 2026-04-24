import { A11yModule } from '@angular/cdk/a11y';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { RouterModule } from '@angular/router';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';

import { NavStateService } from '../nav/nav-state.service';

interface RecentSearch {
  id: string;
  query: string;
}

interface RecentView {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  url: string;
}

const NG_MODULES = [A11yModule, RouterModule];
const PRIME_MODULES = [IconField, InputIcon, InputTextModule];

/**
 * Full-screen search overlay para mobile. Triggereado por el search icon del
 * toolbar mobile (`nav.searchOverlayOpen()`). Patrón Google app / Gmail mobile /
 * Notion: overlay full-viewport con input sticky arriba y contenido debajo.
 *
 * Contenido:
 *   - **Búsquedas recientes** como chips (scanning rápido, toque directo para
 *     re-ejecutar una query). Cada chip con X para remover individual, y un
 *     "Limpiar" de la sección completa.
 *   - **Vistos recientemente** como lista con icono + title + subtitle. Para un
 *     ERP, "visto" = página/módulo/cliente visitado (no producto). Lista vs
 *     chips porque los títulos son más descriptivos y la jerarquía icon+sub
 *     pide más espacio.
 *
 * Out-of-scope (showcase): búsqueda real funcional. El input es solo placeholder
 * con autofocus — la submit action y el fetch quedan como extension point.
 */
@Component({
  selector: 'app-mobile-search-overlay',
  imports: [NG_MODULES, PRIME_MODULES],
  templateUrl: './mobile-search-overlay.component.html',
  styleUrl: './mobile-search-overlay.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(window:keydown.escape)': 'onEscape()',
  },
})
export class MobileSearchOverlayComponent {
  protected nav = inject(NavStateService);

  // ─── Mock data ──────────────────────────────────────────────────────────
  // Queries típicos de operación ERP — "facturas pendientes", "cliente X",
  // "stock bodega central" — no productos ecommerce.
  protected readonly recentSearches = signal<RecentSearch[]>([
    { id: 's1', query: 'facturas noviembre' },
    { id: 's2', query: 'cliente Juan Pérez' },
    { id: 's3', query: 'stock bodega central' },
    { id: 's4', query: 'OC pendientes' },
    { id: 's5', query: 'cotización 4521' },
    { id: 's6', query: 'liquidación sueldos' },
  ]);

  protected readonly recentViews = signal<RecentView[]>([
    {
      id: 'v1',
      title: 'Clientes',
      subtitle: 'CRM · Adm. Clientes',
      icon: 'fa-sharp fa-regular fa-user',
      url: '/customers',
    },
    {
      id: 'v2',
      title: 'Bandeja de pedidos',
      subtitle: 'OMS · Pedidos',
      icon: 'fa-sharp fa-regular fa-inbox',
      url: '/inbox',
    },
    {
      id: 'v3',
      title: 'Catálogo de productos',
      subtitle: 'PIM · Maestro',
      icon: 'fa-sharp fa-regular fa-boxes-stacked',
      url: '/cards',
    },
    {
      id: 'v4',
      title: 'Resumen Comercial',
      subtitle: 'Ventas · Dashboard',
      icon: 'fa-sharp fa-regular fa-chart-line',
      url: '/',
    },
  ]);

  // Focus management delegado a CDK:
  //   - `cdkTrapFocus` en el root del dialog instala el trap.
  //   - `[cdkTrapFocusAutoCapture]="true"` captura el activeElement previo al
  //     abrir y lo restaura al cerrar (patrón WAI-ARIA APG dialog).
  //   - `cdkFocusInitial` en el <input> indica al trap cuál elemento enfocar
  //     al capturar — evita la race vs un `afterNextRender` manual y garantiza
  //     que el keyboard mobile aparezca inmediatamente (patrón Google app).

  close(): void {
    this.nav.close('search');
  }

  onEscape(): void {
    if (this.nav.searchOverlayOpen()) this.close();
  }

  /**
   * Tap en un leaf view → navigate (via routerLink en el template) + cerrar.
   * Tap en un chip de búsqueda reciente → re-ejecuta la query (placeholder).
   */
  onViewClicked(): void {
    this.close();
  }

  removeSearch(id: string): void {
    this.recentSearches.update((list) => list.filter((s) => s.id !== id));
  }

  clearSearches(): void {
    this.recentSearches.set([]);
  }

  removeView(id: string): void {
    this.recentViews.update((list) => list.filter((v) => v.id !== id));
  }

  clearViews(): void {
    this.recentViews.set([]);
  }
}
