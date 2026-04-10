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
 */

/** @type {import('eslint').ESLint.Plugin} */
module.exports = {
  rules: {
    'no-hardcoded-colors': require('./rules/no-hardcoded-colors'),
    'no-shadow-classes': require('./rules/no-shadow-classes'),
    'no-forbidden-rounded': require('./rules/no-forbidden-rounded'),
    'no-inline-styles': require('./rules/no-inline-styles'),
  },
};
