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
 *   *.ts, *.html  → ESLint (architecture rules + 7 design system rules)
 *   tools/eslint/ → ESLint rule unit tests (guards against regex regressions)
 */

module.exports = {
  // ── Application code ─────────────────────────────────────────────────
  // ESLint checks both TypeScript (.ts) and Angular template (.html) files.
  // - .ts: OnPush enforcement, no-explicit-any, component-selector, etc.
  // - .html: design system rules (colors, spacing, typography, shadows, rounded,
  //          dark mode pairs, inline styles) + control flow + a11y.
  //
  // --no-warn-ignored: suppress warnings for files matching eslint ignore patterns
  //   (e.g. if lint-staged passes a generated file that eslint.config.js ignores).
  'src/**/*.{ts,html}': 'eslint --no-warn-ignored',

  // ── ESLint rule infrastructure ───────────────────────────────────────
  // If any rule file, the shared utility, or the plugin entry point changes,
  // run the full rule test suite. Uses a function return so lint-staged does
  // NOT append the staged file paths (tests are project-wide, not per-file).
  'tools/eslint/**/*.js': () => "node --test 'tools/eslint/rules/__tests__/*.test.js'",
};
