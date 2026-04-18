import type { StatsCharts } from '../models/stats-chart.interface';

/**
 * Mock data for the "Estadísticas" tab of the settings drawer.
 *
 * ## Provenance
 *
 * This panel is **not published as an upstream sample** by PrimeFaces — it
 * does not exist under `apps/showcase/pages/landing/samples/` in
 * primefaces/primeng, primefaces/primevue, or primefaces/sakai-ng (verified
 * via `gh search code` against those repos).
 *
 * The visual structure and representative values below were reconstructed
 * from a reference screenshot provided by a stakeholder. Treat the numbers
 * as illustrative fixtures, not canonical product data — they exist to drive
 * the chart shapes (270° arc, peak marker, twelve-month distribution) rather
 * than to communicate specific facts. If/when the upstream source surfaces,
 * align to its figures and drop this note.
 *
 * ## Locale
 *
 * Strings are authored in Spanish to match the rest of the product UI. When
 * i18n is introduced, these become `$localize` keys rather than new files.
 */
export const STATS_CHARTS: StatsCharts = {
  gauges: [
    { id: 'satisfaction', label: 'Satisfacción del cliente', pct: 56 },
    { id: 'churn', label: 'Riesgo de cancelación', pct: 24 },
  ],
  trends: {
    productUsage: {
      id: 'productUsage',
      label: 'Uso del producto',
      categories: ['31', '1', '2', '3', '4', '5', '6', '7', '8'],
      values: [35, 28, 32, 40, 38, 55, 72, 60, 52],
    },
    totalPurchases: {
      id: 'totalPurchases',
      label: 'Total de compras',
      categories: [
        'Ene',
        'Feb',
        'Mar',
        'Abr',
        'May',
        'Jun',
        'Jul',
        'Ago',
        'Sep',
        'Oct',
        'Nov',
        'Dic',
      ],
      values: [100, 200, 400, 300, 140, 220, 310, 520, 150, 230, 320, 150],
      yMax: 600,
    },
  },
} as const;
