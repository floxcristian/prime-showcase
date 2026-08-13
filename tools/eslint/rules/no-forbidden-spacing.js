// @ts-check
'use strict';

/**
 * @fileoverview Enforces the project's spacing scale from DESIGN.md as an
 * ALLOW-LIST.
 *
 * The rule used to be a deny-list of known-bad values (gap-7, p-8, m-3…),
 * which silently let anything NOT enumerated through: `gap-13`, `p-32`,
 * `m-40`, `pt-96`, etc. Inverting to an allow-list means any value outside
 * the approved scale is flagged by default — new Tailwind steps can't creep
 * in unnoticed.
 *
 * Allowed values per family (see DESIGN.md § "Spacing — escala permitida"):
 *   gap:     0, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 8
 *   padding: 0, 0.5, 1, 1.5, 2, 3, 3.5, 4, 5, 6
 *   margin:  0, 0.5, 1, 2, 4, 6
 *
 * Plus documented full-class exceptions (AUDIT_BASELINE.md EX-004/005/006
 * and pre-existing patterns): gap-7, px-7, py-8, px-12, p-[1px], mt-3,
 * mt-5, mb-5, mt-10.
 *
 * Fractional steps (0.5, 1.5, 3.5) are included because they're in real use
 * for fine-detail alignment (badges, timestamps, table paddings) — same
 * micro-UI rationale as EX-004.
 *
 * Arbitrary values (gap-[13px], p-[2rem]…) stay forbidden except p-[1px].
 *
 * Scans: class, styleClass, [ngClass], [class], and all PrimeNG *StyleClass
 * attributes. Negative (-mx-2) and important (!p-0) variants are validated
 * against the same value sets (the regex matches the inner utility token).
 */

const { createClassAttrVisitor } = require('../utils');

// ── Allowed spacing values (allow-list) ─────────────────────────────────
// DESIGN.md scale + fractional fine-detail steps in real use in src/**.

// Gap: DESIGN.md `gap-1 … gap-6 | gap-8`. gap-0 is a legitimate reset
// (e.g. override a responsive gap). 0.5/1.5 = fine-detail steps.
const ALLOWED_GAP = new Set(['0', '0.5', '1', '1.5', '2', '3', '4', '5', '6', '8']);

// Padding: DESIGN.md `p-1 … p-4 | p-6` + p-5 (EX-005 side-menu) + py-5
// (cabecera expandida). 0/0.5/1.5/3.5 = resets and fine-detail steps.
const ALLOWED_PADDING = new Set(['0', '0.5', '1', '1.5', '2', '3', '3.5', '4', '5', '6']);

// Margin: DESIGN.md `mt-1 | mt-2/mb-2 | mt-4/mb-4 | mt-6/mb-6 | mb-0`.
// 0.5 = fine-detail step (mt-0.5 timestamps).
const ALLOWED_MARGIN = new Set(['0', '0.5', '1', '2', '4', '6']);

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

// ── Allowed full-class exceptions ───────────────────────────────────────
// Documented violations accepted for specific use cases — reviewed and
// accepted as pre-existing patterns with minimal visual impact. These are
// FULL class names (prefix + value), narrower than adding the value to the
// family-wide allow set. See AUDIT_BASELINE.md for full rationale.
const ALLOWED_EXCEPTIONS = new Set([
  'gap-7',     // EX-005: chat layout, between gap-6 and gap-8
  'px-7',      // DESIGN.md "cabecera expandida": py-5 px-7 card header pattern
  'py-8',      // EX-005: chat message area, accepted pre-existing pattern
  'px-12',     // EX-006: login brand panel — 48px horizontal al estilo Stripe/Linear/Supabase. Vertical usa py-8 para no exceder el viewport 720p.
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
        'Enforce the spacing scale from the design system as an allow-list. Any gap/padding/margin value outside the approved scale (plus documented exceptions) is flagged, including arbitrary values.',
      url: '../../docs/rules/no-forbidden-spacing.md',
    },
    schema: [],
    messages: {
      forbiddenSpacing:
        '"{{className}}" is not in the allowed spacing scale. See DESIGN.md § Spacing for allowed values.',
      arbitrarySpacing:
        'Arbitrary spacing "{{className}}" is not allowed. Use a standard spacing value from the design system.',
    },
  },
  create(context) {
    return createClassAttrVisitor(context, (value, ctx) => {
      let match;

      SPACING_REGEX.lastIndex = 0;
      while ((match = SPACING_REGEX.exec(value)) !== null) {
        const fullClass = match[0];
        const prefix = match[1];
        const numValue = match[2];

        if (ALLOWED_EXCEPTIONS.has(fullClass)) continue;

        let allowed;
        if (GAP_PREFIXES.includes(prefix)) {
          allowed = ALLOWED_GAP;
        } else if (PADDING_PREFIXES.includes(prefix)) {
          allowed = ALLOWED_PADDING;
        } else {
          allowed = ALLOWED_MARGIN;
        }

        if (!allowed.has(numValue)) {
          ctx.report(match, 'forbiddenSpacing', { className: fullClass });
        }
      }

      ARBITRARY_SPACING_REGEX.lastIndex = 0;
      while ((match = ARBITRARY_SPACING_REGEX.exec(value)) !== null) {
        if (ALLOWED_EXCEPTIONS.has(match[0])) continue;
        ctx.report(match, 'arbitrarySpacing', { className: match[0] });
      }
    });
  },
};
