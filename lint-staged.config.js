// @ts-check
'use strict';

/**
 * @fileoverview lint-staged configuration.
 *
 * Runs on every `git commit` via the Husky pre-commit hook.
 * Only staged files matching the glob patterns below are checked,
 * keeping commits fast even in large projects.
 *
 * Pipeline per file type:
 *   *.ts, *.html       → ESLint (architecture + 19 design system rules)
 *   tools/eslint/       → ESLint rule unit tests
 *   tools/design-tokens → design-tokens drift check + unit tests
 *   tools/fonts/        → font preload unit tests
 */

module.exports = {
  // ── Application code ─────────────────────────────────────────────────
  // ESLint checks both TypeScript (.ts) and Angular template (.html) files.
  // --no-warn-ignored: suppress warnings for files matching eslint ignore patterns.
  'src/**/*.{ts,html}': 'eslint --no-warn-ignored',

  // ── ESLint rule infrastructure ───────────────────────────────────────
  // If any rule file, shared utility, or plugin entry point changes,
  // run the full rule test suite. Function return prevents lint-staged
  // from appending staged file paths (tests are project-wide).
  'tools/eslint/**/*.js': () => 'npm run lint:rules:test',

  // ── Design tokens infrastructure ─────────────────────────────────────
  // If the sync script, resolver, or tests change, run the token tests
  // and verify no drift against the preset.
  'tools/design-tokens/**/*.mjs': () => 'npm run design-tokens:test && npm run design-tokens:check',

  // ── Font preload infrastructure ──────────────────────────────────────
  'tools/fonts/**/*.mjs': () => 'npm run fonts:preload:test',
};
