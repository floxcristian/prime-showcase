// @ts-check
'use strict';

/**
 * @fileoverview Forbids Tailwind shadow utilities in templates.
 * The project uses `border border-surface` for elevation instead of shadows.
 * Only exception: Chart.js custom tooltips (handled in JS, not in templates).
 *
 * Scans: class, styleClass, and all PrimeNG *StyleClass attributes.
 *
 * Catches both `shadow-*` (box-shadow) and `drop-shadow-*` (filter: drop-shadow).
 */

const { createClassAttrVisitor } = require('../utils');

// Matches: shadow, shadow-sm, shadow-md, shadow-lg, shadow-xl, shadow-2xl,
//          shadow-inner, shadow-none, shadow-[*], drop-shadow, drop-shadow-md, etc.
// Uses (?!\w) instead of trailing \b so arbitrary value brackets are fully captured
// e.g. shadow-[0_4px_6px] matches fully, not just "shadow"
const SHADOW_REGEX = /!?\b(?:drop-)?shadow(?:-(?:sm|md|lg|xl|2xl|inner|none|\[.*?\]))?(?!\w)/g;

// Allowed: shadow-none and !shadow-none are used to reset PrimeNG component shadows
const ALLOWED_CLASSES = new Set(['shadow-none', '!shadow-none']);

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow Tailwind shadow utilities. Use `border border-surface` for elevation instead.',
    },
    schema: [],
    messages: {
      noShadow:
        'Shadow class "{{className}}" is not allowed. Use `border border-surface` for elevation instead.',
    },
  },
  create(context) {
    return createClassAttrVisitor(context, (value, loc) => {
      let match;
      SHADOW_REGEX.lastIndex = 0;
      while ((match = SHADOW_REGEX.exec(value)) !== null) {
        if (ALLOWED_CLASSES.has(match[0])) continue;
        context.report({ loc, messageId: 'noShadow', data: { className: match[0] } });
      }
    });
  },
};
