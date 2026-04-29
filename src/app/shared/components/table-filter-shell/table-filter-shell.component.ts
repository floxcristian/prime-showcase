import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Shell de presentación para column filters de `<p-table>`.
 *
 * Aplica width uniforme (w-64 = 256px) al contenido del
 * `<ng-template #filter>` de cada `<p-columnFilter>`. Single source of
 * truth: cambio del width acá → todas las tablas se actualizan sin tocar
 * templates de cada columna.
 *
 * **Por qué**: el popup de `<p-columnFilter>` adapta su width al
 * contenido. Sin un wrapper fijo, cada columna renderiza con ancho
 * distinto según el componente interno (~14rem para `<p-multiselect>`
 * colapsado, ~22rem para `<input pInputText>`, ~17rem para `<p-slider>`).
 * Esa inconsistencia se nota al ciclar entre filters de columnas
 * distintas — bigtech (Linear / Stripe / Datadog) usan width uniforme.
 *
 * **Uso**:
 *
 * ```html
 * <p-columnFilter ...>
 *   <ng-template #filter let-value let-filter="filterCallback">
 *     <app-table-filter-shell>
 *       <p-multiselect ... class="w-full" />
 *     </app-table-filter-shell>
 *   </ng-template>
 * </p-columnFilter>
 * ```
 *
 * Si el filter necesita layout interno (label + input vertical, como
 * range sliders con value display), envolver el contenido en un div
 * propio dentro del shell:
 *
 * ```html
 * <app-table-filter-shell>
 *   <div class="flex flex-col gap-3">
 *     <span class="text-xs text-muted-color">Rango: {{ ... }}</span>
 *     <p-slider class="w-full" ... />
 *   </div>
 * </app-table-filter-shell>
 * ```
 */
@Component({
  selector: 'app-table-filter-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ng-content />`,
  host: {
    class: 'block w-64',
  },
})
export class TableFilterShellComponent {}
