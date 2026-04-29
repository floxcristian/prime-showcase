import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Pill neutral inline — count badge / label compacto. Uso para counts en
 * tabs ("12"), alert-count en cards ("3 alertas"), status decorativos
 * neutrales ("Acusada" como pill informativa).
 *
 * Cuando el dato tiene severidad semántica (critical/warn/firing/etc.)
 * usar `<app-severity-chip>` o `<app-status-chip>` — esos van con `<p-tag>`
 * y respetan los colores semánticos del theme. `<app-pill>` es neutral.
 *
 * Tamaño y peso fijos (text-xs / font-semibold / px-2 / py-0.5 / rounded-lg)
 * por design system. Antes coexistían 3 variantes inline (px-1.5 vs px-2;
 * py-0.5 vs py-1; font-medium vs font-semibold) — la consolidación elimina
 * el drift visual entre vistas.
 */
@Component({
  selector: 'app-pill',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (icon()) {
      <i [class]="icon()" class="text-xs" aria-hidden="true"></i>
    }
    <ng-content />
  `,
  host: {
    class:
      'inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-lg leading-none bg-emphasis text-color',
  },
})
export class PillComponent {
  readonly icon = input<string>('');
}
