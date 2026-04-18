// @ts-check
'use strict';

/**
 * RuleTester suite for showcase/no-deprecated-styleclass.
 *
 * Covers:
 *   - Static styleClass on deprecated elements (p-avatar, p-tag, p-skeleton, etc.)
 *   - Bound [styleClass] on deprecated elements
 *   - Overlay allowlist (p-drawer, p-dialog, p-popover, p-tooltip, p-button, etc.) — not flagged
 *   - Sub-element *StyleClass inputs (paginatorStyleClass, valueStyleClass) — not flagged
 *   - Non-PrimeNG elements — not flagged
 *   - Deprecation set export for maintenance assertions
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { RuleTester } = require('eslint');
const templateParser = require('@angular-eslint/template-parser');
const rule = require('../no-deprecated-styleclass');

const ruleTester = new RuleTester({
  languageOptions: { parser: templateParser },
});

test('no-deprecated-styleclass', () => {
  ruleTester.run('no-deprecated-styleclass', rule, {
    valid: [
      // v20+ idiomatic `class` on a deprecated-styleClass component — fine
      { code: '<p-avatar class="rounded-lg"></p-avatar>' },
      { code: '<p-tag class="font-medium"></p-tag>' },
      { code: '<p-skeleton class="mb-2"></p-skeleton>' },
      // Bound class forms — fine
      { code: `<p-avatar [ngClass]="{ 'rounded-lg': true }"></p-avatar>` },
      { code: `<p-tag [class]="'font-medium'"></p-tag>` },
      // Overlay components — styleClass is still the official API
      { code: '<p-drawer styleClass="w-96"></p-drawer>' },
      { code: '<p-dialog styleClass="my-dialog"></p-dialog>' },
      { code: '<p-popover styleClass="w-80"></p-popover>' },
      { code: '<p-tooltip styleClass="bg-surface-950"></p-tooltip>' },
      { code: '<p-menu styleClass="w-40"></p-menu>' },
      { code: '<p-button styleClass="w-full"></p-button>' },
      // Overlay components with bound form
      { code: `<p-drawer [styleClass]="'w-96'"></p-drawer>` },
      { code: `<p-dialog [styleClass]="expr"></p-dialog>` },
      // Sub-element *StyleClass inputs — not scanned
      { code: '<p-table paginatorStyleClass="!bg-transparent"></p-table>' },
      { code: '<p-progressbar valueStyleClass="!bg-surface-0"></p-progressbar>' },
      { code: `<p-table [paginatorStyleClass]="'!bg-transparent'"></p-table>` },
      // Non-PrimeNG elements
      { code: '<div styleClass="ignored"></div>' },
      { code: '<custom-component styleClass="also-ignored"></custom-component>' },
    ],

    invalid: [
      // Static styleClass on p-avatar
      {
        code: '<p-avatar styleClass="rounded-lg"></p-avatar>',
        errors: [{ messageId: 'deprecatedStyleClass', data: { attr: 'styleClass', element: 'p-avatar' } }],
      },
      // Static styleClass on p-tag
      {
        code: '<p-tag styleClass="font-medium"></p-tag>',
        errors: [{ messageId: 'deprecatedStyleClass', data: { attr: 'styleClass', element: 'p-tag' } }],
      },
      // Static styleClass on p-skeleton
      {
        code: '<p-skeleton styleClass="mb-2"></p-skeleton>',
        errors: [{ messageId: 'deprecatedStyleClass', data: { attr: 'styleClass', element: 'p-skeleton' } }],
      },
      // Bound [styleClass] on p-avatar
      {
        code: `<p-avatar [styleClass]="cond ? 'a' : 'b'"></p-avatar>`,
        errors: [{ messageId: 'deprecatedStyleClass', data: { attr: '[styleClass]', element: 'p-avatar' } }],
      },
      // Static styleClass on p-table
      {
        code: '<p-table styleClass="!bg-transparent"></p-table>',
        errors: [{ messageId: 'deprecatedStyleClass', data: { attr: 'styleClass', element: 'p-table' } }],
      },
      // Static styleClass on p-progressbar (sub-element valueStyleClass valid — but host styleClass not)
      {
        code: '<p-progressbar styleClass="h-1" valueStyleClass="!bg-surface-0"></p-progressbar>',
        errors: [{ messageId: 'deprecatedStyleClass', data: { attr: 'styleClass', element: 'p-progressbar' } }],
      },
      // Bound on p-paginator
      {
        code: `<p-paginator [styleClass]="expr"></p-paginator>`,
        errors: [{ messageId: 'deprecatedStyleClass', data: { attr: '[styleClass]', element: 'p-paginator' } }],
      },
    ],
  });
});

test('no-deprecated-styleclass — DEPRECATED_STYLECLASS_ELEMENTS invariants', () => {
  const set = rule.DEPRECATED_STYLECLASS_ELEMENTS;
  assert.ok(set instanceof Set, 'expected exported Set');
  // Spot-check representative membership
  for (const el of ['p-avatar', 'p-tag', 'p-skeleton', 'p-table', 'p-paginator', 'p-progressbar']) {
    assert.ok(set.has(el), `${el} should be in the deprecated set`);
  }
  // Overlay / picker components that still expose styleClass officially should
  // NOT be in the deprecated set — flagging them would break valid usage.
  for (const el of ['p-drawer', 'p-dialog', 'p-popover', 'p-tooltip', 'p-menu', 'p-button']) {
    assert.ok(!set.has(el), `${el} must NOT be in the deprecated set`);
  }
});

/**
 * Drift-detection: the canonical source of truth is PrimeNG's own `.d.ts`
 * files. At test time we scan `node_modules/primeng/types/primeng-*.d.ts`,
 * find every selector whose `styleClass` input is annotated
 * `@deprecated since v20.0.0, use \`class\` instead.`, and assert the rule's
 * hand-maintained Set matches that canonical set exactly.
 *
 * A future `npm install primeng@next` that deprecates more selectors (or
 * removes a deprecation) will fail this test with a precise diff — the
 * maintainer never has to re-run the grep manually.
 *
 * Filename → selector convention (verified against current 53 files):
 *   primeng-<name>.d.ts → p-<name>
 * No exceptions in PrimeNG v21. If v22 introduces one, this parser may need
 * an override map.
 */
test('no-deprecated-styleclass — drift detection vs PrimeNG type defs', () => {
  const typesDir = path.resolve(
    __dirname,
    '..',
    '..',
    '..',
    '..',
    'node_modules',
    'primeng',
    'types',
  );
  assert.ok(
    fs.existsSync(typesDir),
    `PrimeNG types directory not found at ${typesDir}. ` +
      'Run `npm install` before the ESLint rule tests.',
  );

  const DEPRECATION_MARKER = '@deprecated since v20.0.0, use `class` instead.';
  // `styleClass` property declaration on the next non-blank line after the
  // JSDoc close — captures `styleClass: string | undefined;` and
  // `styleClass?: string;` variants.
  const STYLECLASS_PROPERTY_RE = /^\s*styleClass\??\s*:/;

  const entries = fs
    .readdirSync(typesDir)
    .filter((name) => /^primeng-[a-z0-9]+\.d\.ts$/.test(name));

  assert.ok(
    entries.length > 10,
    `expected many primeng-*.d.ts files, got ${entries.length} — directory layout may have changed`,
  );

  const canonical = new Set();
  for (const entry of entries) {
    const contents = fs.readFileSync(path.join(typesDir, entry), 'utf8');
    if (!contents.includes(DEPRECATION_MARKER)) continue;

    // Confirm the marker actually annotates a `styleClass` property (not some
    // unrelated member). Walk forward from each marker occurrence to the next
    // non-comment, non-blank line and test the property regex.
    const lines = contents.split(/\r?\n/);
    let annotatesStyleClass = false;
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].includes(DEPRECATION_MARKER)) continue;
      for (let j = i + 1; j < lines.length; j++) {
        const trimmed = lines[j].trim();
        if (trimmed === '' || trimmed.startsWith('*') || trimmed.startsWith('/*') || trimmed.startsWith('//')) {
          continue;
        }
        if (STYLECLASS_PROPERTY_RE.test(lines[j])) {
          annotatesStyleClass = true;
        }
        break;
      }
      if (annotatesStyleClass) break;
    }

    if (!annotatesStyleClass) continue;

    // primeng-<name>.d.ts → p-<name>
    const match = /^primeng-([a-z0-9]+)\.d\.ts$/.exec(entry);
    // The filter regex above already guarantees a match, but keep the guard
    // for clarity — if it fails, the test should surface which file broke.
    assert.ok(match, `unexpected filename shape: ${entry}`);
    canonical.add(`p-${match[1]}`);
  }

  assert.ok(
    canonical.size > 0,
    'scanner found zero deprecated styleClass selectors — the marker string or file layout may have changed',
  );

  const declared = rule.DEPRECATED_STYLECLASS_ELEMENTS;
  const missing = [...canonical].filter((el) => !declared.has(el)).sort();
  const extra = [...declared].filter((el) => !canonical.has(el)).sort();

  const format = (label, list) =>
    list.length === 0 ? '' : `\n  ${label} (${list.length}): ${list.join(', ')}`;

  assert.deepStrictEqual(
    { missing, extra },
    { missing: [], extra: [] },
    'DEPRECATED_STYLECLASS_ELEMENTS drifted from PrimeNG type defs.' +
      format(
        'missing — add to rule (PrimeNG marks them @deprecated)',
        missing,
      ) +
      format(
        'extra — remove from rule (PrimeNG no longer marks them @deprecated)',
        extra,
      ) +
      `\n  Source of truth: ${typesDir}`,
  );
});
