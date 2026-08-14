import type { DataTableDesignTokens } from '@primeuix/themes/types/datatable';

// Shared design tokens for <p-table> (prop [dt]).
// Makes header/headerCell/row transparent so the table inherits its host
// card's background instead of imposing the theme's surface-0.
//
// Callers that need overrides (e.g. aligning header height with a sibling
// panel in a multi-pane layout) compose via spread. See inbox.component.ts.
export const TRANSPARENT_TABLE_TOKENS: DataTableDesignTokens = {
  header: {
    background: 'transparent',
  },
  headerCell: {
    background: 'transparent',
  },
  row: {
    background: 'transparent',
  },
};

/**
 * Passthrough config compartida para `<p-columnFilter>` (prop `[pt]`) —
 * antes duplicada en users / roles / customers / obs-uptime.
 *
 * `pcFilterClearButton` aplica `.p-button-tonal` al clear button del
 * filter popup. Patrón Material 3 / Mercado Libre: cuando hay 2
 * acciones (Limpiar + Aplicar), la secundaria va con bg tonal del
 * primary (no outlined neutro), reforzando jerarquía visual sin gritar
 * como un primary filled.
 *
 * **Por qué `root.class` y no solo `class`**: el slot `class` directo
 * en `ButtonPassThrough` aplica al HOST del `<p-button>` Angular
 * component, NO al `<button>` interno. La utility `.p-button-tonal`
 * (definida en `styles.scss`) matchea el `<button>` real — mismo
 * elemento que recibe la clase cuando se usa el patrón `styleClass`
 * en los demás módulos. `root.class` apunta al elemento correcto.
 *
 * `filterButtonBar`: botones agrupados a la derecha (no el
 * space-between default de PrimeNG) con gap-2 (8px) entre ellos.
 * Patrón Linear / Stripe / GitHub / Notion / Vercel: filter actions
 * como grupo right-anchored — secondary ("Limpiar") a la izquierda del
 * primary ("Aplicar"), ambos al borde derecho del popup. Comunica
 * "estas son las salidas del dialog" como unidad, en lugar de
 * presentarlos como alternativas equivalentes. `!justify-end` con `!`
 * modifier de Tailwind para sobreescribir el `justify-content:
 * space-between` que PrimeNG aplica por default al
 * `.p-datatable-filter-button-bar`; `gap-2` matchea el spacing
 * canónico del DS para action button groups.
 */
export const COLUMN_FILTER_PT = {
  pcFilterClearButton: { root: { class: 'p-button-tonal' } },
  filterButtonBar: { class: '!justify-end gap-2' },
};
