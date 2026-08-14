// Local
import type { ColumnHelpEntry } from '../../../shared/components/column-help/column-help.component';
import type {
  Cartera,
  CreditClassification,
  Customer,
  CustomerLifecycle,
  CustomerType,
} from '../models/customer.interface';

/**
 * Formatters y severities puros del módulo customers — extraídos del
 * componente para que cada subcomponente (drawer, chips, sheet, cards)
 * los importe sin acoplar al container. Cada consumidor los re-expone
 * como campo (`protected readonly formatCredit = formatCredit;`) para
 * que los templates no cambien.
 */

/**
 * Formateador de moneda CLP. Instanciado una vez (constructor de
 * `Intl.NumberFormat` es relativamente caro) y reusado por
 * `formatCredit` + el filter shell. `maximumFractionDigits: 0`
 * porque el peso chileno no usa decimales.
 */
const clpFormatter = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

/**
 * Tooltip per-cell — lookup en la legend correspondiente y formateo
 * "Label — descripción". Hover sobre `[A1]` muestra
 * "Excelente — Riesgo financiero bajo" instantáneamente, sin abrir
 * el popover del header.
 */
export function codeTooltip(
  legend: readonly ColumnHelpEntry[],
  code: string,
): string {
  const entry = legend.find((e) => e.code === code);
  if (!entry) return '';
  return entry.description
    ? `${entry.label} — ${entry.description}`
    : entry.label;
}

/**
 * Severity del tag de tipo. Empresa → undefined (primary), Persona →
 * secondary. Mismo patrón que users.ts para Interno/Externo.
 */
export function typeSeverity(type: CustomerType): 'secondary' | undefined {
  return type === 'Empresa' ? undefined : 'secondary';
}

/**
 * Severity del tag de clasificación crediticia — color-coded por
 * rating. A* (excelente) → success, B* (bueno) → info, C* (regular)
 * → warn, D (malo) → danger. Comunica salud crediticia de un vistazo
 * sin necesidad de leer el código.
 */
export function classificationSeverity(
  cls: CreditClassification,
): 'success' | 'info' | 'warn' | 'danger' {
  if (cls === 'A1' || cls === 'A2') return 'success';
  if (cls === 'B1' || cls === 'B2') return 'info';
  if (cls === 'C1' || cls === 'C2') return 'warn';
  return 'danger';
}

/**
 * Severity del tag de ciclo de vida comercial:
 *   - RECURRENTE → success (cliente saludable, compra consistente)
 *   - INACTIVO → secondary (sin actividad, sin alarma inmediata)
 *   - PELIGRO FUGA → warn (target proactivo de retención)
 *   - FUGADO → danger (churn confirmado)
 */
export function lifecycleSeverity(
  l: CustomerLifecycle,
): 'success' | 'secondary' | 'warn' | 'danger' {
  if (l === 'RECURRENTE') return 'success';
  if (l === 'PELIGRO FUGA') return 'warn';
  if (l === 'FUGADO') return 'danger';
  return 'secondary';
}

/**
 * Severity del tag de cartera — lifecycle del cliente:
 *   - CA Activa → success (paga al día)
 *   - CN Nueva  → info (alta reciente)
 *   - CP Prospecto → secondary (pre-venta)
 *   - CI Inactiva → secondary (sin movimiento, no morosa)
 *   - CM Morosa → danger (deuda vencida)
 */
export function carteraSeverity(
  c: Cartera,
): 'success' | 'info' | 'secondary' | 'danger' {
  if (c === 'CA') return 'success';
  if (c === 'CN') return 'info';
  if (c === 'CM') return 'danger';
  return 'secondary';
}

/** Label legible de cartera (para mostrar en el tag). */
export function carteraLabel(c: Cartera): string {
  if (c === 'CA') return 'Activa';
  if (c === 'CP') return 'Prospecto';
  if (c === 'CN') return 'Nueva';
  if (c === 'CI') return 'Inactiva';
  return 'Morosa';
}

/** Formato CLP de un monto de crédito — ver `clpFormatter` arriba. */
export function formatCredit(amount: number): string {
  return clpFormatter.format(amount);
}

/**
 * Utilization gauge — % de crédito utilizado del asignado.
 * Mini progress bar inline informa al vendor "qué tan cargado está
 * el cliente" sin tener que comparar mentalmente 2 montos.
 *
 * Patrón Stripe/HubSpot mobile: when financial ratio matters, show
 * visual gauge inline. 0%=fully available, 100%=maxed out.
 *
 * Clamped 0-100 para edge cases (cliente con usedCredit > assigned
 * en data sucia).
 */
export function creditUtilizationPct(customer: Customer): number {
  if (customer.assignedCredit <= 0) return 0;
  const pct = (customer.usedCredit / customer.assignedCredit) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

/**
 * Severity del gauge por threshold de utilization. Driving decisions:
 *   - <60%: success (sano, espacio para más facturación)
 *   - 60-85%: warn (atención, considerar bump credit)
 *   - >85%: danger (cerca del límite, no aprobar más)
 */
export function creditUtilizationSeverity(
  pct: number,
): 'success' | 'warn' | 'danger' {
  if (pct < 60) return 'success';
  if (pct <= 85) return 'warn';
  return 'danger';
}

/**
 * Color CSS variable token correspondiente a la severity del gauge.
 * Usamos `var(--p-{green,orange,red}-500)` para mantener consistency
 * con los tags PrimeNG (severity success/warn/danger) que usan los
 * mismos tokens internamente. Lint rule `no-hardcoded-colors` no
 * permite `bg-green-500` como class, pero los design tokens via
 * `[style.backgroundColor]` sí porque son CSS vars del theme.
 */
export function creditUtilizationColor(pct: number): string {
  const sev = creditUtilizationSeverity(pct);
  if (sev === 'success') return 'var(--p-green-500)';
  if (sev === 'warn') return 'var(--p-orange-500)';
  return 'var(--p-red-500)';
}

/**
 * Tooltip del overflow indicator "N más" — lista los nombres después
 * del primary, separados por coma. Permite peek rápido del equipo
 * sin abrir el detalle del cliente.
 */
export function additionalSellersTooltip(sellers: readonly string[]): string {
  return sellers.slice(1).join(', ');
}
