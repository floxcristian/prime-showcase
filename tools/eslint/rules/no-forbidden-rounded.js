// @ts-check
'use strict';

/**
 * @fileoverview Enforces the project's border-radius scale.
 *
 * Allowed values:  rounded-full | rounded-lg | rounded-xl | rounded-2xl | rounded-3xl | rounded-border
 * Forbidden:       rounded (bare) | rounded-sm | rounded-md | rounded-none | rounded-[*]
 *
 * Directional variants (e.g. rounded-t-lg, rounded-br-2xl) are allowed —
 * we validate the base scale, not directional overrides.
 *
 * Scans: class, styleClass, and all PrimeNG *StyleClass attributes.
 */

const { createClassAttrVisitor } = require('../utils');

// Allowed rounded classes — everything else is forbidden
const ALLOWED_ROUNDED = new Set([
  'rounded-full',
  'rounded-lg',
  'rounded-xl',
  'rounded-2xl',
  'rounded-3xl',
  'rounded-border', // PrimeNG design token (maps to --p-content-border-radius)
]);

// Matches any rounded-* class (including bare `rounded`)
// The character class includes `-` so compound classes like `rounded-t-lg` are captured fully
// Uses (?!\w) instead of trailing \b so arbitrary value brackets are fully captured
// e.g. rounded-[5px] matches fully, not just "rounded-[5px"
const ROUNDED_REGEX = /\brounded(?:-[a-z0-9[\].-]+)?(?!\w)/g;

// Directional variants that are always allowed (e.g. rounded-t-lg, rounded-br-2xl)
// These follow the pattern: rounded-{direction}-{size}
const DIRECTIONAL_PREFIX_REGEX = /^rounded-(?:t|b|l|r|tl|tr|bl|br|s|e|ss|se|es|ee)-/;

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Enforce the allowed border-radius scale: rounded-full, rounded-lg, rounded-xl, rounded-2xl, rounded-3xl.',
    },
    schema: [],
    messages: {
      noForbiddenRounded:
        '"{{className}}" is not in the allowed border-radius scale. Use one of: rounded-full, rounded-lg, rounded-xl, rounded-2xl, rounded-3xl.',
    },
  },
  create(context) {
    return createClassAttrVisitor(context, (value, loc) => {
      let match;
      ROUNDED_REGEX.lastIndex = 0;
      while ((match = ROUNDED_REGEX.exec(value)) !== null) {
        const cls = match[0];

        if (ALLOWED_ROUNDED.has(cls)) continue;

        // Allow directional variants (e.g. rounded-t-lg) — the size part
        // is validated by the developer, we only block the base scale.
        if (DIRECTIONAL_PREFIX_REGEX.test(cls)) continue;

        context.report({ loc, messageId: 'noForbiddenRounded', data: { className: cls } });
      }
    });
  },
};
