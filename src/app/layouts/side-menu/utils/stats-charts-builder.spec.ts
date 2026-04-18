import { describe, expect, it } from 'vitest';
import {
  buildStatsChartsConfigs,
  peakIndex,
  type StatsPalette,
} from './stats-charts-builder';
import type { StatsCharts } from '../models/stats-chart.interface';

const PALETTE: StatsPalette = {
  gauge: { value: 'rgb(99, 102, 241)', track: 'rgb(228, 228, 231)' },
  line: {
    stroke: 'rgb(99, 102, 241)',
    fill: 'rgba(99, 102, 241, 0.15)',
    point: 'rgb(99, 102, 241)',
  },
  bar: { fill: 'rgb(228, 228, 231)', hoverFill: 'rgb(129, 140, 248)' },
  tick: 'rgb(161, 161, 170)',
  grid: 'rgb(244, 244, 245)',
};

const FIXTURE: StatsCharts = {
  gauges: [
    { id: 'satisfaction', label: 'Satisfacción', pct: 56 },
    { id: 'churn', label: 'Riesgo', pct: 24 },
  ],
  trends: {
    productUsage: {
      id: 'productUsage',
      label: 'Uso',
      categories: ['a', 'b', 'c'],
      values: [10, 40, 20],
    },
    totalPurchases: {
      id: 'totalPurchases',
      label: 'Compras',
      categories: ['Ene', 'Feb', 'Mar'],
      values: [100, 200, 150],
      yMax: 600,
    },
  },
} as const;

describe('peakIndex', () => {
  it('returns -1 for an empty series so callers can branch explicitly', () => {
    expect(peakIndex([])).toBe(-1);
  });

  it('returns 0 for a single-element series', () => {
    expect(peakIndex([42])).toBe(0);
  });

  it('returns the index of the strict maximum', () => {
    expect(peakIndex([1, 2, 3, 2, 1])).toBe(2);
  });

  it('returns the FIRST occurrence on ties — prevents peak-marker jitter when values are equal', () => {
    // If the implementation changed to use `indexOf(Math.max(...))` it would
    // also return the first occurrence by coincidence, but the explicit strict
    // `>` comparison documents the intent: a later equal sample must not steal
    // the highlight from the earlier one.
    expect(peakIndex([5, 5, 5])).toBe(0);
    expect(peakIndex([1, 5, 3, 5, 2])).toBe(1);
  });

  it('handles negative values and zero', () => {
    expect(peakIndex([-5, -2, -10])).toBe(1);
    expect(peakIndex([0, -1, -2])).toBe(0);
  });
});

describe('buildStatsChartsConfigs', () => {
  it('produces one gauge config per source gauge, preserving id and label', () => {
    const out = buildStatsChartsConfigs(FIXTURE, PALETTE);
    expect(out.gauges).toHaveLength(2);
    expect(out.gauges[0].id).toBe('satisfaction');
    expect(out.gauges[0].label).toBe('Satisfacción');
    expect(out.gauges[1].id).toBe('churn');
  });

  it('encodes the gauge percentage as [pct, 100-pct] in dataset.data', () => {
    const out = buildStatsChartsConfigs(FIXTURE, PALETTE);
    const ds = out.gauges[0].data.datasets?.[0];
    expect(ds?.data).toEqual([56, 44]);
  });

  it('uses palette.gauge colors for [value, track] in that order', () => {
    const out = buildStatsChartsConfigs(FIXTURE, PALETTE);
    const ds = out.gauges[0].data.datasets?.[0];
    expect(ds?.backgroundColor).toEqual([
      PALETTE.gauge.value,
      PALETTE.gauge.track,
    ]);
  });

  it('produces a 270° arc rotated -135° (bottom-left start) with a 78% cutout', () => {
    // These three knobs together define the visual signature of the gauge —
    // regressing any one of them would silently change the whole look.
    const out = buildStatsChartsConfigs(FIXTURE, PALETTE);
    const opts = out.gauges[0].options;
    expect(opts?.cutout).toBe('78%');
    expect(opts?.rotation).toBe(-135);
    expect(opts?.circumference).toBe(270);
  });

  describe('gauge pct clamping', () => {
    const src = (pct: number): StatsCharts => ({
      ...FIXTURE,
      gauges: [{ id: 'satisfaction', label: 'x', pct }],
    });

    it('clamps values above 100 to 100 so the arc never overflows', () => {
      const out = buildStatsChartsConfigs(src(150), PALETTE);
      expect(out.gauges[0].pct).toBe(100);
      expect(out.gauges[0].data.datasets?.[0].data).toEqual([100, 0]);
    });

    it('clamps negative values to 0 so the arc never goes backward', () => {
      const out = buildStatsChartsConfigs(src(-10), PALETTE);
      expect(out.gauges[0].pct).toBe(0);
      expect(out.gauges[0].data.datasets?.[0].data).toEqual([0, 100]);
    });

    it('coerces NaN to 0 rather than rendering an empty/undefined arc', () => {
      const out = buildStatsChartsConfigs(src(NaN), PALETTE);
      expect(out.gauges[0].pct).toBe(0);
    });

    it('coerces Infinity to 0 (not 100) because Infinity is not finite', () => {
      // `Number.isFinite(Infinity)` is false, so the guard fires first — any
      // non-finite input resolves to 0. This is intentional: Infinity as a
      // percentage is meaningless, and coercing to 100 would mask the bug.
      const out = buildStatsChartsConfigs(src(Infinity), PALETTE);
      expect(out.gauges[0].pct).toBe(0);
    });

    it('preserves valid fractional percentages', () => {
      const out = buildStatsChartsConfigs(src(33.3), PALETTE);
      expect(out.gauges[0].pct).toBe(33.3);
    });
  });

  describe('line (productUsage)', () => {
    it('copies categories and values defensively (caller cannot mutate the config)', () => {
      const out = buildStatsChartsConfigs(FIXTURE, PALETTE);
      expect(out.productUsage.data.labels).toEqual(['a', 'b', 'c']);
      expect(out.productUsage.data.datasets?.[0].data).toEqual([10, 40, 20]);
      // Confirm the builder didn't alias the readonly source array into the
      // config — mutating the returned array must not bleed into fixtures.
      expect(out.productUsage.data.labels).not.toBe(FIXTURE.trends.productUsage.categories);
    });

    it('pre-computes pointRadius so the peak is 5 and every other point is 0', () => {
      // Replaces the old per-tick `Math.max(...data)` callback: the peak index
      // is computed once at build time, yielding a plain array Chart.js can
      // consume without re-evaluating on each render frame.
      const out = buildStatsChartsConfigs(FIXTURE, PALETTE);
      const ds = out.productUsage.data.datasets?.[0];
      expect(ds?.pointRadius).toEqual([0, 5, 0]);
    });

    it('wires palette colors to stroke, fill, and point slots', () => {
      const out = buildStatsChartsConfigs(FIXTURE, PALETTE);
      const ds = out.productUsage.data.datasets?.[0];
      expect(ds?.borderColor).toBe(PALETTE.line.stroke);
      expect(ds?.backgroundColor).toBe(PALETTE.line.fill);
      expect(ds?.pointBackgroundColor).toBe(PALETTE.line.point);
      expect(ds?.pointBorderColor).toBe(PALETTE.line.point);
    });

    it('hides legend and tooltip — the card label carries the context instead', () => {
      const out = buildStatsChartsConfigs(FIXTURE, PALETTE);
      expect(out.productUsage.options.plugins?.legend?.display).toBe(false);
      expect(out.productUsage.options.plugins?.tooltip?.enabled).toBe(false);
    });

    it('hides the y-axis and all grid lines (sparkline-style)', () => {
      const out = buildStatsChartsConfigs(FIXTURE, PALETTE);
      const scales = out.productUsage.options.scales;
      expect(scales?.['y']?.display).toBe(false);
      // x-axis grid is hidden too; only the tick labels remain.
      expect((scales?.['x'] as { grid?: { display?: boolean } })?.grid?.display).toBe(false);
    });
  });

  describe('bar (totalPurchases)', () => {
    it('applies the configured yMax when provided', () => {
      const out = buildStatsChartsConfigs(FIXTURE, PALETTE);
      expect((out.totalPurchases.options.scales?.['y'] as { max?: number })?.max).toBe(600);
    });

    it('omits the `max` key entirely when yMax is undefined (auto-fit)', () => {
      // Presence of an explicit `undefined` would still defeat Chart.js
      // auto-scaling in some versions — the conditional spread guarantees
      // the property is absent from the options object.
      const src: StatsCharts = {
        ...FIXTURE,
        trends: {
          ...FIXTURE.trends,
          totalPurchases: {
            ...FIXTURE.trends.totalPurchases,
            yMax: undefined,
          },
        },
      };
      const out = buildStatsChartsConfigs(src, PALETTE);
      const y = out.totalPurchases.options.scales?.['y'] as Record<string, unknown>;
      expect('max' in y).toBe(false);
    });

    it('wires palette.bar.fill and palette.bar.hoverFill to the dataset', () => {
      const out = buildStatsChartsConfigs(FIXTURE, PALETTE);
      const ds = out.totalPurchases.data.datasets?.[0];
      expect(ds?.backgroundColor).toBe(PALETTE.bar.fill);
      expect(ds?.hoverBackgroundColor).toBe(PALETTE.bar.hoverFill);
    });

    it('uses palette.tick for axis labels and palette.grid for y-axis grid lines', () => {
      const out = buildStatsChartsConfigs(FIXTURE, PALETTE);
      const x = out.totalPurchases.options.scales?.['x'] as {
        ticks?: { color?: string };
      };
      const y = out.totalPurchases.options.scales?.['y'] as {
        ticks?: { color?: string };
        grid?: { color?: string };
      };
      expect(x.ticks?.color).toBe(PALETTE.tick);
      expect(y.ticks?.color).toBe(PALETTE.tick);
      expect(y.grid?.color).toBe(PALETTE.grid);
    });
  });

  it('is deterministic — equal inputs produce structurally equal outputs', () => {
    // The builder is a pure function of (source, palette). Two independent
    // invocations must never diverge; any divergence would indicate hidden
    // state (Date.now(), Math.random(), module-scoped caches, etc.).
    const a = buildStatsChartsConfigs(FIXTURE, PALETTE);
    const b = buildStatsChartsConfigs(FIXTURE, PALETTE);
    expect(a).toEqual(b);
  });
});
