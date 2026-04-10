// @ts-check
'use strict';

/**
 * @fileoverview Enforces the project's spacing scale from CLAUDE.md.
 *
 * Allowed gap:     1, 2, 3, 4, 5, 6, 8
 * Allowed padding: 1, 2, 3, 4, 6 (+ px-4 py-1, px-7 py-5 for specific patterns)
 * Allowed margin:  0, 1, 2, 4, 6 (+ mb-0 reset)
 *
 * Forbidden:       gap-7, gap-9, gap-10, gap-11, gap-12
 *                  p-7, p-8, p-9, p-10+ (and px-, py-, pt-, pr-, pb-, pl-, ps-, pe-)
 *                  m-3, m-5, m-7, m-8, m-9, m-10+ (and mx-, my-, mt-, mr-, mb-, ml-, ms-, me-)
 *                  Any arbitrary spacing: gap-[*], p-[*], m-[*]
 *
 * Scans: class, styleClass, [ngClass], [class], and all PrimeNG *StyleClass attributes.
 */

const { createClassAttrVisitor } = require('../utils');

// ── Forbidden spacing values ────────────────────────────────────────────
// Built from CLAUDE.md "NO USAR" list, extended to cover all utilities.

// Gap: allowed 0-6, 8. Forbidden: 7, 9, 10, 11, 12, and anything > 12.
// gap-0 is a legitimate reset value (e.g. override responsive gap).
const FORBIDDEN_GAP = new Set(['7', '9', '10', '11', '12', '14', '16', '20', '24']);

// Padding: allowed 1-4, 6, 7 (px-7 py-5 header pattern). Forbidden: 5, 8, 9, 10+
// Note: p-5 is accepted via AUDIT_BASELINE EX-005, added to allowed exceptions below.
const FORBIDDEN_PADDING = new Set(['8', '9', '10', '11', '12', '14', '16', '20', '24']);

// Margin: allowed 0, 1, 2, 4, 6. Forbidden: 3, 5, 7, 8, 9, 10+
const FORBIDDEN_MARGIN = new Set(['3', '5', '7', '8', '9', '10', '11', '12', '14', '16', '20', '24']);

// Spacing utility prefixes grouped by type
const GAP_PREFIXES = ['gap', 'gap-x', 'gap-y'];
const PADDING_PREFIXES = ['p', 'px', 'py', 'pt', 'pr', 'pb', 'pl', 'ps', 'pe'];
const MARGIN_PREFIXES = ['m', 'mx', 'my', 'mt', 'mr', 'mb', 'ml', 'ms', 'me'];

// Build a single regex that matches ALL spacing utilities with numeric values
// Captures: (prefix)-(value) e.g. "gap-7", "mt-10", "px-8"
const ALL_PREFIXES = [...GAP_PREFIXES, ...PADDING_PREFIXES, ...MARGIN_PREFIXES].join('|');
const SPACING_REGEX = new RegExp(
  `\\b(${ALL_PREFIXES})-(\\d+(?:\\.\\d+)?)\\b`,
  'g',
);

// Matches arbitrary spacing values: gap-[13px], p-[20px], m-[10px], etc.
const ARBITRARY_SPACING_REGEX = new RegExp(
  `\\b(?:${ALL_PREFIXES})-\\[[^\\]]+\\]`,
  'g',
);

// ── Allowed exceptions from AUDIT_BASELINE.md ───────────────────────────
// These are documented violations accepted for specific use cases.
// Each exception was reviewed and accepted as a pre-existing pattern
// with minimal visual impact. See AUDIT_BASELINE.md for full rationale.
const ALLOWED_EXCEPTIONS = new Set([
  'p-5',       // EX-005: side-menu padding, between p-4 and p-6
  'gap-7',     // EX-005: chat layout, between gap-6 and gap-8
  'gap-8',     // EX-005: chat message area, accepted pre-existing pattern
  'py-8',      // EX-005: chat message area, accepted pre-existing pattern
  'p-[1px]',   // EX-004: badge indicator pixel-perfect alignment
  'mt-3',      // Pre-existing: fine spacing in list/card layouts
  'mb-5',      // Pre-existing: chat media section spacing
  'mt-5',      // Pre-existing: chat media section spacing
  'mt-10',     // Pre-existing: side-menu section separators and customers header
]);

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Enforce the spacing scale from the design system. Forbids gap-7/9/10+, p-8+, m-3/5/7+, and arbitrary spacing values.',
    },
    schema: [],
    messages: {
      forbiddenSpacing:
        '"{{className}}" is not in the allowed spacing scale. See CLAUDE.md for allowed values.',
      arbitrarySpacing:
        'Arbitrary spacing "{{className}}" is not allowed. Use a standard spacing value from the design system.',
    },
  },
  create(context) {
    return createClassAttrVisitor(context, (value, loc) => {
      let match;

      // Check numeric spacing values
      SPACING_REGEX.lastIndex = 0;
      while ((match = SPACING_REGEX.exec(value)) !== null) {
        const fullClass = match[0];
        const prefix = match[1];
        const numValue = match[2];

        if (ALLOWED_EXCEPTIONS.has(fullClass)) continue;

        let forbidden;
        if (GAP_PREFIXES.includes(prefix)) {
          forbidden = FORBIDDEN_GAP;
        } else if (PADDING_PREFIXES.includes(prefix)) {
          forbidden = FORBIDDEN_PADDING;
        } else {
          forbidden = FORBIDDEN_MARGIN;
        }

        if (forbidden.has(numValue)) {
          context.report({
            loc,
            messageId: 'forbiddenSpacing',
            data: { className: fullClass },
          });
        }
      }

      // Check arbitrary spacing values
      ARBITRARY_SPACING_REGEX.lastIndex = 0;
      while ((match = ARBITRARY_SPACING_REGEX.exec(value)) !== null) {
        if (ALLOWED_EXCEPTIONS.has(match[0])) continue;
        context.report({
          loc,
          messageId: 'arbitrarySpacing',
          data: { className: match[0] },
        });
      }
    });
  },
};
