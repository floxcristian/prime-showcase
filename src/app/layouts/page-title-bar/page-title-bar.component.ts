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
    <!-- h1 a text-lg (18px) font-semibold: tamaño compacto apto para la banda
         sticky h-12 pero leíble como page-title (no body-text en bold como
         antes, que era 16px/font-bold — mismo weight/size que una frase
         normal del contenido). Patrón GitHub / Linear / Vercel para sticky
         page headers compactos. -->
    <h1 class="text-color text-lg font-semibold leading-7">{{ title() }}</h1>
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
