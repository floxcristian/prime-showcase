/**
 * Domain types for the "Estadísticas" drawer panel.
 *
 * The panel renders two families of metrics:
 *  - Gauge: a percentage score shown as a 270°-arc doughnut with the value
 *    centered in the cutout.
 *  - Trend: an ordered series shown as a filled line or bar chart with
 *    category labels on the x-axis.
 *
 * Labels are UI strings authored in the project's primary locale (Spanish)
 * and carried through the mocks layer intentionally — when i18n is added,
 * these fields become translation keys rather than literals.
 */

/** A percentage score (0–100) displayed as a radial gauge. */
export interface GaugeMetric {
  readonly id: 'satisfaction' | 'churn';
  readonly label: string;
  readonly pct: number;
}

/** A time/category-indexed numeric series displayed as a line or bar chart. */
export interface TrendMetric {
  readonly id: 'productUsage' | 'totalPurchases';
  readonly label: string;
  readonly categories: readonly string[];
  readonly values: readonly number[];
  /** Upper bound for the y-axis when a fixed scale is preferred over auto-fit. */
  readonly yMax?: number;
}

export interface StatsCharts {
  readonly gauges: readonly GaugeMetric[];
  readonly trends: {
    readonly productUsage: TrendMetric;
    readonly totalPurchases: TrendMetric;
  };
}
