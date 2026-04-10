// @ts-check
'use strict';

/**
 * @fileoverview Enforces that bg-surface-* classes always have a dark: counterpart.
 *
 * Per CLAUDE.md: "Siempre proporcionar variante dark cuando se usan tokens de surface"
 *
 * Required pairs (any of the listed dark shades is accepted):
 *   bg-surface-0   → dark:bg-surface-950 or dark:bg-surface-900
 *   bg-surface-50  → dark:bg-surface-950 or dark:bg-surface-900
 *   bg-surface-100 → dark:bg-surface-800
 *   bg-surface-200 → dark:bg-surface-700
 *   bg-surface-900 → (used as dark variant itself, no pair needed)
 *   bg-surface-950 → (used as dark variant itself, no pair needed)
 *
 * Handles variant prefixes (active:, hover:, !) on both light and dark classes.
 * E.g. "active:bg-surface-200 dark:active:bg-surface-700" is a valid pair.
 *
 * Scans: class, styleClass, [ngClass], [class], and all PrimeNG *StyleClass attributes.
 *
 * NOTE: This rule checks within a SINGLE class string (one attribute value).
 * If light and dark classes are split across `class` and `[ngClass]` on the same element,
 * this rule cannot verify the pair. This is a known limitation.
 */

const { createClassAttrVisitor } = require('../utils');

// Surface shades that REQUIRE a dark: pair when used as bg-surface-*
// Maps the light shade to an array of accepted dark counterpart shades
const SURFACE_PAIRS = new Map([
  ['0', ['950', '900']],
  ['50', ['950', '900']],
  ['100', ['800']],
  ['200', ['700', '800']],
]);

// Strategy: split the class string into individual classes, then categorize each.
// This avoids regex overlap issues (e.g. matching bg-surface-0 inside dark:bg-surface-0).

/**
 * Extracts surface shade from a single class token.
 * Returns { shade, isDark } or null if not a bg-surface class.
 */
function parseSurfaceClass(cls) {
  // Strip variant prefixes to get the core utility
  // E.g. "dark:active:!bg-surface-700" → isDark=true, shade=700
  //       "active:bg-surface-200"       → isDark=false, shade=200
  //       "!bg-surface-0"               → isDark=false, shade=0
  const isDark = cls.includes('dark:');
  // Remove all prefixes to get to bg-surface-{shade}
  const bgMatch = cls.match(/bg-surface-(\d+)/);
  if (!bgMatch) return null;
  return { shade: bgMatch[1], isDark };
}

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require dark: counterpart for bg-surface-* classes. Per design system: never use bg-surface-* without dark:bg-surface-*.',
    },
    schema: [],
    messages: {
      missingDarkPair:
        '"bg-surface-{{shade}}" requires a dark mode pair. Add "dark:bg-surface-{{expectedDark}}" to the same element.',
      wrongDarkPair:
        '"bg-surface-{{shade}}" is paired with "dark:bg-surface-{{actualDark}}" but expected one of: {{expectedOptions}}.',
    },
  },
  create(context) {
    return createClassAttrVisitor(context, (value, loc) => {
      // Split into individual class tokens and categorize
      const tokens = value.split(/\s+/).filter(Boolean);
      const lightShades = new Set();
      const darkShades = new Set();

      for (const token of tokens) {
        const parsed = parseSurfaceClass(token);
        if (!parsed) continue;
        if (parsed.isDark) {
          darkShades.add(parsed.shade);
        } else {
          lightShades.add(parsed.shade);
        }
      }

      // No light bg-surface-* found — nothing to check
      if (lightShades.size === 0) return;

      // Check each light shade that requires a pair
      for (const shade of lightShades) {
        const expectedDarkOptions = SURFACE_PAIRS.get(shade);

        // Shades like 900, 950 are used AS dark variants — no pair needed
        if (!expectedDarkOptions) continue;

        // Check if any of the accepted dark shades is present
        const hasPair = expectedDarkOptions.some((d) => darkShades.has(d));

        if (!hasPair) {
          if (darkShades.size > 0) {
            const actualDark = [...darkShades][0];
            context.report({
              loc,
              messageId: 'wrongDarkPair',
              data: {
                shade,
                actualDark,
                expectedOptions: expectedDarkOptions.map((d) => `dark:bg-surface-${d}`).join(' or '),
              },
            });
          } else {
            context.report({
              loc,
              messageId: 'missingDarkPair',
              data: {
                shade,
                expectedDark: expectedDarkOptions[0],
              },
            });
          }
        }
      }
    });
  },
};
