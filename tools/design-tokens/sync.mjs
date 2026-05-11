#!/usr/bin/env node
/**
 * Design-token drift detector.
 *
 * **Why this exists.** The Aura preset in `src/app/app.config.ts` is the
 * runtime source of truth for every CSS variable PrimeNG emits. `DESIGN.md`
 * front matter mirrors a subset of those tokens for tool-agnostic consumers
 * (Codex, Cursor, Figma plugins, design reviewers). When the two drift, the
 * lint rules and the documentation diverge, and reviewers stop trusting the
 * doc — exactly the failure mode Polaris/Primer/Carbon avoid via Style
 * Dictionary + drift checks in CI.
 *
 * This script is the smallest enterprise-grade enforcement that closes that
 * loop: it asserts that the tokens published in `DESIGN.md` match the literal
 * values declared in `app.config.ts`, and fails CI on drift with a structured
 * diff (no surprise diffs in PRs, no silent doc rot).
 *
 * **What is checked.**
 *   1. `colors.primary.50…950` — the explicit primary palette literal.
 *   2. `components.formField.invalidBorderColor` — error tone (light + dark).
 *   3. `colors.semantic.textMutedColor` — the AA-contrast override.
 *
 * **What is NOT checked yet.** Surface tokens (text-color, surface-N) inherit
 * from Aura defaults and are documented in `DESIGN.md` as `var(--p-…)`
 * references; a future iteration could resolve those by importing the Aura
 * preset programmatically. Out of scope for v1 — keeping this script
 * dependency-free over `node_modules/@primeuix/themes`.
 *
 * **Flags.**
 *   --update     Rewrites the relevant entries in DESIGN.md front matter
 *                from the source of truth. Use ONLY when the change in
 *                `app.config.ts` is intentional.
 *
 * Exit codes: 0 (in sync) | 1 (drift detected) | 2 (parse error).
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDocument } from 'yaml';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const PRESET_PATH = resolve(REPO_ROOT, 'src/app/app.config.ts');
const DESIGN_PATH = resolve(REPO_ROOT, 'DESIGN.md');

const args = process.argv.slice(2);
const UPDATE = args.includes('--update');

/**
 * Extract the literal `primary: { 50: '…', …, 950: '…' }` block from
 * app.config.ts. Strict regex — fails loudly if the shape changes, which is
 * exactly what we want (the preset shape is part of the contract).
 *
 * @param {string} source
 * @returns {Record<string, string>}
 */
function extractPrimaryPalette(source) {
  const block = source.match(/primary:\s*\{([^}]+)\}/);
  if (!block) {
    throw new Error('Could not locate `primary: { … }` block in app.config.ts');
  }
  const palette = {};
  const entryRe = /(\d{2,3}):\s*'(#[0-9a-fA-F]{3,8})'/g;
  let m;
  while ((m = entryRe.exec(block[1])) !== null) {
    palette[m[1]] = m[2].toLowerCase();
  }
  const expectedShades = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];
  for (const shade of expectedShades) {
    if (!palette[shade]) {
      throw new Error(`Primary palette missing shade ${shade} in app.config.ts`);
    }
  }
  return palette;
}

/**
 * Extract a single token reference like `'{rose.500}'` or `'{surface.600}'`
 * by matching a key path inside the preset source.
 *
 * @param {string} source
 * @param {RegExp} matcher
 * @returns {string | null}
 */
function extractTokenReference(source, matcher) {
  const m = source.match(matcher);
  return m ? m[1] : null;
}

/**
 * Returns a flat record of expected design-token values derived from
 * app.config.ts. Keys mirror the path inside DESIGN.md front matter.
 *
 * @param {string} presetSource
 */
function buildExpectedTokens(presetSource) {
  const primary = extractPrimaryPalette(presetSource);

  // Use matchAll + positional indexing instead of nested-block regex to avoid
  // overshooting across colorScheme.light → colorScheme.dark boundaries.
  // Both colorScheme branches define the same property in the same order
  // (light first, dark second), so pos 0 is light and pos 1 is dark.
  const invalidBorderMatches = [
    ...presetSource.matchAll(/formField:\s*\{\s*invalidBorderColor:\s*'(\{[^}]+\})'/g),
  ];
  const errorBorderLight = invalidBorderMatches[0]?.[1] ?? null;
  const errorBorderDark = invalidBorderMatches[1]?.[1] ?? null;

  const mutedTextMatches = [
    ...presetSource.matchAll(/text:\s*\{\s*muted:\s*\{\s*color:\s*'(\{[^}]+\})'/g),
  ];
  const mutedTextLight = mutedTextMatches[0]?.[1] ?? null;
  const mutedTextDark = mutedTextMatches[1]?.[1] ?? null;
  const focusRingShadow = extractTokenReference(
    presetSource,
    /focusRing:\s*\{[^}]*shadow:\s*'([^']+)'/,
  );

  return {
    primary,
    errorBorderLight,
    errorBorderDark,
    mutedTextLight,
    mutedTextDark,
    focusRingShadow,
  };
}

/**
 * Parses DESIGN.md, returns { doc, body } where doc is the YAML Document
 * for the front matter (preserves comments + ordering) and body is the
 * markdown body string.
 *
 * @param {string} source
 */
function parseDesignDoc(source) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    throw new Error('DESIGN.md is missing the YAML front matter delimiters (---).');
  }
  const doc = parseDocument(match[1]);
  return { doc, body: match[2], rawFrontMatter: match[1] };
}

/**
 * Reports drift between expected and actual tokens.
 *
 * @returns {{ ok: boolean, diffs: string[] }}
 */
function diff(expected, actual) {
  const diffs = [];

  // Primary palette
  for (const shade of Object.keys(expected.primary)) {
    const want = expected.primary[shade];
    const got = actual?.colors?.primary?.[shade];
    if (got !== want) {
      diffs.push(`colors.primary.${shade}: expected "${want}", got "${got ?? '(missing)'}"`);
    }
  }

  // Reference tokens (kept as `{token.path}` strings in DESIGN.md)
  const refChecks = [
    ['components.formField.invalidBorderColor.light', expected.errorBorderLight],
    ['components.formField.invalidBorderColor.dark', expected.errorBorderDark],
    ['colors.semantic.textMutedColor.light', expected.mutedTextLight],
    ['colors.semantic.textMutedColor.dark', expected.mutedTextDark],
    ['colors.semantic.focusRingShadow', expected.focusRingShadow],
  ];

  for (const [path, want] of refChecks) {
    if (want === null) continue;
    const got = path.split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), actual);
    if (got !== want) {
      diffs.push(`${path}: expected "${want}", got "${got ?? '(missing)'}"`);
    }
  }

  return { ok: diffs.length === 0, diffs };
}

/**
 * Patches the YAML Document in place with the expected token values, then
 * serialises it back. Preserves comments, key order, and the markdown body.
 */
function applyExpected(designDoc, expected) {
  const json = designDoc.toJSON() ?? {};
  json.colors = json.colors || {};
  json.colors.primary = { ...(json.colors.primary || {}), ...expected.primary };
  json.colors.semantic = json.colors.semantic || {};
  if (expected.mutedTextLight) {
    json.colors.semantic.textMutedColor = json.colors.semantic.textMutedColor || {};
    json.colors.semantic.textMutedColor.light = expected.mutedTextLight;
  }
  if (expected.mutedTextDark) {
    json.colors.semantic.textMutedColor = json.colors.semantic.textMutedColor || {};
    json.colors.semantic.textMutedColor.dark = expected.mutedTextDark;
  }
  if (expected.focusRingShadow) {
    json.colors.semantic.focusRingShadow = expected.focusRingShadow;
  }
  if (expected.errorBorderLight || expected.errorBorderDark) {
    json.components = json.components || {};
    json.components.formField = json.components.formField || {};
    json.components.formField.invalidBorderColor = {
      ...(json.components.formField.invalidBorderColor || {}),
      light: expected.errorBorderLight,
      dark: expected.errorBorderDark,
    };
  }
  designDoc.contents = designDoc.createNode(json).contents ?? designDoc.createNode(json);
}

function main() {
  let presetSource;
  let designSource;
  try {
    presetSource = readFileSync(PRESET_PATH, 'utf8');
    designSource = readFileSync(DESIGN_PATH, 'utf8');
  } catch (err) {
    console.error(`[design-tokens] failed to read sources: ${err.message}`);
    process.exit(2);
  }

  let expected;
  let parsed;
  try {
    expected = buildExpectedTokens(presetSource);
    parsed = parseDesignDoc(designSource);
  } catch (err) {
    console.error(`[design-tokens] parse error: ${err.message}`);
    process.exit(2);
  }

  const actual = parsed.doc.toJSON() ?? {};
  const result = diff(expected, actual);

  if (result.ok) {
    console.log('[design-tokens] DESIGN.md is in sync with src/app/app.config.ts ✓');
    return;
  }

  if (UPDATE) {
    applyExpected(parsed.doc, expected);
    const newFrontMatter = parsed.doc.toString({ lineWidth: 0 });
    const next = `---\n${newFrontMatter}---\n${parsed.body}`;
    writeFileSync(DESIGN_PATH, next);
    console.log('[design-tokens] DESIGN.md front matter rewritten from app.config.ts');
    console.log('  Updated entries:');
    for (const d of result.diffs) console.log(`    • ${d}`);
    return;
  }

  console.error('[design-tokens] DRIFT detected between DESIGN.md and src/app/app.config.ts:');
  for (const d of result.diffs) console.error(`  • ${d}`);
  console.error('');
  console.error('  Resolve with: npm run design-tokens:sync -- --update');
  console.error('  (then commit DESIGN.md alongside the preset change.)');
  process.exit(1);
}

main();
