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
 *   showcase/no-forbidden-transitions — Forbids transition-all / bare `transition` (use narrow variants)
 *   showcase/hover-requires-cursor-pointer — Requires cursor-pointer and hover:* to appear together
 *   showcase/no-bare-fa-without-sharp — Forbids fa-regular/fa-solid without fa-sharp prefix (invisible icon)
 *   showcase/no-button-without-type — Requires explicit type= on plain <button> (no form-submit surprises)
 *   showcase/no-duotone-inline-icon — Restricts fa-sharp-duotone to hero sizes (text-4xl+)
 *   showcase/no-decorative-icon-without-aria-hidden — Requires aria-hidden on <i> icons
 *   showcase/no-deprecated-styleclass — Forbids styleClass (deprecated in PrimeNG v20, use `class` instead)
 *   showcase/text-3xl-requires-bold — Requires font-bold on any element with text-3xl (hero titles)
 *   showcase/label-requires-semibold — Requires font-semibold on every <label> element (input labels)
 *   showcase/anchor-link-classes — Requires canonical link class set on <a> (exempt: routerLink, href="#", wraps p-button)
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
    'no-forbidden-transitions': require('./rules/no-forbidden-transitions'),
    'hover-requires-cursor-pointer': require('./rules/hover-requires-cursor-pointer'),
    'no-bare-fa-without-sharp': require('./rules/no-bare-fa-without-sharp'),
    'no-button-without-type': require('./rules/no-button-without-type'),
    'no-duotone-inline-icon': require('./rules/no-duotone-inline-icon'),
    'no-decorative-icon-without-aria-hidden': require('./rules/no-decorative-icon-without-aria-hidden'),
    'no-deprecated-styleclass': require('./rules/no-deprecated-styleclass'),
    'text-3xl-requires-bold': require('./rules/text-3xl-requires-bold'),
    'label-requires-semibold': require('./rules/label-requires-semibold'),
    'anchor-link-classes': require('./rules/anchor-link-classes'),
  },
};
