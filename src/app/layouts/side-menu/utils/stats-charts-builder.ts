import type { ChartData, ChartOptions } from 'chart.js';
import type {
  GaugeMetric,
  StatsCharts,
  TrendMetric,
} from '../models/stats-chart.interface';

/**
 * Pre-resolved color strings consumed by the chart builder.
 *
 * Every field MUST be a canvas-consumable color (named / hex / rgb[a] / hsl).
 * Values containing modern CSS functions (`color-mix`, `oklch`, `var()`) are
 * not accepted — the caller is responsible for resolving them via
 * `resolveCssColor` before building. This keeps the builder pure and
 * trivially unit-testable without a DOM.
 */
export interface StatsPalette {
  readonly gauge: { readonly value: string; readonly track: string };
  readonly line: {
    readonly stroke: string;
    readonly fill: string;
    readonly point: string;
  };
  readonly bar: { readonly fill: string; readonly hoverFill: string };
  readonly tick: string;
  readonly grid: string;
}

export interface StatsChartsConfigs {
  readonly gauges: readonly {
    readonly id: GaugeMetric['id'];
    readonly label: string;
    readonly pct: number;
    readonly data: ChartData<'doughnut'>;
    readonly options: ChartOptions<'doughnut'>;
  }[];
  readonly productUsage: {
    readonly label: string;
    readonly data: ChartData<'line'>;
    readonly options: ChartOptions<'line'>;
  };
  readonly totalPurchases: {
    readonly label: string;
    readonly data: ChartData<'bar'>;
    readonly options: ChartOptions<'bar'>;
  };
}

/**
 * Index of the maximum value in a numeric series, or `-1` for an empty
 * series. Stable against ties (returns the first occurrence) so the peak
 * point doesn't jitter between equal samples.
 */
export function peakIndex(values: readonly number[]): number {
  if (values.length === 0) return -1;
  let bestIdx = 0;
  let bestVal = values[0];
  for (let i = 1; i < values.length; i++) {
    if (values[i] > bestVal) {
      bestVal = values[i];
      bestIdx = i;
    }
  }
  return bestIdx;
}

function clampPct(pct: number): number {
  if (!Number.isFinite(pct)) return 0;
  if (pct < 0) return 0;
  if (pct > 100) return 100;
  return pct;
}

function buildGauge(
  metric: GaugeMetric,
  palette: StatsPalette,
): StatsChartsConfigs['gauges'][number] {
  const pct = clampPct(metric.pct);
  return {
    id: metric.id,
    label: metric.label,
    pct,
    data: {
      datasets: [
        {
          data: [pct, 100 - pct],
          backgroundColor: [palette.gauge.value, palette.gauge.track],
          borderWidth: 0,
        },
      ],
    },
    options: {
      cutout: '78%',
      rotation: -135,
      circumference: 270,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
      },
    },
  };
}

function buildLine(
  metric: TrendMetric,
  palette: StatsPalette,
): StatsChartsConfigs['productUsage'] {
  const peak = peakIndex(metric.values);
  const pointRadius = metric.values.map((_, i) => (i === peak ? 5 : 0));

  return {
    label: metric.label,
    data: {
      labels: [...metric.categories],
      datasets: [
        {
          data: [...metric.values],
          borderColor: palette.line.stroke,
          backgroundColor: palette.line.fill,
          borderWidth: 2,
          tension: 0.4,
          fill: true,
          pointRadius,
          pointBackgroundColor: palette.line.point,
          pointBorderColor: palette.line.point,
          pointHoverRadius: 5,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
      },
      scales: {
        x: {
          ticks: { color: palette.tick, font: { size: 11 } },
          grid: { display: false },
          border: { display: false },
        },
        y: { display: false, grid: { display: false } },
      },
    },
  };
}

function buildBar(
  metric: TrendMetric,
  palette: StatsPalette,
): StatsChartsConfigs['totalPurchases'] {
  return {
    label: metric.label,
    data: {
      labels: [...metric.categories],
      datasets: [
        {
          data: [...metric.values],
          backgroundColor: palette.bar.fill,
          hoverBackgroundColor: palette.bar.hoverFill,
          borderRadius: 4,
          borderSkipped: false,
          barThickness: 18,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
      },
      scales: {
        x: {
          ticks: { color: palette.tick, font: { size: 11 } },
          grid: { display: false },
          border: { display: false },
        },
        y: {
          beginAtZero: true,
          ...(metric.yMax === undefined ? {} : { max: metric.yMax }),
          ticks: { color: palette.tick, stepSize: 100, font: { size: 11 } },
          grid: { color: palette.grid, drawTicks: false },
          border: { display: false },
        },
      },
    },
  };
}

/**
 * Deterministic, DOM-free builder. Given domain data + a resolved palette,
 * returns Chart.js configs ready to bind to `<p-chart>`. The output is a
 * pure function of the inputs — no hidden theme reads, no global state —
 * which makes every option easy to assert in unit tests.
 */
export function buildStatsChartsConfigs(
  source: StatsCharts,
  palette: StatsPalette,
): StatsChartsConfigs {
  return {
    gauges: source.gauges.map(g => buildGauge(g, palette)),
    productUsage: buildLine(source.trends.productUsage, palette),
    totalPurchases: buildBar(source.trends.totalPurchases, palette),
  };
}
