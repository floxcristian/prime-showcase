// @ts-check
'use strict';

/**
 * @fileoverview Enforces the project's typography scale from CLAUDE.md.
 *
 * Validates individual typography values — NOT combinations.
 * Combinations are validated by code review against CLAUDE.md recipes.
 *
 * Allowed text sizes:  text-xs | text-sm | text-base | text-lg | text-xl | text-2xl | text-3xl
 * Allowed leading:     leading-5 | leading-6 | leading-7 | leading-8 | leading-normal | leading-none | leading-tight
 * Allowed font-weight: font-normal | font-medium | font-semibold
 *
 * Forbidden:           text-4xl+ (except icons/stats via exception list)
 *                      leading-snug | leading-relaxed | leading-loose | leading-[*]
 *                      font-thin | font-extralight | font-light | font-bold | font-extrabold | font-black
 *                      Arbitrary text sizes: text-[18px] etc.
 *
 * Scans: class, styleClass, [ngClass], [class], and all PrimeNG *StyleClass attributes.
 */

const { createClassAttrVisitor } = require('../utils');

// ── Allowed values ──────────────────────────────────────────────────────

const ALLOWED_TEXT_SIZES = new Set([
  'text-xs',
  'text-sm',
  'text-base',
  'text-lg',
  'text-xl',
  'text-2xl',
  'text-3xl',
]);

const ALLOWED_LEADING = new Set([
  'leading-4',
  'leading-5',
  'leading-6',
  'leading-7',
  'leading-8',
  'leading-normal',
  'leading-none',
  'leading-tight',
]);

const ALLOWED_FONT_WEIGHT = new Set([
  'font-normal',
  'font-medium',
  'font-semibold',
]);

// ── Exceptions ──────────────────────────────────────────────────────────

// text-4xl is used for large icons and stat numbers (side-menu drawers, file upload)
const ALLOWED_TEXT_SIZE_EXCEPTIONS = new Set([
  'text-4xl',
]);

// ── Regex patterns ──────────────────────────────────────────────────────

// Matches text size utilities: text-xs, text-sm, text-base, text-lg, text-xl, text-2xl, etc.
// Also matches arbitrary: text-[18px]
const TEXT_SIZE_REGEX = /\btext-(?:xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl|\[\w+\])\b/g;

// Matches leading utilities: leading-5, leading-normal, leading-tight, leading-[1.5], etc.
const LEADING_REGEX = /\bleading-(?:\d+|normal|none|tight|snug|relaxed|loose|\[.*?\])\b/g;

// Matches font-weight utilities: font-thin, font-medium, font-bold, etc.
const FONT_WEIGHT_REGEX = /\bfont-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black)\b/g;

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Enforce the typography scale from the design system. Blocks forbidden text sizes, line heights, and font weights.',
    },
    schema: [],
    messages: {
      forbiddenTextSize:
        '"{{className}}" is not in the allowed text size scale. Allowed: text-xs, text-sm, text-base, text-lg, text-xl, text-2xl, text-3xl.',
      forbiddenLeading:
        '"{{className}}" is not in the allowed line-height scale. Allowed: leading-5 through leading-8, leading-normal, leading-none, leading-tight.',
      forbiddenFontWeight:
        '"{{className}}" is not in the allowed font-weight scale. Allowed: font-normal, font-medium, font-semibold.',
    },
  },
  create(context) {
    return createClassAttrVisitor(context, (value, loc) => {
      let match;

      // Check text sizes
      TEXT_SIZE_REGEX.lastIndex = 0;
      while ((match = TEXT_SIZE_REGEX.exec(value)) !== null) {
        const cls = match[0];
        if (ALLOWED_TEXT_SIZES.has(cls)) continue;
        if (ALLOWED_TEXT_SIZE_EXCEPTIONS.has(cls)) continue;
        context.report({ loc, messageId: 'forbiddenTextSize', data: { className: cls } });
      }

      // Check leading (line-height)
      LEADING_REGEX.lastIndex = 0;
      while ((match = LEADING_REGEX.exec(value)) !== null) {
        const cls = match[0];
        if (ALLOWED_LEADING.has(cls)) continue;
        context.report({ loc, messageId: 'forbiddenLeading', data: { className: cls } });
      }

      // Check font-weight
      FONT_WEIGHT_REGEX.lastIndex = 0;
      while ((match = FONT_WEIGHT_REGEX.exec(value)) !== null) {
        const cls = match[0];
        if (ALLOWED_FONT_WEIGHT.has(cls)) continue;
        context.report({ loc, messageId: 'forbiddenFontWeight', data: { className: cls } });
      }
    });
  },
};
