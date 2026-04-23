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
    <h1 class="text-surface-0 text-lg font-bold leading-7">{{ title() }}</h1>
    <div class="absolute right-2 inset-y-0 flex items-center">
      <ng-content></ng-content>
    </div>
  `,
  styleUrl: './primary-title-toolbar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'relative h-16 shrink-0 flex items-center justify-center px-2 w-full',
  },
})
export class PrimaryTitleToolbarComponent {
  readonly title = input.required<string>();
}
