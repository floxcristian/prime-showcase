// @ts-check
/**
 * @fileoverview Pure color science for the Implementos design system.
 *
 * **Why this exists**
 *
 * `DESIGN.md` claims a table of WCAG contrast ratios ("primary.500 sobre
 * surface.0 → 4.9:1 AA"). Until now nothing recomputed them — the numbers
 * were measured once by hand and could silently rot the next time somebody
 * nudged a shade. This module is the arithmetic those claims stand on, so
 * `contrast.mjs` can re-derive them from `app.preset.ts` on every CI run.
 *
 * It also derives the brand ramps themselves. The Implementos palette is
 * anchored on three Pantone conversions declared in the 2026 brand book:
 *
 *   - `#006DB6` (Pantone 300 U)        → azul base   → `primary.500`
 *   - `#00937F` (Pantone 334 U)        → verde acento → `accent.500`
 *   - `#636569` (Pantone Cool Gray 10 C) → gris neutro → `surface.500`
 *
 * A brand gives you one point per ramp; the other ten shades have to be
 * *derived*. Doing that in HSL — which is what most hand-built palettes do —
 * produces uneven ramps, because HSL lightness is not perceptual: `hsl(204,
 * 100%, 50%)` and `hsl(60, 100%, 50%)` differ by ~60 points of measured
 * lightness. We derive in **OKLCH** instead (the same space Tailwind 4 moved
 * to), where a constant step in `L` is a constant step in *perceived*
 * lightness. That is what makes `primary.600` read as "one notch darker than
 * 500" rather than "some darker blue".
 *
 * **Pure module.** No `fs`, no side effects — unit-testable with `node --test`
 * against known-good fixtures (see `__tests__/color.test.mjs`).
 */

/* -------------------------------------------------------------------------
 * sRGB ↔ linear light
 * ---------------------------------------------------------------------- */

/**
 * sRGB transfer function (gamma decode): companded channel → linear light.
 * The piecewise form is the sRGB spec's, not a plain 2.2 power curve.
 *
 * @param {number} c channel in [0,1]
 */
function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/**
 * Inverse transfer function: linear light → companded sRGB channel.
 *
 * @param {number} c linear channel in [0,1]
 */
function linearToSrgb(c) {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
}

/* -------------------------------------------------------------------------
 * hex ↔ rgb
 * ---------------------------------------------------------------------- */

/**
 * Parses `#rgb` or `#rrggbb` into channels in [0,1].
 *
 * @param {string} hex
 * @returns {[number, number, number]}
 */
export function hexToRgb(hex) {
  const h = hex.trim().replace(/^#/, '');
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    throw new Error(`Not a hex color: ${JSON.stringify(hex)}`);
  }
  const n = parseInt(full, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/**
 * Serialises channels in [0,1] to lowercase `#rrggbb`, clamping out-of-range
 * input rather than wrapping it.
 *
 * @param {[number, number, number]} rgb
 */
export function rgbToHex(rgb) {
  return (
    '#' +
    rgb
      .map((c) => {
        const v = Math.round(Math.min(1, Math.max(0, c)) * 255);
        return v.toString(16).padStart(2, '0');
      })
      .join('')
  );
}

/* -------------------------------------------------------------------------
 * WCAG 2.1 contrast
 * ---------------------------------------------------------------------- */

/**
 * WCAG 2.1 relative luminance (§ "relative luminance").
 *
 * @param {string} hex
 */
export function relativeLuminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(srgbToLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * WCAG 2.1 contrast ratio between two colors, order-independent.
 * Returns a number in [1, 21].
 *
 * Thresholds that matter here:
 *   - 4.5:1 → AA, texto normal
 *   - 3.0:1 → AA, texto grande (≥24px, o ≥19px bold) y componentes de UI
 *   - 7.0:1 → AAA, texto normal
 *
 * @param {string} a
 * @param {string} b
 */
export function contrastRatio(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Rounds a contrast ratio the way WCAG reporting tools do — one decimal,
 * truncated rather than rounded, so a 4.499 never reports as "4.5 AA".
 *
 * @param {number} ratio
 */
export function formatRatio(ratio) {
  return (Math.floor(ratio * 10) / 10).toFixed(1);
}

/**
 * Classifies a ratio against WCAG 2.1 thresholds for a given text size.
 *
 * @param {number} ratio
 * @param {'normal' | 'large' | 'ui'} [target]
 * @returns {'AAA' | 'AA' | 'AA-large' | 'fail'}
 */
export function wcagLevel(ratio, target = 'normal') {
  if (target === 'ui' || target === 'large') {
    if (ratio >= 4.5) return 'AAA';
    if (ratio >= 3) return 'AA';
    return 'fail';
  }
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return 'AA-large';
  return 'fail';
}

/* -------------------------------------------------------------------------
 * OKLab / OKLCH
 *
 * Björn Ottosson's Oklab (2020). Perceptually uniform, cheap to compute,
 * and the space CSS Color 4 / Tailwind 4 standardised on.
 * ---------------------------------------------------------------------- */

/**
 * linear sRGB → OKLab.
 *
 * @param {[number, number, number]} rgb linear-light channels
 * @returns {[number, number, number]} [L, a, b]
 */
function linearRgbToOklab([r, g, b]) {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  return [
    0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  ];
}

/**
 * OKLab → linear sRGB.
 *
 * @param {[number, number, number]} lab
 * @returns {[number, number, number]} linear-light channels (may be out of gamut)
 */
function oklabToLinearRgb([L, a, b]) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;

  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/**
 * hex → OKLCH. Hue is in degrees [0,360); chroma is unbounded but in
 * practice ≤ ~0.37 for sRGB.
 *
 * @param {string} hex
 * @returns {{ L: number, C: number, h: number }}
 */
export function hexToOklch(hex) {
  const lab = linearRgbToOklab(
    /** @type {[number, number, number]} */ (hexToRgb(hex).map(srgbToLinear)),
  );
  const [L, a, b] = lab;
  const C = Math.sqrt(a * a + b * b);
  let h = (Math.atan2(b, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { L, C, h };
}

/**
 * OKLCH → linear sRGB, without gamut handling.
 *
 * @param {{ L: number, C: number, h: number }} oklch
 * @returns {[number, number, number]}
 */
function oklchToLinearRgb({ L, C, h }) {
  const rad = (h * Math.PI) / 180;
  return oklabToLinearRgb([L, C * Math.cos(rad), C * Math.sin(rad)]);
}

/** Tolerance for "still inside sRGB" — one ~1/2000th of a channel. */
const GAMUT_EPS = 0.0005;

/**
 * @param {[number, number, number]} linear
 */
function inGamut(linear) {
  return linear.every((c) => c >= -GAMUT_EPS && c <= 1 + GAMUT_EPS);
}

/**
 * OKLCH → hex, reducing chroma until the color fits in sRGB.
 *
 * Naive clipping (clamp each channel to [0,1]) shifts hue visibly on
 * saturated blues — exactly our case, since `#006DB6` sits near the sRGB
 * blue boundary. Instead we binary-search the largest chroma that still
 * renders, holding L and h fixed. That keeps the ramp on one hue line,
 * which is the whole point of deriving in OKLCH.
 *
 * @param {{ L: number, C: number, h: number }} oklch
 */
export function oklchToHex({ L, C, h }) {
  const direct = oklchToLinearRgb({ L, C, h });
  if (inGamut(direct)) {
    return rgbToHex(
      /** @type {[number, number, number]} */ (direct.map(linearToSrgb)),
    );
  }
  let lo = 0;
  let hi = C;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut(oklchToLinearRgb({ L, C: mid, h }))) lo = mid;
    else hi = mid;
  }
  return rgbToHex(
    /** @type {[number, number, number]} */ (
      oklchToLinearRgb({ L, C: lo, h }).map(linearToSrgb)
    ),
  );
}

/* -------------------------------------------------------------------------
 * Ramp derivation
 * ---------------------------------------------------------------------- */

/** The 11 shades every PrimeNG/Tailwind-style palette carries. */
export const SHADES = /** @type {const} */ ([
  50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950,
]);

/**
 * Perceptual lightness targets, in OKLCH `L`, for each shade.
 *
 * Chosen so that:
 *   - `50` is a near-white tint that still reads as tinted (not `#fff`);
 *   - steps are close to evenly spaced in perceived lightness;
 *   - `950` stays above pure black so it can carry chroma.
 *
 * The anchor shade's entry is *replaced* by the brand color's own measured
 * `L` in {@link buildRamp}, and its neighbours are re-spaced around it, so
 * these are targets rather than hard values.
 */
const L_TARGETS = {
  50: 0.974,
  100: 0.939,
  200: 0.878,
  300: 0.792,
  400: 0.686,
  500: 0.567,
  600: 0.487,
  700: 0.41,
  800: 0.336,
  900: 0.272,
  950: 0.205,
};

/**
 * Lightness targets for the **neutral** ramp.
 *
 * Deliberately *not* the curve above. Surfaces are the substrate every other
 * color sits on, so their lightness rhythm is load-bearing in a way a brand
 * ramp's is not: `surface.200` is `bg-emphasis` (every hover in the design
 * system), `surface.600` is `text-muted-color`, `surface.950` is the dark
 * page. These values reproduce the curve Aura's slate/zinc already establish
 * — measured, not guessed, and near-identical to each other:
 *
 *   slate  98.4 96.8 92.9 86.9 71.1 55.4 44.6 37.2 27.9 20.8 12.9
 *   zinc   98.5 96.7 92.0 87.1 71.2 55.2 44.2 37.0 27.4 21.0 14.1
 *
 * Keeping the rhythm and swapping only hue + chroma is what makes the
 * neutral correction a *recolor* rather than a redesign: contrast ratios and
 * visual density carry over, and the diff is a brand fix instead of a
 * re-layout of every surface in the app.
 */
const NEUTRAL_L_TARGETS = {
  50: 0.984,
  100: 0.967,
  200: 0.925,
  300: 0.87,
  400: 0.712,
  500: 0.553,
  600: 0.444,
  700: 0.371,
  800: 0.277,
  900: 0.209,
  950: 0.135,
};

/**
 * Chroma envelope for **neutral** ramps.
 *
 * Flatter than {@link C_ENVELOPE}. A brand ramp wants its chroma to peak at
 * the anchor and fall away; a neutral wants its (already tiny) tint to read
 * as the *same* gray at every step. Cool Gray 10 C carries `C≈0.007` — two
 * orders of magnitude below the blue — so there is no gamut pressure to
 * taper for, and holding it steady is what stops `surface.700` from drifting
 * warm against `surface.300`.
 */
const NEUTRAL_C_ENVELOPE = {
  50: 0.35,
  100: 0.5,
  200: 0.7,
  300: 0.85,
  400: 0.95,
  500: 1.0,
  600: 1.0,
  700: 1.0,
  800: 0.95,
  900: 0.9,
  950: 0.8,
};

export { NEUTRAL_L_TARGETS, NEUTRAL_C_ENVELOPE };

/**
 * Chroma envelope, as a fraction of the anchor's chroma.
 *
 * Chroma cannot stay flat across a ramp: at `L≈0.97` no hue can hold the
 * chroma of a saturated mid-tone (there is simply no such color in sRGB —
 * or in human vision), and forcing it just makes `oklchToHex` clamp, which
 * silently flattens the top of the ramp. So we taper toward both ends —
 * strongest near the anchor, softest at the tint and shade extremes. This
 * is the same shape Tailwind's and Radix's hand-tuned ramps exhibit when
 * you measure them.
 */
const C_ENVELOPE = {
  50: 0.16,
  100: 0.32,
  200: 0.55,
  300: 0.78,
  400: 0.95,
  500: 1.0,
  600: 0.98,
  700: 0.9,
  800: 0.78,
  900: 0.66,
  950: 0.53,
};

/**
 * Derives an 11-shade ramp from a single brand color.
 *
 * The anchor shade reproduces the brand hex **exactly** (byte-for-byte, not
 * "close enough") — that is non-negotiable: `bg-primary` has to BE Pantone
 * 300 U, not a re-derivation of it. Every other shade shares the anchor's
 * hue and follows the lightness/chroma curves above.
 *
 * When the anchor's own lightness differs from its slot's target — `#006DB6`
 * measures `L≈0.475` where shade 500 nominally wants `0.567` — the ramp is
 * *rescaled* rather than merely substituted: shades lighter than the anchor
 * are compressed into `[anchorL, L(50)]` and darker ones into `[L(950),
 * anchorL]`, both preserving relative spacing. Without that, the anchor
 * would sit unevenly between its neighbours and the ramp would visibly
 * stutter at exactly the shade people use most.
 *
 * @param {object} options
 * @param {string} options.anchor brand hex, reproduced verbatim at `anchorShade`
 * @param {50|100|200|300|400|500|600|700|800|900|950} [options.anchorShade]
 * @param {number} [options.hueShift] degrees added to the anchor hue (default 0)
 * @param {Record<number, number>} [options.lTargets] override lightness curve
 *   (see {@link NEUTRAL_L_TARGETS})
 * @param {Record<number, number>} [options.cEnvelope] override chroma envelope
 *   (see {@link NEUTRAL_C_ENVELOPE})
 * @returns {Record<string, string>} shade → hex
 */
export function buildRamp({
  anchor,
  anchorShade = 500,
  hueShift = 0,
  lTargets = L_TARGETS,
  cEnvelope = C_ENVELOPE,
}) {
  const base = hexToOklch(anchor);
  const hue = (base.h + hueShift + 360) % 360;

  const anchorTargetL = lTargets[anchorShade];
  const lightestL = lTargets[50];
  const darkestL = lTargets[950];

  /** @type {Record<string, string>} */
  const ramp = {};

  for (const shade of SHADES) {
    if (shade === anchorShade) {
      // Verbatim. The whole ramp exists to serve this one value.
      ramp[String(shade)] = anchor.toLowerCase();
      continue;
    }

    const targetL = lTargets[shade];

    // Rescale this shade's lightness so the anchor's measured L slots in
    // without disturbing the spacing of the rest.
    let L;
    if (targetL > anchorTargetL) {
      const t = (targetL - anchorTargetL) / (lightestL - anchorTargetL);
      L = base.L + t * (lightestL - base.L);
    } else {
      const t = (anchorTargetL - targetL) / (anchorTargetL - darkestL);
      L = base.L - t * (base.L - darkestL);
    }

    const C = base.C * (cEnvelope[shade] / cEnvelope[anchorShade]);
    ramp[String(shade)] = oklchToHex({ L, C, h: hue });
  }

  return ramp;
}

/**
 * Formats an OKLCH triple for documentation/debug output.
 *
 * @param {string} hex
 */
export function describeOklch(hex) {
  const { L, C, h } = hexToOklch(hex);
  return `oklch(${(L * 100).toFixed(1)}% ${C.toFixed(4)} ${h.toFixed(1)}deg)`;
}
