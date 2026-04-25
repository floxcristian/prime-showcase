import { Injectable, signal } from '@angular/core';

/**
 * Item de búsqueda reciente. Query plano (sin scope/filter) — para un ERP
 * real vendría timestamped para poder expirar, pero acá es showcase.
 */
export interface RecentSearch {
  readonly id: string;
  readonly query: string;
}

/**
 * Item de "Visto recientemente". Para un ERP, "visto" = pantalla / módulo /
 * entidad visitada (no producto ecommerce). Incluye `url` para navigate
 * directo y `subtitle` como breadcrumb abreviado ("CRM · Adm. Clientes")
 * que ayuda al user a ubicar el item en la jerarquía de módulos.
 */
export interface RecentView {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly icon: string;
  readonly url: string;
}

/**
 * Source-of-truth singleton para el historial de búsqueda.
 *
 * **Por qué un service y no estado local:** el search surface se renderiza
 * en dos shells distintos — full-screen overlay en mobile (`<md`) y popover
 * anclado al input en desktop (`lg+`). Ambos deben leer/mutar los MISMOS
 * datos (el user agrega "cliente Juan" desde desktop, lo ve en mobile y
 * viceversa). Sin service, habría doble state inconsistente.
 *
 * **Por qué `providedIn: 'root'`:** es state global sin scope por ruta.
 * Coincide con NavStateService / AppConfigService.
 *
 * **Pending para producción:** persist a localStorage (TTL 30 días) + cap
 * máximo (últimas 10-20 entradas). Hoy mock data inline — same rationale
 * que `NotificationsService`.
 */
@Injectable({ providedIn: 'root' })
export class SearchHistoryService {
  // Queries típicos de operación ERP — "facturas pendientes", "cliente X",
  // "stock bodega central" — no productos ecommerce.
  private readonly _recentSearches = signal<readonly RecentSearch[]>([
    { id: 's1', query: 'facturas noviembre' },
    { id: 's2', query: 'cliente Juan Pérez' },
    { id: 's3', query: 'stock bodega central' },
    { id: 's4', query: 'OC pendientes' },
    { id: 's5', query: 'cotización 4521' },
    { id: 's6', query: 'liquidación sueldos' },
  ]);

  private readonly _recentViews = signal<readonly RecentView[]>([
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

  readonly recentSearches = this._recentSearches.asReadonly();
  readonly recentViews = this._recentViews.asReadonly();

  removeSearch(id: string): void {
    this._recentSearches.update((list) => list.filter((s) => s.id !== id));
  }

  clearSearches(): void {
    this._recentSearches.set([]);
  }

  removeView(id: string): void {
    this._recentViews.update((list) => list.filter((v) => v.id !== id));
  }

  clearViews(): void {
    this._recentViews.set([]);
  }
}
