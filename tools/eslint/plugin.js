// @ts-check
'use strict';

/**
 * @fileoverview Local ESLint plugin for PrimeNG Showcase design system enforcement.
 *
 * Rules:
 *   showcase/no-hardcoded-colors   — Forbids generic Tailwind colors (text-gray-*, bg-blue-*, etc.)
 *   showcase/no-shadow-classes     — Forbids shadow-* utilities (use border-surface for elevation)
 *   showcase/no-forbidden-rounded  — Enforces border-radius scale (rounded-lg through rounded-3xl + rounded-full)
 *   showcase/no-inline-styles      — Forbids static style="" attributes
 *   showcase/no-forbidden-spacing  — Enforces spacing scale (gap, padding, margin)
 *   showcase/no-missing-dark-pair  — Requires dark: counterpart for bg-surface-* classes
 *   showcase/no-icon-button-without-tooltip — Requires pTooltip on icon-only <p-button>
 */

/** @type {import('eslint').ESLint.Plugin} */
module.exports = {
  rules: {
    'no-hardcoded-colors': require('./rules/no-hardcoded-colors'),
    'no-shadow-classes': require('./rules/no-shadow-classes'),
    'no-forbidden-rounded': require('./rules/no-forbidden-rounded'),
    'no-inline-styles': require('./rules/no-inline-styles'),
    'no-forbidden-spacing': require('./rules/no-forbidden-spacing'),
    'no-missing-dark-pair': require('./rules/no-missing-dark-pair'),
    'no-forbidden-typography': require('./rules/no-forbidden-typography'),
    'no-icon-button-without-tooltip': require('./rules/no-icon-button-without-tooltip'),
  },
};
