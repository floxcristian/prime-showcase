#!/usr/bin/env node
// @ts-check
/**
 * @fileoverview Brand-conformance gate for the Implementos palette.
 *
 * **What problem this solves**
 *
 * `sync.mjs` already proves that DESIGN.md and `tokens.json` agree with
 * `app.preset.ts`. But all three could agree on the *wrong* colors: nothing
 * checked the preset against the brand, and nothing recomputed the WCAG
 * ratios DESIGN.md advertises. Those ratios were measured once, by hand, and
 * three of them were already stale by the time this file was written (the
 * preset's own comment cited `#52525b` for a token that resolves to
 * `#475569`, and claimed 5.9:1 for a pair that actually measured 7.5:1).
 *
 * So this gate asserts two things `sync.mjs` structurally cannot:
 *
 *   1. **Derivation.** Every shade of every brand ramp is reproducible from
 *      its Pantone anchor via `color.mjs`. Hand-tweak one shade and CI says
 *      so. The palette is *generated*, and this is the proof.
 *
 *   2. **Contrast.** Every pair the design system leans on is recomputed
 *      from the preset and checked against its WCAG floor. The numbers in
 *      DESIGN.md stop being a claim and become an output.
 *
 * **Why anchors live here and not in the preset**
 *
 * The preset is what the app *runs*; this file is what the brand *mandates*.
 * Keeping them separate is the whole point — if they were one file there
 * would be nothing to check. The anchors below are transcribed from
 * "PALETA DE COLOR PRIMARIA", `docs/implementos/Brand book Implementos
 * 2026.pdf`, and independently corroborated against the fill operators of
 * the PDF's own painted swatches.
 *
 * **Exit codes**: 0 conforms · 1 drift or contrast failure · 2 IO error.
 *
 * Usage:
 *   `node tools/design-tokens/brand.mjs`           — check (CI)
 *   `node tools/design-tokens/brand.mjs --report`  — print ramps + matrix
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { AppPreset } from '../../src/app/app.preset.ts';
import { exportTokens } from './resolver.mjs';
import {
  buildRamp,
  contrastRatio,
  formatRatio,
  wcagLevel,
  describeOklch,
  SHADES,
  NEUTRAL_L_TARGETS,
  NEUTRAL_C_ENVELOPE,
} from './color.mjs';

const args = process.argv.slice(2);
const REPORT = args.includes('--report');

/* ═══════════════════════════════════════════════════════════════════════
 * 1. Brand anchors — the normative input
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * The four colors of "PALETA DE COLOR PRIMARIA" (brand book 2026, cap. 03).
 * White is the fourth and lives at `surface.0`.
 *
 * `docs/implementos/logo.svg` as delivered carried `#0545BA` / `#059868`
 * instead. Those were NOT adopted: the brand book's declared palette is
 * normative for the product UI, and the logo artwork rendered inside the
 * brand book itself (cap. 02, every page) paints `#006DB6` / `#00937F` —
 * so the manual's own depiction of the logo agrees with the manual's own
 * palette. The delivered SVG's structural fix was kept; its tones were
 * brought back to these values. Ref: ADR-002.
 */
const BRAND_ANCHORS = /** @type {const} */ ({
  primary: {
    hex: '#006db6',
    pantone: 'PANTONE 300 U',
    role: 'Azul base',
    build: () => buildRamp({ anchor: '#006db6' }),
  },
  accent: {
    hex: '#00937f',
    pantone: 'PANTONE 334 U',
    role: 'Verde acento',
    build: () => buildRamp({ anchor: '#00937f' }),
  },
  surface: {
    hex: '#636569',
    pantone: 'PANTONE Cool Gray 10 C',
    role: 'Gris neutro',
    build: () => ({
      0: '#ffffff',
      ...buildRamp({
        anchor: '#636569',
        lTargets: NEUTRAL_L_TARGETS,
        cEnvelope: NEUTRAL_C_ENVELOPE,
      }),
    }),
  },
});

/* ═══════════════════════════════════════════════════════════════════════
 * 2. Contrast contract
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * Token paths resolve against {@link exportTokens} output:
 *   `primary.500` · `accent.600` · `surface.light.200` · `surface.dark.950`
 * A leading `#` is taken as a literal.
 *
 * `min` is the WCAG floor this pair must clear. `target` only affects how
 * the level is *labelled* ('ui' pairs are non-text, where 3:1 is the bar).
 *
 * `note: 'informational'` records a pair we measure and print but do not
 * gate — see the focus-ring entry for why.
 */
const CONTRAST_PAIRS = [
  // ── Light ────────────────────────────────────────────────────────────
  { label: 'primary.500 sobre surface.0 (link / texto acento)', fg: 'primary.500', bg: 'surface.light.0', min: 4.5 },
  { label: 'primary.contrast (#fff) sobre primary.500 (bg-primary)', fg: '#ffffff', bg: 'primary.500', min: 4.5 },
  { label: 'primary.600 sobre surface.0 (hover de link)', fg: 'primary.600', bg: 'surface.light.0', min: 4.5 },
  { label: 'primary.700 sobre surface.0 (active)', fg: 'primary.700', bg: 'surface.light.0', min: 4.5 },
  { label: 'primary.700 sobre primary.100 (variante tonal)', fg: 'primary.700', bg: 'primary.100', min: 4.5 },
  { label: 'text-color (surface.700) sobre surface.0 (body)', fg: 'surface.light.700', bg: 'surface.light.0', min: 7 },
  { label: 'text-muted (surface.600) sobre surface.0', fg: 'surface.light.600', bg: 'surface.light.0', min: 4.5 },
  { label: 'text-muted (surface.600) sobre surface.200 (hover)', fg: 'surface.light.600', bg: 'surface.light.200', min: 4.5 },
  { label: 'text-muted (surface.600) sobre surface.100 (togglebutton)', fg: 'surface.light.600', bg: 'surface.light.100', min: 4.5 },
  { label: 'accent.500 sobre surface.0 — SOLO relleno/UI', fg: 'accent.500', bg: 'surface.light.0', min: 3, target: 'ui' },
  { label: 'accent.600 sobre surface.0 (minimo para texto)', fg: 'accent.600', bg: 'surface.light.0', min: 4.5 },
  { label: 'accent.700 sobre surface.0 (texto acento fuerte)', fg: 'accent.700', bg: 'surface.light.0', min: 7 },

  // ── Dark ─────────────────────────────────────────────────────────────
  { label: 'primary.400 sobre surface.950 (primary en dark)', fg: 'primary.400', bg: 'surface.dark.950', min: 4.5 },
  { label: 'primary.contrast (surface.900) sobre primary.400', fg: 'surface.dark.900', bg: 'primary.400', min: 4.5 },
  { label: 'text-color (surface.0) sobre surface.950 (body dark)', fg: 'surface.dark.0', bg: 'surface.dark.950', min: 7 },
  { label: 'text-muted (surface.300) sobre surface.950', fg: 'surface.dark.300', bg: 'surface.dark.950', min: 4.5 },
  { label: 'text-muted (surface.300) sobre surface.700 (hover dark)', fg: 'surface.dark.300', bg: 'surface.dark.700', min: 4.5 },
  { label: 'primary.100 sobre primary.900 (tonal dark)', fg: 'primary.100', bg: 'primary.900', min: 4.5 },
  { label: 'accent.400 sobre surface.950 (texto acento dark)', fg: 'accent.400', bg: 'surface.dark.950', min: 4.5 },

  // ── No-texto ─────────────────────────────────────────────────────────
  { label: 'primary.500 (borde de form field) sobre surface.0', fg: 'primary.500', bg: 'surface.light.0', min: 3, target: 'ui' },
  {
    label: 'focus ring halo (primary.200) sobre surface.0',
    fg: 'primary.200',
    bg: 'surface.light.0',
    target: 'ui',
    note: 'informational',
    // Deuda PREEXISTENTE, no una regresion de este cambio: el halo anterior
    // (#b2ddf9) medía exactamente el mismo 1.4:1. Es una propiedad del focus
    // ring halo-only estilo Lara que DESIGN.md documenta como decision. No
    // incumple WCAG 2.1 AA — 2.4.7 (Focus Visible) solo exige que se vea;
    // el umbral de 3:1 es 2.4.11 (Focus Appearance), AAA en WCAG 2.2.
    // Se mide y se reporta para que la deuda quede a la vista en cada corrida
    // en vez de vivir solo en la cabeza de alguien.
  },
];

/* ═══════════════════════════════════════════════════════════════════════
 * 3. Machinery
 * ══════════════════════════════════════════════════════════════════════ */

const RESET = '\x1b[0m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';

const tokens = exportTokens(AppPreset);

/**
 * @param {string} path
 * @returns {string}
 */
function resolveToken(path) {
  if (path.startsWith('#')) return path;
  const value = path.split('.').reduce(
    (acc, seg) => (acc == null ? undefined : acc[seg]),
    /** @type {any} */ (tokens),
  );
  if (typeof value !== 'string') {
    throw new Error(`No se pudo resolver el token "${path}" desde el preset`);
  }
  return value;
}

/** @type {string[]} */
const failures = [];

/* ── Check 1: derivation ─────────────────────────────────────────────── */

/**
 * Reads the ramp the preset actually ships for a given anchor name.
 * @param {'primary'|'accent'|'surface'} name
 */
function presetRamp(name) {
  if (name === 'surface') {
    // Light and dark must be the SAME ramp — the brand declares one gray.
    const { light, dark } = /** @type {any} */ (tokens).surface;
    for (const shade of ['0', ...SHADES.map(String)]) {
      if (light[shade] !== dark[shade]) {
        failures.push(
          `surface.${shade}: light (${light[shade]}) y dark (${dark[shade]}) divergen — ` +
            `la marca declara UN gris, ambos modos comparten el ramp`,
        );
      }
    }
    return light;
  }
  return /** @type {any} */ (tokens)[name] ?? {};
}

function checkDerivation() {
  const report = [];
  for (const [name, anchor] of Object.entries(BRAND_ANCHORS)) {
    const derived = anchor.build();
    const actual = presetRamp(/** @type {any} */ (name));
    const shades = Object.keys(derived);

    for (const shade of shades) {
      const want = derived[shade].toLowerCase();
      const got = String(actual[shade] ?? '').toLowerCase();
      if (got !== want) {
        failures.push(
          `${name}.${shade}: el preset trae ${got || '(ausente)'} pero la derivacion ` +
            `desde ${anchor.pantone} (${anchor.hex}) da ${want}`,
        );
      }
    }

    // El shade ancla debe ser el Pantone EXACTO, no una aproximacion.
    const anchorShade = name === 'surface' ? '500' : '500';
    if (String(actual[anchorShade] ?? '').toLowerCase() !== anchor.hex) {
      failures.push(
        `${name}.${anchorShade} debe ser exactamente ${anchor.hex} (${anchor.pantone}), ` +
          `no ${actual[anchorShade]}`,
      );
    }

    report.push({ name, anchor, derived });
  }
  return report;
}

/* ── Check 2: contrast ───────────────────────────────────────────────── */

function checkContrast() {
  const rows = [];
  for (const pair of CONTRAST_PAIRS) {
    const fg = resolveToken(pair.fg);
    const bg = resolveToken(pair.bg);
    const ratio = contrastRatio(fg, bg);
    const level = wcagLevel(ratio, /** @type {any} */ (pair.target ?? 'normal'));
    const informational = pair.note === 'informational';
    const failed = !informational && pair.min != null && ratio < pair.min;
    if (failed) {
      failures.push(
        `contraste "${pair.label}": ${formatRatio(ratio)}:1 sobre ${fg}/${bg}, ` +
          `por debajo del minimo ${pair.min}:1`,
      );
    }
    rows.push({ ...pair, fg, bg, ratio, level, failed, informational });
  }
  return rows;
}

/* ── Check 3: assets y hexes literales fuera de la cascada ───────────── */

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');

/**
 * Superficies donde un color de marca vive como hex literal, fuera del
 * alcance de las CSS vars — y que por lo tanto ningun otro gate mira.
 *
 * Antes de esto eran drift silencioso puro: `sync.mjs` solo compara
 * DESIGN.md y tokens.json contra el preset, y ESLint no lee ni `.svg` ni
 * `.html` del `<head>`. El `theme-color` del index quedo tres correcciones
 * de paleta atras sin que nada chistara, y el fondo de marca (`tornado.svg`)
 * corria tres azules que no existian en ninguna paleta.
 *
 * `allow` es la lista COMPLETA de hexes de marca que el archivo puede
 * contener. Cualquier otro hex en la lista de `scan` es drift.
 */
const ASSET_CHECKS = [
  {
    file: 'src/index.html',
    label: 'meta theme-color',
    scan: /<meta\s+name="theme-color"\s+content="(#[0-9a-fA-F]{6})"/,
    expect: () => resolveToken('primary.500'),
  },
  {
    file: 'public/implementos-logo.svg',
    label: 'tonos del logotipo',
    allow: () => [resolveToken('primary.500'), resolveToken('accent.500'), '#fff', '#ffffff'],
  },
  {
    file: 'public/images/tornado.svg',
    label: 'fondo de marca (chrome + asides de auth)',
    // Cada parada de gradiente debe ser un shade exacto del ramp primary.
    allow: () => SHADES.map((s) => resolveToken(`primary.${s}`)),
  },
];

/** Hexes de 3 o 6 digitos, en cualquier caso. */
const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g;

function checkAssets() {
  const rows = [];
  for (const check of ASSET_CHECKS) {
    let source;
    try {
      source = readFileSync(resolve(REPO_ROOT, check.file), 'utf8');
    } catch {
      failures.push(`no pude leer ${check.file} para verificar ${check.label}`);
      continue;
    }

    if (check.scan) {
      const m = source.match(check.scan);
      const want = check.expect().toLowerCase();
      const got = (m?.[1] ?? '').toLowerCase();
      if (got !== want) {
        failures.push(
          `${check.file} (${check.label}): trae ${got || '(no encontrado)'} pero deberia ser ${want}`,
        );
      }
      rows.push({ file: check.file, label: check.label, detail: `${got} === ${want}`, ok: got === want });
      continue;
    }

    // Comentarios fuera: documentan el hex viejo a proposito.
    const body = source.replace(/<!--[\s\S]*?-->/g, '');
    const allowed = new Set(check.allow().map((h) => h.toLowerCase()));
    const found = [...new Set((body.match(HEX_RE) ?? []).map((h) => h.toLowerCase()))];
    const stray = found.filter((h) => !allowed.has(h));
    if (stray.length) {
      failures.push(
        `${check.file} (${check.label}): ${stray.join(', ')} no pertenece(n) a la paleta de marca`,
      );
    }
    rows.push({
      file: check.file,
      label: check.label,
      detail: `${found.length} hex, todos en paleta`,
      ok: stray.length === 0,
    });
  }
  return rows;
}

/* ── Report ──────────────────────────────────────────────────────────── */

const derivation = checkDerivation();
const contrast = checkContrast();
const assets = checkAssets();

if (REPORT) {
  console.log(`\n${BOLD}PALETA IMPLEMENTOS — derivada desde el brand book 2026${RESET}\n`);
  for (const { name, anchor, derived } of derivation) {
    console.log(
      `${BOLD}${name}${RESET} ${DIM}— ${anchor.role}, ${anchor.pantone} (${anchor.hex})${RESET}`,
    );
    for (const shade of Object.keys(derived)) {
      const isAnchor = derived[shade].toLowerCase() === anchor.hex;
      console.log(
        `   ${String(shade).padStart(3)}  ${derived[shade]}  ${DIM}${describeOklch(
          derived[shade],
        ).padEnd(32)}${RESET}${isAnchor ? `  ${GREEN}← ${anchor.pantone}${RESET}` : ''}`,
      );
    }
    console.log('');
  }

  console.log(`${BOLD}MATRIZ DE CONTRASTE WCAG 2.1${RESET}\n`);
  for (const row of contrast) {
    const mark = row.failed
      ? `${RED}FALLA${RESET}`
      : row.informational
        ? `${YELLOW}info ${RESET}`
        : `${GREEN}ok   ${RESET}`;
    console.log(
      `  ${mark} ${row.label.padEnd(58)} ${formatRatio(row.ratio).padStart(5)}:1  ${row.level}`,
    );
  }
  console.log('');

  console.log(`${BOLD}HEXES LITERALES FUERA DE LA CASCADA DE TOKENS${RESET}\n`);
  for (const row of assets) {
    console.log(
      `  ${row.ok ? `${GREEN}ok   ${RESET}` : `${RED}FALLA${RESET}`} ${row.file.padEnd(32)} ` +
        `${DIM}${row.label.padEnd(38)}${RESET} ${row.detail}`,
    );
  }
  console.log('');
}

if (failures.length > 0) {
  console.error(`\n${RED}${BOLD}Conformidad de marca: ${failures.length} problema(s)${RESET}\n`);
  for (const f of failures) console.error(`  ${RED}✗${RESET} ${f}`);
  console.error(
    `\n${DIM}El preset debe derivarse de los anchors Pantone del brand book.` +
      `\nPara ver la paleta esperada: node tools/design-tokens/brand.mjs --report${RESET}\n`,
  );
  process.exit(1);
}

if (!REPORT) {
  const gated = contrast.filter((r) => !r.informational).length;
  console.log(
    `[brand] conformidad OK — 3 ramps derivados de sus anchors Pantone, ` +
      `${gated} pares de contraste sobre el minimo, ${assets.length} assets en paleta.`,
  );
}
