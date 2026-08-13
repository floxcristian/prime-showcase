import type { ColumnHelpEntry } from '../../../shared/components/column-help/column-help.component';

/**
 * Legends de columnas codificadas — single source of truth de qué
 * significa cada código del legacy. Los `<app-column-help>` del
 * header las renderizan en un popover; los tooltips per-cell
 * (`codeTooltip`) hacen lookup en estas mismas listas.
 *
 * Agrupadas en un solo archivo por ser constantes del mismo tipo
 * (mismo criterio que `customers-data.ts`).
 */

export const CLASSIFICATION_LEGEND: readonly ColumnHelpEntry[] = [
  {
    code: 'A1',
    label: 'Excelente',
    description: 'Riesgo financiero bajo',
    severity: 'success',
  },
  {
    code: 'A2',
    label: 'Muy bueno',
    description: 'Riesgo financiero bajo',
    severity: 'success',
  },
  {
    code: 'B1',
    label: 'Bueno',
    description: 'Riesgo financiero medio',
    severity: 'info',
  },
  {
    code: 'B2',
    label: 'Aceptable',
    description: 'Riesgo financiero medio',
    severity: 'info',
  },
  {
    code: 'C1',
    label: 'Regular',
    description: 'Riesgo financiero medio-alto',
    severity: 'warn',
  },
  {
    code: 'C2',
    label: 'Marginal',
    description: 'Riesgo financiero alto',
    severity: 'warn',
  },
  {
    code: 'D',
    label: 'Crítico',
    description: 'Riesgo de incumplimiento alto',
    severity: 'danger',
  },
];

export const POTENCIAL_LEGEND: readonly ColumnHelpEntry[] = [
  {
    code: 'G1',
    label: 'Estratégico',
    description: 'Cuentas top con máximo potencial de venta',
    severity: 'success',
  },
  {
    code: 'G2',
    label: 'Alto',
    description: 'Cuentas en crecimiento con buen potencial',
    severity: 'info',
  },
  {
    code: 'G3',
    label: 'Medio',
    description: 'Cuentas estables con potencial moderado',
    severity: 'warn',
  },
  {
    code: 'G4',
    label: 'Bajo',
    description: 'Cuentas con bajo potencial de crecimiento',
    severity: 'secondary',
  },
];

export const LIFECYCLE_LEGEND: readonly ColumnHelpEntry[] = [
  {
    code: 'RECURRENTE',
    label: 'Recurrente',
    description: 'Compras consistentes en el período',
    severity: 'success',
  },
  {
    code: 'INACTIVO',
    label: 'Inactivo',
    description: 'Sin compras recientes, churn parcial',
    severity: 'secondary',
  },
  {
    code: 'PELIGRO FUGA',
    label: 'Peligro de fuga',
    description: 'Frecuencia decreciente, target de retención',
    severity: 'warn',
  },
  {
    code: 'FUGADO',
    label: 'Fugado',
    description: 'Cliente perdido, churn confirmado',
    severity: 'danger',
  },
];

export const CARTERA_LEGEND: readonly ColumnHelpEntry[] = [
  {
    code: 'CA',
    label: 'Activa',
    description: 'Cuenta corriente operativa, paga al día',
    severity: 'success',
  },
  {
    code: 'CN',
    label: 'Nueva',
    description: 'Alta reciente, primer ciclo de facturación',
    severity: 'info',
  },
  {
    code: 'CP',
    label: 'Prospecto',
    description: 'En etapa comercial, sin venta confirmada',
    severity: 'secondary',
  },
  {
    code: 'CI',
    label: 'Inactiva',
    description: 'Sin movimiento +6 meses, no morosa',
    severity: 'secondary',
  },
  {
    code: 'CM',
    label: 'Morosa',
    description: 'Cuenta con deuda vencida, asignar a cobranza',
    severity: 'danger',
  },
];

export const DISCOUNT_GROUP_LEGEND: readonly ColumnHelpEntry[] = [
  {
    code: '0',
    label: 'Sin descuento',
    description: 'Precios estándar de catálogo',
    severity: 'secondary',
  },
  {
    code: '1',
    label: 'Tier básico',
    description: 'Descuento mínimo (~2%)',
    severity: 'info',
  },
  {
    code: '2',
    label: 'Tier básico+',
    description: 'Descuento bajo (~5%)',
    severity: 'info',
  },
  {
    code: '3',
    label: 'Tier estándar',
    description: 'Descuento moderado (~10%)',
    severity: 'success',
  },
  {
    code: '4',
    label: 'Tier estándar+',
    description: 'Descuento alto (~15%)',
    severity: 'success',
  },
  {
    code: '5',
    label: 'Tier premium',
    description: 'Descuento máximo (~20%) — cuentas estratégicas',
    severity: 'warn',
  },
];
