#!/usr/bin/env node
// @ts-check
/**
 * Codegen for the project's design-token-derived artifacts.
 *
 * **Mission**
 *
 * The repo has a long-standing drift hazard: spacing/rounded/typography
 * scales are written in three places — `DESIGN.md` (human view), the
 * ESLint rules in `tools/eslint/rules/*` (machine enforcement), and
 * Tailwind defaults via PostCSS plugin (browser runtime). When the
 * design system evolves, any of the three could drift silently.
 *
 * The same drift hazard exists for the project-extra tokens
 * (`PROJECT_TOKENS` in `app.preset.ts`): motion durations, z-index
 * ladder, density, elevation, avatar — documented in DESIGN.md but
 * never emitted as CSS vars consumable by templates.
 *
 * This script closes both gaps with a SINGLE source of truth:
 *
 *   src/app/app.preset.ts            ← edit here
 *      └─ PROJECT_TOKENS
 *            ├─ tools/design-tokens/codegen.mjs (this file)
 *            │     ├─ src/generated/tokens.css     (CSS vars + Tailwind @theme)
 *            │     └─ tools/eslint/rules/generated/scales.js
 *            └─ tools/design-tokens/sync.mjs (drift check, separate concern)
 *
 * **Two outputs**
 *
 *   1. `src/generated/tokens.css` — Tailwind `@theme` block emitting
 *      every PROJECT_TOKENS leaf as `--app-<group>-<key>` and the
 *      avatar tonal pair as per-mode overrides on `:root` / `.p-dark`.
 *      Tailwind v4 picks up `@theme` vars as utility classes
 *      automatically (e.g. `--app-motion-duration-fast` becomes
 *      `duration-(--app-motion-duration-fast)` usable in `transition`).
 *
 *   2. `tools/eslint/rules/generated/scales.js` — JS export consumed
 *      by `no-forbidden-spacing.js`, `no-forbidden-rounded.js`,
 *      `no-forbidden-typography.js`, and the new
 *      `no-arbitrary-duration.js`. Each rule reads its scale from
 *      this single source instead of hard-coding values.
 *
 * **Exit codes**: 0 success, 1 drift in --check mode, 2 IO error.
 *
 * Usage:
 *   `node tools/design-tokens/codegen.mjs`              — regenerate
 *   `node tools/design-tokens/codegen.mjs --check`      — fail if outputs
 *                                                          would differ
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PROJECT_TOKENS } from '../../src/app/app.preset.ts';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const TOKENS_CSS_PATH = resolve(REPO_ROOT, 'src/generated/tokens.css');
const SCALES_JS_PATH = resolve(
  REPO_ROOT,
  'tools/eslint/rules/generated/scales.js',
);

const args = process.argv.slice(2);
const CHECK = args.includes('--check');
const rel = (p) => relative(REPO_ROOT, p);

// ───────────────────────────────────────────────────────────────────────
// Scale data — the SOURCE for ESLint rules. Mirrors the values in the
// individual rule files today; centralising them is the whole point of
// this codegen. ESLint rules import from `./generated/scales.js`.
//
// Adding a new scale: add it here AND import in the relevant ESLint
// rule. The rule should treat scales.js as immutable data — never
// extend at runtime.
// ───────────────────────────────────────────────────────────────────────

const SCALES = {
  spacing: {
    gap: { allowed: [0, 1, 2, 3, 4, 5, 6, 8] },
    padding: { allowed: [0, 1, 2, 3, 4, 5, 6, 7] },
    margin: { allowed: [0, 1, 2, 4, 6] },
    exceptions: [
      'p-5',
      'gap-7',
      'gap-8',
      'py-8',
      'px-12',
      'p-[1px]',
      'mt-3',
      'mb-5',
      'mt-5',
      'mt-10',
    ],
  },
  rounded: {
    allowed: ['lg', 'xl', '2xl', '3xl', 'full', 'border'],
  },
  typography: {
    size: ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl'],
    weight: ['normal', 'medium', 'semibold', 'bold'],
    leading: ['none', 'tight', 'normal', '4', '5', '6', '7', '8'],
  },
  motion: {
    // Only `duration-<token>` from PROJECT_TOKENS.motion.duration is
    // allowed via Tailwind `--app-motion-duration-*`. Numeric Tailwind
    // duration classes (`duration-150`, `duration-200`, …) are
    // forbidden except for `<a>` text links (rule
    // no-arbitrary-duration enforces this).
    allowedDurationKeys: Object.keys(PROJECT_TOKENS.motion.duration),
    allowedEasingKeys: Object.keys(PROJECT_TOKENS.motion.easing),
  },
};

// ───────────────────────────────────────────────────────────────────────
// tokens.css emission
// ───────────────────────────────────────────────────────────────────────

/**
 * Resolves a `{primary.100}` style reference against the project tokens.
 * Project palettes (primary, surface) live in the Aura preset; consumers
 * already read them via `--p-primary-*`, so resolved values here just
 * point at those CSS vars instead of literal hex.
 */
function resolveAvatarRef(value) {
  if (typeof value !== 'string') return null;
  const m = value.match(/^\{(primary|surface)\.(\d+)\}$/);
  if (!m) return null;
  return `var(--p-${m[1]}-${m[2]})`;
}

function emitTokensCss() {
  const lines = [];
  lines.push(
    '/*',
    ' * AUTO-GENERATED — do not edit by hand.',
    ' * Source: src/app/app.preset.ts (PROJECT_TOKENS export).',
    ' * Generator: tools/design-tokens/codegen.mjs.',
    ' * Regenerate: `npm run design-tokens:codegen` (alias of `:sync -- --update`).',
    ' * Drift check: `npm run design-tokens:codegen -- --check`.',
    ' */',
    '',
    '@theme {',
  );

  // Motion duration + easing
  for (const [k, v] of Object.entries(PROJECT_TOKENS.motion.duration)) {
    lines.push(`  --app-motion-duration-${k}: ${v};`);
  }
  for (const [k, v] of Object.entries(PROJECT_TOKENS.motion.easing)) {
    lines.push(`  --app-motion-easing-${k}: ${v};`);
  }

  // Z-index ladder
  for (const [k, v] of Object.entries(PROJECT_TOKENS.zIndex)) {
    lines.push(`  --app-z-${k}: ${v};`);
  }

  // Density tokens — flat namespace per variant
  for (const [variant, group] of Object.entries(PROJECT_TOKENS.density)) {
    for (const [k, v] of Object.entries(group)) {
      lines.push(
        `  --app-density-${variant}-${kebab(k)}: ${v};`,
      );
    }
  }

  // Elevation — the documented exception
  for (const [k, v] of Object.entries(PROJECT_TOKENS.elevation)) {
    lines.push(`  --app-elevation-${kebab(k)}: ${v};`);
  }

  lines.push('}', '');

  // Avatar tonal — per-mode overrides at :root / .p-dark cascade
  const avatarBgLight = resolveAvatarRef(
    PROJECT_TOKENS.avatar.initialsBackground.light,
  );
  const avatarColorLight = resolveAvatarRef(
    PROJECT_TOKENS.avatar.initialsColor.light,
  );
  const avatarBgDark = resolveAvatarRef(
    PROJECT_TOKENS.avatar.initialsBackground.dark,
  );
  const avatarColorDark = resolveAvatarRef(
    PROJECT_TOKENS.avatar.initialsColor.dark,
  );

  lines.push(
    '/*',
    ' * Avatar tonal — consumed by `.app-avatar-initials` in styles.scss.',
    ' * Dark cascade flips via `.p-dark` on <html>, matching the rest of',
    ' * the design system (PrimeNG cssLayer + Tailwind @custom-variant).',
    ' */',
    ':root {',
    `  --app-avatar-initials-bg: ${avatarBgLight};`,
    `  --app-avatar-initials-color: ${avatarColorLight};`,
    '}',
    '.p-dark {',
    `  --app-avatar-initials-bg: ${avatarBgDark};`,
    `  --app-avatar-initials-color: ${avatarColorDark};`,
    '}',
    '',
  );

  return lines.join('\n');
}

function kebab(s) {
  return s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

// ───────────────────────────────────────────────────────────────────────
// scales.js emission
// ───────────────────────────────────────────────────────────────────────

function emitScalesJs() {
  return [
    '// @ts-check',
    "'use strict';",
    '',
    '/**',
    ' * AUTO-GENERATED — do not edit by hand.',
    ' * Source: src/app/app.preset.ts (PROJECT_TOKENS export) + ',
    ' * the SCALES table in tools/design-tokens/codegen.mjs.',
    ' * Regenerate: `npm run design-tokens:codegen`.',
    ' *',
    ' * Consumed by:',
    '   - tools/eslint/rules/no-forbidden-spacing.js',
    '   - tools/eslint/rules/no-forbidden-rounded.js',
    '   - tools/eslint/rules/no-forbidden-typography.js',
    '   - tools/eslint/rules/no-arbitrary-duration.js',
    ' *',
    ' * Adding a new scale: edit SCALES in codegen.mjs, run the script.',
    ' * ESLint rules import named exports from this file.',
    ' */',
    '',
    'module.exports = Object.freeze(' +
      JSON.stringify(SCALES, null, 2) +
      ');',
    '',
  ].join('\n');
}

// ───────────────────────────────────────────────────────────────────────
// Main
// ───────────────────────────────────────────────────────────────────────

function ensureDir(p) {
  const dir = resolve(p, '..');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function writeIfChanged(path, content) {
  ensureDir(path);
  const exists = existsSync(path);
  const current = exists ? readFileSync(path, 'utf8') : null;
  if (current === content) return false;
  writeFileSync(path, content);
  return true;
}

const css = emitTokensCss();
const js = emitScalesJs();

if (CHECK) {
  const existingCss = existsSync(TOKENS_CSS_PATH)
    ? readFileSync(TOKENS_CSS_PATH, 'utf8')
    : null;
  const existingJs = existsSync(SCALES_JS_PATH)
    ? readFileSync(SCALES_JS_PATH, 'utf8')
    : null;
  const drifts = [];
  if (existingCss !== css) drifts.push(rel(TOKENS_CSS_PATH));
  if (existingJs !== js) drifts.push(rel(SCALES_JS_PATH));
  if (drifts.length > 0) {
    console.error('[codegen] DRIFT in generated artifacts:');
    for (const f of drifts) console.error(`  • ${f}`);
    console.error('');
    console.error('  Resolve with: npm run design-tokens:codegen');
    process.exit(1);
  }
  console.log('[codegen] generated artifacts in sync ✓');
  process.exit(0);
}

const writtenCss = writeIfChanged(TOKENS_CSS_PATH, css);
const writtenJs = writeIfChanged(SCALES_JS_PATH, js);
console.log(
  `[codegen] ${writtenCss ? 'rewrote' : 'no change'} ${rel(TOKENS_CSS_PATH)}`,
);
console.log(
  `[codegen] ${writtenJs ? 'rewrote' : 'no change'} ${rel(SCALES_JS_PATH)}`,
);
