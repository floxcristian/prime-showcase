/** Definición de una columna hideable del catálogo de customers. */
export interface CustomerColumnDef {
  key: string;
  label: string;
  defaultHidden?: boolean;
}

/**
 * Catálogo de columnas hideables. El checkbox de selección, Nombre y
 * Acciones quedan fuera — son funcionales/identidad y siempre visibles
 * (patrón Linear / Notion / Airtable: la primary column nunca se oculta).
 * El orden acá es el mismo que en el thead, así el multiselect lista las
 * opciones en el mismo eje visual que la tabla.
 *
 * Patrón PrimeNG "Column Toggle" oficial: `<p-multiselect>` con el
 * catálogo + un signal de keys seleccionadas como ngModel. La doc
 * (primeng.org/table#column-toggle) lo aplica con `*ngFor="let col of
 * columns"` para tablas homogéneas — acá adoptamos el trigger UI pero
 * mantenemos `@if (isColumnVisible(key))` por columna porque cada
 * celda renderiza distinto (tag, formatCredit, tabular-nums, tooltip
 * per-cell, sortIcon condicional).
 */
export const COLUMN_DEFS: readonly CustomerColumnDef[] = [
  { key: 'rut', label: 'RUT' },
  { key: 'type', label: 'Tipo' },
  { key: 'email', label: 'Contacto', defaultHidden: true },
  { key: 'lifecycle', label: 'Ciclo de vida', defaultHidden: true },
  { key: 'assignedSellers', label: 'Vendedores asignados' },
  { key: 'availableCredit', label: 'Crédito disponible' },
  { key: 'usedCredit', label: 'Crédito utilizado', defaultHidden: true },
  { key: 'assignedCredit', label: 'Crédito asignado', defaultHidden: true },
  { key: 'region', label: 'Región', defaultHidden: true },
  { key: 'city', label: 'Ciudad', defaultHidden: true },
  { key: 'segmento', label: 'Segmento' },
  { key: 'creditClassification', label: 'Clasif. crédito' },
  { key: 'potencial', label: 'Potencial' },
  { key: 'discountGroup', label: 'Grupo desc.' },
  { key: 'cartera', label: 'Cartera' },
];
