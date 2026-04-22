import {
  ChangeDetectionStrategy,
  Component,
  input,
} from '@angular/core';

/**
 * Toolbar secundaria con título centrado. Patrón compartido entre:
 *   - Overlays mobile de navegación secundaria (Menú, Más)
 *   - Rutas con header simple sin breadcrumb (Notificaciones y futuras
 *     bell-driven / chrome-driven routes)
 *
 * Altura idéntica al breadcrumb-bar (h-12) para que sean intercambiables
 * sin afectar el layout global — en las rutas normales se muestra el
 * breadcrumb-bar, en las rutas/overlays con header simple se muestra este.
 *
 * Usa `border-b border-surface` como separador con el contenido (mismo
 * recurso visual que los section-headers del design system).
 */
@Component({
  selector: 'app-page-title-bar',
  template: `
    <h1 class="text-color font-bold leading-6">{{ title() }}</h1>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'sticky top-0 z-20 h-12 shrink-0 flex items-center justify-center border-b border-surface bg-surface-0 dark:bg-surface-950',
  },
})
export class PageTitleBarComponent {
  readonly title = input.required<string>();
}
