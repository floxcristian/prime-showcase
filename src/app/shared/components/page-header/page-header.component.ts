import {
  ChangeDetectionStrategy,
  Component,
  input,
} from '@angular/core';

/**
 * Header de página de módulo — título `h1` + subtítulo opcional con el
 * layout canónico compartido por CRM > Clientes, Usuarios, Roles y todo
 * el módulo de observabilidad. Antes vivía copy-pasteado en 9 templates
 * (seis con el comentario "patrón compartido con CRM > Clientes").
 *
 * Slots de proyección:
 *   - `[meta]` — línea informativa debajo del subtítulo (ej: el
 *     "N visibles" de obs-services / obs-alerts).
 *   - `[actions]` — cluster derecho de botones (ej: "Guardar" en
 *     obs-preferences). Marcar el wrapper con el atributo `actions`.
 *   - default (catch-all) — también renderiza a la derecha. Es el slot
 *     para contenido **condicional** (count pills dentro de `@if`):
 *     el control flow de Angular proyecta bloques `@if`/`@for` al
 *     `<ng-content>` wildcard, no a los slots con selector — por eso
 *     los pills de users/roles/customers/obs-uptime van sin atributo.
 *
 * Márgenes contextuales (`mb-6`, `p-1`) se agregan vía `class` en el
 * call site — Angular los mergea con la host class del componente.
 */
@Component({
  selector: 'app-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-w-0">
      <h1 class="text-2xl leading-8 text-color font-medium">{{ title() }}</h1>
      @if (description()) {
        <div class="mt-1 leading-6 text-muted-color">{{ description() }}</div>
      }
      <ng-content select="[meta]" />
    </div>
    <ng-content select="[actions]" />
    <ng-content />
  `,
  host: {
    class: 'flex items-start gap-2 justify-between flex-wrap',
  },
})
export class PageHeaderComponent {
  /** Título de la página — se renderiza como `h1`. */
  readonly title = input.required<string>();
  /** Subtítulo descriptivo. Omitir para headers de título solo. */
  readonly description = input<string>();
}
