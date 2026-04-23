import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Toolbar principal-looking con título centrado. Misma identidad visual que
 * el toolbar principal (tornado svg bg, h-16, text-surface-0 blanco, font-bold)
 * pero mostrando un título en lugar de los controles (logo/search/bell).
 *
 * Uso: surfaces mobile que reemplazan completamente el toolbar principal
 * (Más overlay, Mi cuenta drawer). Para surfaces que conviven con el toolbar
 * real (Menú overlay) y necesitan un subheader compacto, usar
 * `<app-page-title-bar>` (h-12, bg-surface-0, text-color).
 */
@Component({
  selector: 'app-primary-title-toolbar',
  template: `
    <!-- Leading slot: acciones a la izquierda (back button típico). Proyección
         por atributo 'leading' — el consumer marca el elemento para que caiga
         aquí en lugar del default trailing. empty:hidden colapsa el slot si no
         hay contenido proyectado. -->
    <div
      class="absolute left-2 inset-y-0 flex items-center empty:hidden"
    >
      <ng-content select="[leading]"></ng-content>
    </div>
    <h1 class="text-surface-0 text-lg font-bold leading-7">{{ title() }}</h1>
    <!-- Trailing slot (default). empty:hidden — cuando el consumer no proyecta
         un action, el wrapper pasa a :empty (ng-content vacío no crea element
         children) y se colapsa. Evita un hit-target fantasma a la derecha del
         título en surfaces sin action (Mi cuenta, Más). -->
    <div
      class="absolute right-2 inset-y-0 flex items-center empty:hidden"
    >
      <ng-content></ng-content>
    </div>
  `,
  styleUrl: './primary-title-toolbar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'toolbar-brand-bg relative h-16 shrink-0 flex items-center justify-center px-2 w-full',
  },
})
export class PrimaryTitleToolbarComponent {
  readonly title = input.required<string>();
}
