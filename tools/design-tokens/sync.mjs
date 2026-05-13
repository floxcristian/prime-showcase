#!/usr/bin/env node
/**
 * Design-token drift detector + generated JSON artifact.
 *
 * **Mission**
 *
 * Polaris (Style Dictionary), Primer (primer/primitives), Carbon
 * (@carbon/themes): every mature design system has a generated token
 * artifact that:
 *   - drives runtime CSS,
 *   - is checked into source control as the canonical bridge to other
 *     consumers (Figma plugin, mobile, downstream repos),
 *   - is gated by CI against drift.
 *
 * This script is the same pattern, scoped to one repo:
 *
 *   1. Import the merged Aura + project preset via Node's native TS
 *      support (`src/app/app.preset.ts`).
 *   2. Resolve every `{token.path}` reference to its EFFECTIVE hex value
 *      per color scheme using the pure resolver in `resolver.mjs`.
 *   3. Two parallel drift checks:
 *        a) DESIGN.md YAML front matter — verify the hand-edited token
 *           references (e.g. `primary.500: "#0074c2"`,
 *           `textMutedColor.light: "{surface.600}"`) still match the
 *           preset literally. Owns the human-readable view.
 *        b) `design-tokens/tokens.json` — verify the committed JSON
 *           artifact matches the resolver output exactly. Owns the
 *           machine-readable view for external consumers.
 *   4. With `--update`, regenerate the JSON artifact and surgically
 *      patch the DESIGN.md primary palette / reference strings. The
 *      surrounding YAML styling, comments, and section ordering are
 *      preserved because the patches are line-targeted regex
 *      replacements — NOT a full re-emit through the YAML writer
 *      (which would strip the carefully-placed `# ───` separators and
 *      collapse the block scalar in `description`).
 *
 * **Why two views**
 *
 *   - DESIGN.md is reviewed by humans (designers, contractors). It
 *     uses references like `{surface.600}` so the intent is legible —
 *     "muted text is bumped one step from the Aura default to gain AA
 *     contrast". A reviewer sees the SEMANTIC choice.
 *   - tokens.json is consumed by machines (Figma plugin, mobile theme,
 *     downstream repo). It needs the LITERAL hex with no indirection.
 *
 * **Exit codes**: 0 in sync · 1 drift · 2 parse / IO error.
 *
 * Usage:
 *   `node tools/design-tokens/sync.mjs`              — check (CI)
 *   `node tools/design-tokens/sync.mjs --update`     — regen artifacts
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDocument } from 'yaml';

import { AppPreset, PROJECT_TOKENS } from '../../src/app/app.preset.ts';
import { exportTokens } from './resolver.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const PRESET_PATH = resolve(REPO_ROOT, 'src/app/app.preset.ts');
const DESIGN_PATH = resolve(REPO_ROOT, 'DESIGN.md');
const TOKENS_JSON_PATH = resolve(REPO_ROOT, 'design-tokens/tokens.json');

const TOKENS_JSON_HEADER = [
  '// AUTO-GENERATED — do not edit by hand.',
  '// Source: src/app/app.preset.ts (Aura preset + project overrides).',
  '// Resolver: tools/design-tokens/resolver.mjs.',
  '// Regenerate: `npm run design-tokens:sync -- --update`.',
  '// Drift check: `npm run design-tokens:check` (part of `npm run lint`).',
].join('\n');

const args = process.argv.slice(2);
const UPDATE = args.includes('--update');

const rel = (p) => relative(REPO_ROOT, p);

// ───────────────────────────────────────────────────────────────────────
// Stable serialization
// ───────────────────────────────────────────────────────────────────────

/**
 * Stable JSON stringify with two-space indent and sorted object keys.
 * Numeric-looking keys (palette shades) are sorted numerically so that
 * `50, 100, 200, …, 950` stays in the natural ramp order instead of
 * jumping to lexical `100, 200, 50, 500, 950`.
 */
function stableStringify(obj) {
  return JSON.stringify(sortRecursive(obj), null, 2);
}
function sortRecursive(value) {
  if (Array.isArray(value)) return value.map(sortRecursive);
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort(numericAware)
      .reduce((acc, k) => {
        acc[k] = sortRecursive(value[k]);
        return acc;
      }, {});
  }
  return value;
}
function numericAware(a, b) {
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  return a < b ? -1 : a > b ? 1 : 0;
}

// ───────────────────────────────────────────────────────────────────────
// IO helpers
// ───────────────────────────────────────────────────────────────────────

function readText(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch (err) {
    console.error(`[design-tokens] failed to read ${rel(path)}: ${err.message}`);
    process.exit(2);
  }
}

function ensureDir(filePath) {
  const dir = resolve(filePath, '..');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

// ───────────────────────────────────────────────────────────────────────
// DESIGN.md drift check (read-only by default; surgical patch on --update)
// ───────────────────────────────────────────────────────────────────────

/**
 * The contract between DESIGN.md and the preset. Each entry describes
 * one field in the YAML front matter, how to extract its current value,
 * and what the value should be according to the preset.
 *
 * Adding a new token-owned field? Add an entry here and the drift check
 * + --update flow pick it up automatically. The regex must capture
 * group 1 = the current value, with the SAME formatting the surgical
 * patcher will use to rewrite (quotes, key style, etc.).
 */
function buildDesignChecks(preset) {
  const checks = [];

  // 1. Primary palette — 11 literal hex values inside `colors.primary:`.
  const primary = preset.semantic?.primary ?? {};
  for (const shade of ['50','100','200','300','400','500','600','700','800','900','950']) {
    const expected = primary[shade] ?? primary[Number(shade)];
    if (typeof expected !== 'string') continue;
    checks.push({
      label: `colors.primary."${shade}"`,
      // Match e.g.  `    "50": "#eff8ff"`
      regex: new RegExp(`(\\s+)"${shade}":\\s*"([^"]+)"`),
      expected,
      replace: (match, indent) => `${indent}"${shade}": "${expected}"`,
    });
  }

  // 2. Reference strings — `textMutedColor.light/dark`, `focusRingShadow`.
  const muted = preset.semantic?.colorScheme;
  if (muted?.light?.text?.muted?.color) {
    const expected = muted.light.text.muted.color;
    checks.push({
      label: 'colors.semantic.textMutedColor.light',
      regex: /(textMutedColor:\s*\n\s+light:\s*)"([^"]+)"/,
      expected,
      replace: (_match, lead) => `${lead}"${expected}"`,
    });
  }
  if (muted?.dark?.text?.muted?.color) {
    const expected = muted.dark.text.muted.color;
    checks.push({
      label: 'colors.semantic.textMutedColor.dark',
      regex: /(textMutedColor:[\s\S]*?dark:\s*)"([^"]+)"/,
      expected,
      replace: (_match, lead) => `${lead}"${expected}"`,
    });
  }
  if (preset.semantic?.focusRing?.shadow) {
    const expected = preset.semantic.focusRing.shadow;
    checks.push({
      label: 'colors.semantic.focusRingShadow',
      regex: /(focusRingShadow:\s*)"([^"]+)"/,
      expected,
      replace: (_match, lead) => `${lead}"${expected}"`,
    });
  }

  // 3. `formField.invalidBorderColor` overrides.
  if (muted?.light?.formField?.invalidBorderColor) {
    const expected = muted.light.formField.invalidBorderColor;
    checks.push({
      label: 'components.formField.invalidBorderColor.light',
      regex: /(formField:\s*\n\s+invalidBorderColor:\s*\n\s+light:\s*)"([^"]+)"/,
      expected,
      replace: (_match, lead) => `${lead}"${expected}"`,
    });
  }
  if (muted?.dark?.formField?.invalidBorderColor) {
    const expected = muted.dark.formField.invalidBorderColor;
    checks.push({
      label: 'components.formField.invalidBorderColor.dark',
      regex: /(formField:[\s\S]*?invalidBorderColor:[\s\S]*?dark:\s*)"([^"]+)"/,
      expected,
      replace: (_match, lead) => `${lead}"${expected}"`,
    });
  }

  return checks;
}

function runDesignDrift(designSource, preset) {
  const checks = buildDesignChecks(preset);
  const drifts = [];
  for (const check of checks) {
    const m = designSource.match(check.regex);
    if (!m) {
      drifts.push({ label: check.label, expected: check.expected, got: '(not found in DESIGN.md)' });
      continue;
    }
    const got = m[2];
    if (got !== check.expected) {
      drifts.push({ label: check.label, expected: check.expected, got });
    }
  }
  return { checks, drifts };
}

function patchDesignDoc(designSource, checks) {
  let next = designSource;
  for (const check of checks) {
    next = next.replace(check.regex, (match, ...groups) => {
      // Replacement uses captured indent / lead from the match.
      // Re-apply check.replace with the same args ESM regex.replace passes.
      return check.replace(match, ...groups);
    });
  }
  return next;
}

// ───────────────────────────────────────────────────────────────────────
// design-tokens/tokens.json drift check + emit
// ───────────────────────────────────────────────────────────────────────

function readJsonArtifact() {
  if (!existsSync(TOKENS_JSON_PATH)) return null;
  const text = readText(TOKENS_JSON_PATH);
  const jsonStart = text.indexOf('{');
  if (jsonStart < 0) return null;
  try {
    return JSON.parse(text.slice(jsonStart));
  } catch (err) {
    console.error(
      `[design-tokens] ${rel(TOKENS_JSON_PATH)} is corrupt: ${err.message}`,
    );
    process.exit(2);
  }
}

function flatten(obj, prefix = '') {
  const entries = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v != null && typeof v === 'object' && !Array.isArray(v)) {
      entries.push(...flatten(v, path));
    } else {
      entries.push([path, v ?? null]);
    }
  }
  return entries;
}

function runJsonDrift(resolved) {
  const onDisk = readJsonArtifact();
  if (!onDisk) {
    return [
      {
        label: rel(TOKENS_JSON_PATH),
        expected: '(generated artifact)',
        got: '(missing — run `npm run design-tokens:sync -- --update`)',
      },
    ];
  }
  const drifts = [];
  for (const [path, expected] of flatten(resolved)) {
    const got = path.split('.').reduce(
      (acc, seg) => (acc == null || typeof acc !== 'object' ? undefined : acc[seg]),
      onDisk,
    );
    if (got !== expected) {
      drifts.push({ label: `tokens.json:${path}`, expected, got: got ?? '(missing)' });
    }
  }
  // Detect extra keys on disk (someone hand-added something that drifted).
  const seen = new Set(flatten(resolved).map(([p]) => p));
  for (const [path] of flatten(onDisk)) {
    if (!seen.has(path)) {
      drifts.push({ label: `tokens.json:${path}`, expected: '(removed)', got: 'extraneous' });
    }
  }
  return drifts;
}

function writeJsonArtifact(resolved) {
  ensureDir(TOKENS_JSON_PATH);
  writeFileSync(TOKENS_JSON_PATH, `${TOKENS_JSON_HEADER}\n${stableStringify(resolved)}\n`);
}

// ───────────────────────────────────────────────────────────────────────
// Main
// ───────────────────────────────────────────────────────────────────────

const resolved = exportTokens(AppPreset, PROJECT_TOKENS);
const designSource = readText(DESIGN_PATH);

const { checks, drifts: designDrifts } = runDesignDrift(designSource, AppPreset);
const jsonDrifts = runJsonDrift(resolved);
const allDrifts = [
  ...designDrifts.map((d) => ({ ...d, source: 'DESIGN.md' })),
  ...jsonDrifts.map((d) => ({ ...d, source: 'tokens.json' })),
];

if (UPDATE) {
  // 1. Surgically patch DESIGN.md — preserves YAML styling, comments,
  //    section order. Each check.regex targets ONE field; nothing else
  //    in the document is touched.
  const patched = patchDesignDoc(designSource, checks);
  if (patched !== designSource) writeFileSync(DESIGN_PATH, patched);
  // 2. Regenerate tokens.json — deterministic, sorted, stable.
  writeJsonArtifact(resolved);

  console.log(`[design-tokens] regenerated artifacts from ${rel(PRESET_PATH)}`);
  console.log(`  • ${rel(DESIGN_PATH)} (surgical patch)`);
  console.log(`  • ${rel(TOKENS_JSON_PATH)} (full rewrite, ${flatten(resolved).length} keys)`);
  if (allDrifts.length) {
    console.log('[design-tokens] applied delta:');
    for (const d of allDrifts) console.log(`  • [${d.source}] ${d.label}: ${d.got} → ${d.expected}`);
  } else {
    console.log('[design-tokens] (already in sync — outputs are deterministic)');
  }
  process.exit(0);
}

if (allDrifts.length === 0) {
  console.log(
    `[design-tokens] DESIGN.md + ${rel(TOKENS_JSON_PATH)} in sync with ${rel(PRESET_PATH)} ✓`,
  );
  process.exit(0);
}

console.error(`[design-tokens] DRIFT detected vs ${rel(PRESET_PATH)}:`);
for (const d of allDrifts) {
  console.error(`  • [${d.source}] ${d.label}`);
  console.error(`      expected: ${d.expected}`);
  console.error(`      got:      ${d.got}`);
}
console.error('');
console.error('  Resolve with: npm run design-tokens:sync -- --update');
console.error('  Commit the regenerated files alongside the preset change.');
process.exit(1);
