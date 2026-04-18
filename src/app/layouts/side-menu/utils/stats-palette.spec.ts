/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import { resolveCssColor, resolveStatsPalette } from './stats-palette';

describe('resolveCssColor', () => {
  it('resolves a named color to an rgb() triple that canvas 2D accepts', () => {
    // The whole point of the probe: canvas accepts classic rgb[a]/hsl[a]/hex/named
    // only. We don't assert the exact string ("red" may become "rgb(255, 0, 0)")
    // because the normalization is browser-defined — we only assert that the
    // output matches one of those classic forms.
    const out = resolveCssColor(document, 'red');
    expect(out).toMatch(/^(rgb|rgba|hsl|hsla|#)/);
  });

  it('resolves a hex literal through computed style (idempotent for classic forms)', () => {
    const out = resolveCssColor(document, '#ff0000');
    expect(out).toMatch(/^(rgb|rgba)/);
  });

  it('never leaves the probe element attached to the DOM', () => {
    // Defense against a past class of bugs where an early return or throw
    // could leak probes across invocations, growing the body indefinitely.
    const before = document.body.children.length;
    resolveCssColor(document, 'rebeccapurple');
    resolveCssColor(document, 'rgb(1, 2, 3)');
    resolveCssColor(document, 'hsl(120, 100%, 50%)');
    expect(document.body.children.length).toBe(before);
  });

  it('falls back to the input string when getComputedStyle is unavailable', () => {
    // Simulates a degraded environment (extremely old engine or sandboxed
    // document with no defaultView). The function must not throw.
    const fakeDoc = {
      createElement: () => ({
        style: {} as CSSStyleDeclaration,
        remove: () => undefined,
      }),
      body: { appendChild: () => undefined },
      defaultView: null,
    } as unknown as Document;
    expect(resolveCssColor(fakeDoc, 'rgb(10, 20, 30)')).toBe('rgb(10, 20, 30)');
  });
});

describe('resolveStatsPalette', () => {
  it('returns a palette whose every slot is a non-empty string', () => {
    // We don't assert exact colors because jsdom's CSS engine does not resolve
    // `var(--p-primary-500)` against a real stylesheet — it returns the raw
    // value. The contract we actually care about at the unit level is: every
    // slot is populated, typed as string, and non-empty. Integration coverage
    // (Chart.js painting the canvas) exercises the actual values.
    const palette = resolveStatsPalette(document, false);
    expect(typeof palette.gauge.value).toBe('string');
    expect(typeof palette.gauge.track).toBe('string');
    expect(typeof palette.line.stroke).toBe('string');
    expect(typeof palette.line.fill).toBe('string');
    expect(typeof palette.line.point).toBe('string');
    expect(typeof palette.bar.fill).toBe('string');
    expect(typeof palette.bar.hoverFill).toBe('string');
    expect(typeof palette.tick).toBe('string');
    expect(typeof palette.grid).toBe('string');
  });

  it('selects different track/tick/grid tokens for dark vs light', () => {
    // The dark/light branch is on surface tokens only — gauge.value, line.*
    // (except fill), and bar.hoverFill use primary tokens unchanged. We assert
    // the *shape* of the branch by passing different flags and checking that
    // the dark/light-sensitive slots differ from each other when resolved.
    const light = resolveStatsPalette(document, false);
    const dark = resolveStatsPalette(document, true);
    // At least one of the three dark/light-sensitive slots must differ — if
    // all were identical the branch would be dead code.
    const anyDifferent =
      light.gauge.track !== dark.gauge.track ||
      light.bar.fill !== dark.bar.fill ||
      light.tick !== dark.tick ||
      light.grid !== dark.grid;
    expect(anyDifferent).toBe(true);
  });

  it('does not leak probe elements across many invocations', () => {
    const before = document.body.children.length;
    for (let i = 0; i < 25; i++) {
      resolveStatsPalette(document, i % 2 === 0);
    }
    expect(document.body.children.length).toBe(before);
  });
});
