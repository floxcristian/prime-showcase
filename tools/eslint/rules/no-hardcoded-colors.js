// @ts-check
'use strict';

/**
 * @fileoverview Forbids generic Tailwind color utilities in templates.
 * Only PrimeNG design tokens (text-color, bg-surface-*, bg-primary, etc.) are allowed.
 *
 * Scans: class, styleClass, and all PrimeNG *StyleClass attributes.
 *
 * Allowed exceptions (semantic data colors defined in CLAUDE.md):
 *   bg-violet-100, text-violet-950, bg-orange-100, text-orange-950, text-yellow-500
 */

const { createClassAttrVisitor } = require('../utils');

// Generic Tailwind color families — these must NEVER appear in templates.
const TAILWIND_COLOR_FAMILIES = [
  'slate',
  'gray',
  'zinc',
  'neutral',
  'stone',
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'emerald',
  'teal',
  'cyan',
  'sky',
  'blue',
  'indigo',
  'violet',
  'purple',
  'fuchsia',
  'pink',
  'rose',
];

const COLOR_FAMILIES_PATTERN = TAILWIND_COLOR_FAMILIES.join('|');

// All Tailwind utility prefixes that accept color values.
// Keep in sync across FORBIDDEN_REGEX, BW_REGEX, HEX_COLOR_REGEX, CSS_COLOR_FN_REGEX.
const COLOR_PREFIXES = 'text|bg|border|from|to|via|ring|ring-offset|outline|decoration|accent|caret|fill|stroke|divide|placeholder|shadow';

// Matches: text-gray-500, bg-blue-100, border-red-300, divide-gray-200, placeholder-gray-400, etc.
const FORBIDDEN_REGEX = new RegExp(
  `\\b(?:${COLOR_PREFIXES})-(?:${COLOR_FAMILIES_PATTERN})-\\d{2,3}\\b`,
  'g',
);

// Matches: text-white, text-black, bg-white, bg-black, divide-white, placeholder-black, etc.
// Also matches opacity variants like border-black/10, border-white/20
const BW_REGEX = new RegExp(
  `\\b(?:${COLOR_PREFIXES})-(?:white|black)(?:\\/\\d+)?\\b`,
  'g',
);

// Allowed black/white exceptions per CLAUDE.md (layout principal only)
const ALLOWED_BW_CLASSES = new Set([
  'border-black/10',
  'border-white/20',
]);

// Exceptions: semantic data colors allowed per CLAUDE.md
// These are for semantic indicators with fixed meaning (NOT general UI colors).
const ALLOWED_CLASSES = new Set([
  'bg-violet-100',   // Semantic indicators (tags, badges, categories)
  'text-violet-950',
  'bg-orange-100',   // Semantic indicators (alerts, warnings, categories)
  'text-orange-950',
  'text-yellow-500', // Crypto icons (BTC)
  'bg-yellow-500',   // Crypto badge background (BTC brand color)
  'text-green-500',  // Active/online status indicators (dot icons next to labels)
]);

// Matches hex colors in class strings (#fff, #f0f0f0, etc.) — catches accidental hardcoding
const HEX_COLOR_REGEX = new RegExp(
  `\\b(?:${COLOR_PREFIXES})-\\[#[0-9a-fA-F]{3,8}\\]`,
  'g',
);

// Matches arbitrary CSS color functions: bg-[rgb(...)], text-[hsl(...)], border-[oklch(...)], etc.
const CSS_COLOR_FN_REGEX = new RegExp(
  `\\b(?:${COLOR_PREFIXES})-\\[(?:rgb|rgba|hsl|hsla|oklch|oklab|lch|lab|color)\\(.*?\\)\\]`,
  'g',
);

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow generic Tailwind color utilities. Use PrimeNG design tokens instead (text-color, bg-surface-*, bg-primary, etc.).',
      url: '../../docs/rules/no-hardcoded-colors.md',
    },
    schema: [],
    messages: {
      noHardcodedColor:
        'Hardcoded color class "{{className}}" is not allowed. Use a PrimeNG design token instead (e.g. text-color, bg-surface-*, bg-primary).',
      noHexColor:
        'Arbitrary hex color "{{className}}" is not allowed. Use a PrimeNG design token or CSS variable instead.',
      noArbitraryColor:
        'Arbitrary CSS color "{{className}}" is not allowed. Use a PrimeNG design token or CSS variable instead.',
    },
  },
  create(context) {
    return createClassAttrVisitor(context, (value, ctx) => {
      let match;

      FORBIDDEN_REGEX.lastIndex = 0;
      while ((match = FORBIDDEN_REGEX.exec(value)) !== null) {
        if (ALLOWED_CLASSES.has(match[0])) continue;
        ctx.report(match, 'noHardcodedColor', { className: match[0] });
      }

      BW_REGEX.lastIndex = 0;
      while ((match = BW_REGEX.exec(value)) !== null) {
        if (ALLOWED_BW_CLASSES.has(match[0])) continue;
        ctx.report(match, 'noHardcodedColor', { className: match[0] });
      }

      HEX_COLOR_REGEX.lastIndex = 0;
      while ((match = HEX_COLOR_REGEX.exec(value)) !== null) {
        ctx.report(match, 'noHexColor', { className: match[0] });
      }

      CSS_COLOR_FN_REGEX.lastIndex = 0;
      while ((match = CSS_COLOR_FN_REGEX.exec(value)) !== null) {
        ctx.report(match, 'noArbitraryColor', { className: match[0] });
      }
    });
  },
};
