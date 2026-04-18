import type { StatsPalette } from './stats-charts-builder';

/**
 * Resolve any browser-understood CSS color expression to a canvas-consumable
 * string.
 *
 * Chart.js paints via canvas 2D, whose color parser accepts only classic
 * forms (named / `#rgb[a]` / `rgb[a]()` / `hsl[a]()`). Modern functions —
 * `color-mix()`, `oklch()`, `color()`, relative color syntax — are silently
 * coerced to transparent black. We sidestep this by letting the browser
 * resolve the expression through CSS computed style, which is guaranteed to
 * return one of the classic forms regardless of how the token was authored.
 *
 * A fresh `<span>` is appended out-of-flow and removed synchronously so it
 * never interferes with layout or is observed by the user.
 */
export function resolveCssColor(doc: Document, css: string): string {
  const probe = doc.createElement('span');
  probe.style.color = css;
  probe.style.display = 'none';
  doc.body.appendChild(probe);
  const resolved = doc.defaultView?.getComputedStyle(probe).color ?? css;
  probe.remove();
  return resolved;
}

/**
 * Build the chart palette from design tokens for the current theme.
 *
 * Token names are passed as CSS `var()` expressions rather than resolved
 * hex/oklch so the resolver handles both: (a) custom properties that are
 * already painted colors, and (b) `color-mix` tints layered on top — the
 * latter is used for the filled area under the line chart.
 *
 * Rationale for `color-mix(in srgb, var(...) 15%, transparent)` instead of
 * string-concatenating a hex alpha suffix:
 *   - Robust to any future Aura preset that emits `oklch()` or `hsl()`.
 *   - The alpha ratio is expressed as a percentage in CSS where it belongs,
 *     not as a two-hex-digit magic number scattered through TS.
 *   - The browser does the math once during computed style; the canvas
 *     receives the baked-in result and never has to parse `color-mix`.
 */
export function resolveStatsPalette(
  doc: Document,
  dark: boolean,
): StatsPalette {
  const r = (css: string): string => resolveCssColor(doc, css);
  return {
    gauge: {
      value: r('var(--p-primary-500)'),
      track: r(dark ? 'var(--p-surface-800)' : 'var(--p-surface-200)'),
    },
    line: {
      stroke: r('var(--p-primary-500)'),
      fill: r('color-mix(in srgb, var(--p-primary-400) 15%, transparent)'),
      point: r('var(--p-primary-500)'),
    },
    bar: {
      fill: r(dark ? 'var(--p-surface-800)' : 'var(--p-surface-200)'),
      hoverFill: r('var(--p-primary-400)'),
    },
    tick: r(dark ? 'var(--p-surface-500)' : 'var(--p-surface-400)'),
    grid: r(dark ? 'var(--p-surface-800)' : 'var(--p-surface-100)'),
  };
}
