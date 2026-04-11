// @ts-check
'use strict';

/**
 * @fileoverview lint-staged configuration.
 *
 * Runs on every `git commit` via the Husky pre-commit hook.
 * Only staged files matching the glob patterns below are checked,
 * keeping commits fast even in large projects.
 *
 * What runs:
 *   *.ts, *.html  → Prettier (format) → ESLint (architecture + 7 design system rules)
 *   *.js, *.json  → Prettier (format)
 *   tools/eslint/ → ESLint rule unit tests (guards against regex regressions)
 *
 * Order matters: Prettier runs first to format, then ESLint validates rules.
 * This avoids formatting-vs-linting conflicts — Prettier owns style, ESLint owns correctness.
 */

module.exports = {
  // ── Application code ─────────────────────────────────────────────────
  // Prettier formats first, then ESLint validates.
  // --no-warn-ignored: suppress warnings for files matching eslint ignore patterns.
  'src/**/*.{ts,html}': ['prettier --write', 'eslint --no-warn-ignored'],

  // ── Config and tooling files ─────────────────────────────────────────
  // Only Prettier (no ESLint rules target these file types).
  '*.{js,json}': ['prettier --write'],
  'tools/**/*.js': ['prettier --write'],

  // ── ESLint rule infrastructure ───────────────────────────────────────
  // If any rule file, the shared utility, or the plugin entry point changes,
  // run the full rule test suite. Uses a function return so lint-staged does
  // NOT append the staged file paths (tests are project-wide, not per-file).
  'tools/eslint/**/*.js': () => "node --test 'tools/eslint/rules/__tests__/*.test.js'",
};
