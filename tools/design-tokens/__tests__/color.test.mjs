// @ts-check
/**
 * Unit tests for tools/design-tokens/color.mjs.
 *
 * Two things are being pinned here, and they fail differently.
 *
 *   1. **The math.** sRGB↔OKLCH and WCAG contrast are the arithmetic every
 *      accessibility claim in DESIGN.md now rests on. A regression here
 *      does not throw — it silently reports a passing ratio for a pair
 *      that actually fails, which is worse than no gate at all. So the
 *      conversions are checked against values computable by hand
 *      (white/black luminance, the 21:1 extreme) and against round-trips.
 *
 *   2. **The derivation.** `buildRamp` turns three Pantone anchors into 34
 *      shades. Those shades ship in `app.preset.ts`, so if the algorithm
 *      drifts, the brand gate would happily re-derive a *different* palette
 *      and declare the preset wrong. Pinning the expected output here means
 *      an accidental change to the lightness curve or chroma envelope shows
 *      up as a failing unit test, not as 34 confusing "drift" lines.
 *
 * Run: `node --test tools/design-tokens/__tests__/color.test.mjs`
 * Wired into `npm run design-tokens:test`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  hexToRgb,
  rgbToHex,
  relativeLuminance,
  contrastRatio,
  formatRatio,
  wcagLevel,
  hexToOklch,
  oklchToHex,
  buildRamp,
  describeOklch,
  SHADES,
  NEUTRAL_L_TARGETS,
  NEUTRAL_C_ENVELOPE,
} from '../color.mjs';

/* ── hex ↔ rgb ─────────────────────────────────────────────────────── */

test('hexToRgb parses 6-digit hex to unit channels', () => {
  assert.deepEqual(hexToRgb('#ffffff'), [1, 1, 1]);
  assert.deepEqual(hexToRgb('#000000'), [0, 0, 0]);
  const [r, g, b] = hexToRgb('#006db6');
  assert.equal(r, 0);
  assert.ok(Math.abs(g - 109 / 255) < 1e-9);
  assert.ok(Math.abs(b - 182 / 255) < 1e-9);
});

test('hexToRgb expands 3-digit shorthand and tolerates a missing #', () => {
  assert.deepEqual(hexToRgb('#fff'), hexToRgb('#ffffff'));
  assert.deepEqual(hexToRgb('006db6'), hexToRgb('#006db6'));
});

test('hexToRgb rejects malformed input instead of coercing it', () => {
  // Silent coercion here would mean a typo'd token resolves to *some*
  // color and the contrast gate happily measures the wrong thing.
  assert.throws(() => hexToRgb('#gggggg'), /Not a hex color/);
  assert.throws(() => hexToRgb('#12345'), /Not a hex color/);
  assert.throws(() => hexToRgb(''), /Not a hex color/);
});

test('rgbToHex round-trips and clamps out-of-range channels', () => {
  assert.equal(rgbToHex(hexToRgb('#006db6')), '#006db6');
  assert.equal(rgbToHex([-1, 0.5, 2]), '#0080ff');
});

/* ── WCAG ──────────────────────────────────────────────────────────── */

test('relativeLuminance anchors at the spec extremes', () => {
  assert.equal(relativeLuminance('#ffffff'), 1);
  assert.equal(relativeLuminance('#000000'), 0);
});

test('contrastRatio is symmetric and bounded by 21:1', () => {
  assert.ok(Math.abs(contrastRatio('#ffffff', '#000000') - 21) < 1e-9);
  assert.equal(contrastRatio('#000000', '#ffffff'), contrastRatio('#ffffff', '#000000'));
  assert.equal(contrastRatio('#006db6', '#006db6'), 1);
});

test('contrastRatio reproduces the brand anchors', () => {
  // Los tres valores que gobiernan la paleta. Si estos se mueven, se movio
  // la matematica — no la paleta.
  assert.equal(formatRatio(contrastRatio('#006db6', '#ffffff')), '5.4');
  assert.equal(formatRatio(contrastRatio('#00937f', '#ffffff')), '3.8');
  assert.equal(formatRatio(contrastRatio('#636569', '#ffffff')), '5.8');
});

test('formatRatio truncates instead of rounding', () => {
  // 4.49 debe reportarse 4.4, nunca 4.5: redondear hacia arriba haria que
  // un par que NO cumple AA se documente como si cumpliera.
  assert.equal(formatRatio(4.499), '4.4');
  assert.equal(formatRatio(4.5), '4.5');
  assert.equal(formatRatio(21), '21.0');
});

test('wcagLevel applies the right threshold per target', () => {
  assert.equal(wcagLevel(7.1), 'AAA');
  assert.equal(wcagLevel(4.5), 'AA');
  assert.equal(wcagLevel(3.2), 'AA-large');
  assert.equal(wcagLevel(2.9), 'fail');
  // Componentes de UI y texto grande: el piso es 3:1, no 4.5:1.
  assert.equal(wcagLevel(3.2, 'ui'), 'AA');
  assert.equal(wcagLevel(2.9, 'ui'), 'fail');
  assert.equal(wcagLevel(4.6, 'large'), 'AAA');
});

/* ── OKLCH ─────────────────────────────────────────────────────────── */

test('hexToOklch places achromatic colors at zero chroma', () => {
  assert.ok(Math.abs(hexToOklch('#ffffff').L - 1) < 1e-3);
  assert.ok(hexToOklch('#ffffff').C < 1e-3);
  assert.ok(hexToOklch('#808080').C < 1e-3);
});

test('hexToOklch measures the brand anchors', () => {
  const blue = hexToOklch('#006db6');
  assert.ok(Math.abs(blue.L - 0.522) < 0.002, `L=${blue.L}`);
  assert.ok(Math.abs(blue.h - 248.2) < 0.5, `h=${blue.h}`);

  const green = hexToOklch('#00937f');
  assert.ok(Math.abs(green.L - 0.594) < 0.002, `L=${green.L}`);
  assert.ok(Math.abs(green.h - 178.6) < 0.5, `h=${green.h}`);
});

test('oklchToHex round-trips in-gamut colors', () => {
  for (const hex of ['#006db6', '#00937f', '#636569', '#f0f7ff', '#001831']) {
    assert.equal(oklchToHex(hexToOklch(hex)), hex);
  }
});

test('oklchToHex reduces chroma to reach gamut instead of clipping channels', () => {
  // Croma imposible en sRGB para ese hue/lightness. Clipear canales rotaria
  // el hue (visible justo en los azules saturados, que es nuestro caso);
  // bajar croma lo preserva.
  const requested = { L: 0.52, C: 0.4, h: 248.2 };
  const hex = oklchToHex(requested);
  const got = hexToOklch(hex);
  assert.ok(got.C < requested.C, 'debe haber bajado el croma');
  assert.ok(Math.abs(got.h - requested.h) < 2, `hue preservado, got ${got.h}`);
  assert.ok(Math.abs(got.L - requested.L) < 0.02, `lightness preservada, got ${got.L}`);
});

test('describeOklch renders a readable triple', () => {
  assert.match(describeOklch('#006db6'), /^oklch\(52\.2% 0\.14\d+ 248\.2deg\)$/);
});

/* ── Ramp derivation ───────────────────────────────────────────────── */

const PRIMARY = buildRamp({ anchor: '#006db6' });
const ACCENT = buildRamp({ anchor: '#00937f' });
const NEUTRAL = buildRamp({
  anchor: '#636569',
  lTargets: NEUTRAL_L_TARGETS,
  cEnvelope: NEUTRAL_C_ENVELOPE,
});

test('buildRamp emits exactly the 11 canonical shades', () => {
  assert.deepEqual(Object.keys(PRIMARY), SHADES.map(String));
});

test('buildRamp reproduces the anchor verbatim at its shade', () => {
  // Innegociable: bg-primary tiene que SER el Pantone, no una re-derivacion
  // que redondee al hex de al lado.
  assert.equal(PRIMARY['500'], '#006db6');
  assert.equal(ACCENT['500'], '#00937f');
  assert.equal(NEUTRAL['500'], '#636569');
});

test('buildRamp honours a non-default anchor shade', () => {
  const ramp = buildRamp({ anchor: '#006db6', anchorShade: 600 });
  assert.equal(ramp['600'], '#006db6');
  assert.notEqual(ramp['500'], '#006db6');
});

test('ramps decrease monotonically in perceived lightness', () => {
  for (const [name, ramp] of [['primary', PRIMARY], ['accent', ACCENT], ['neutral', NEUTRAL]]) {
    const ls = SHADES.map((s) => hexToOklch(ramp[String(s)]).L);
    for (let i = 1; i < ls.length; i++) {
      assert.ok(
        ls[i] < ls[i - 1],
        `${name}: shade ${SHADES[i]} (L=${ls[i].toFixed(3)}) no es mas oscuro que ${SHADES[i - 1]} (L=${ls[i - 1].toFixed(3)})`,
      );
    }
  }
});

test('brand ramps hold a single hue across every shade', () => {
  // La promesa del ramp: un solo hue de punta a punta. Se verifica solo en
  // primary y accent — el neutro corre C≈0.007, donde la cuantizacion a 8
  // bits mueve el hue reportado sin que el color cambie de forma percibible.
  for (const [name, ramp, expected] of [
    ['primary', PRIMARY, 248.2],
    ['accent', ACCENT, 178.6],
  ]) {
    for (const shade of SHADES) {
      const { h } = hexToOklch(ramp[String(shade)]);
      assert.ok(
        Math.abs(h - expected) < 4,
        `${name}.${shade}: hue ${h.toFixed(1)}° se aparta de ${expected}°`,
      );
    }
  }
});

test('the neutral ramp stays effectively achromatic', () => {
  for (const shade of SHADES) {
    const { C } = hexToOklch(NEUTRAL[String(shade)]);
    assert.ok(C < 0.012, `neutral.${shade}: croma ${C.toFixed(4)} demasiado alto para un gris`);
  }
});

test('derivation output is pinned to what app.preset.ts ships', () => {
  // Este es el candado. `brand.mjs` compara el preset contra esta derivacion;
  // si el algoritmo cambiara sin querer, ese gate igual pasaria (compara dos
  // cosas que se movieron juntas). Fijar los literales acá lo hace imposible.
  assert.deepEqual(PRIMARY, {
    50: '#f0f7ff',
    100: '#d9ecff',
    200: '#b1d8ff',
    300: '#7abbf8',
    400: '#4496de',
    500: '#006db6',
    600: '#005996',
    700: '#004678',
    800: '#00355d',
    900: '#002646',
    950: '#001831',
  });
  assert.deepEqual(ACCENT, {
    50: '#ebfbf6',
    100: '#d4f4ec',
    200: '#afe6d9',
    300: '#7fd1bf',
    400: '#49b5a1',
    500: '#00937f',
    600: '#007666',
    700: '#005c4f',
    800: '#00443a',
    900: '#003028',
    950: '#001d17',
  });
  assert.deepEqual(NEUTRAL, {
    50: '#f9fafb',
    100: '#f2f3f6',
    200: '#e2e4e7',
    300: '#ced0d4',
    400: '#97999d',
    500: '#636569',
    600: '#484a4e',
    700: '#37393d',
    800: '#232427',
    900: '#151619',
    950: '#07080a',
  });
});

test('every gated contrast pair of the design system clears its floor', () => {
  // Espejo en unit test de la matriz de brand.mjs, sobre los literales de
  // arriba. Corre sin importar el preset (que es TS), asi que sigue siendo
  // util aun donde el type-stripping de Node no este disponible.
  const W = '#ffffff';
  /** @type {[string, string, string, number][]} */
  const pairs = [
    ['primary.500 / surface.0', PRIMARY['500'], W, 4.5],
    ['#fff / primary.500', W, PRIMARY['500'], 4.5],
    ['primary.700 / primary.100', PRIMARY['700'], PRIMARY['100'], 4.5],
    ['primary.400 / surface.950', PRIMARY['400'], NEUTRAL['950'], 4.5],
    ['surface.600 / surface.0', NEUTRAL['600'], W, 4.5],
    ['surface.600 / surface.200', NEUTRAL['600'], NEUTRAL['200'], 4.5],
    ['surface.300 / surface.950', NEUTRAL['300'], NEUTRAL['950'], 4.5],
    ['accent.600 / surface.0', ACCENT['600'], W, 4.5],
    ['accent.400 / surface.950', ACCENT['400'], NEUTRAL['950'], 4.5],
    ['accent.500 / surface.0 (UI)', ACCENT['500'], W, 3],
  ];
  for (const [label, fg, bg, min] of pairs) {
    const ratio = contrastRatio(fg, bg);
    assert.ok(ratio >= min, `${label}: ${formatRatio(ratio)}:1 por debajo de ${min}:1`);
  }
});
