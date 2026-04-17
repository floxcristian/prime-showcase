// @ts-check
'use strict';

/**
 * @fileoverview Forbids `transition-all` and the bare `transition` utility.
 *
 * Policy: CLAUDE.md §"Transiciones — narrow por default (política big-tech)" + ADR-001 §9.
 *
 * `transition-all` animates every animatable property (outline, box-shadow, transform,
 * border-color, etc.) so focus rings fade out on blur — inconsistent with PrimeNG's
 * `transitionDuration: '0s'` (instant focus ring). Big-tech UIs (GitHub, Linear,
 * Stripe, Vercel) use narrow transitions to keep focus rings crisp.
 *
 * In Tailwind 4, the bare `transition` utility is equivalent to `transition-all`
 * (it enables the default property list which includes "all"), so it's also prohibited.
 *
 * Allowed: transition-colors, transition-opacity, transition-transform, transition-none,
 *          transition-shadow, transition-[transform] (narrow arbitrary values).
 *
 * Forbidden cases covered:
 *   - `transition-all` / bare `transition` (plain)
 *   - `!transition-all` (important modifier before)
 *   - `hover:transition-all`, `md:transition-all`, `dark:transition-all`,
 *     `group-hover:transition-all` (any variant prefix)
 *   - `md:!transition-all` (important modifier after prefix)
 *   - `transition-[all]` (arbitrary "all")
 *   - `transition-[box-shadow,color,border-color,outline]` (arbitrary with forbidden props)
 *
 * Scans: class, styleClass, routerLinkActive, and all PrimeNG *StyleClass attributes.
 */

const { createClassAttrVisitor } = require('../utils');

// Matches `transition` or `transition-all` as a standalone token.
// - Leading: start-of-string OR whitespace OR `:` (variant prefix separator)
// - Optional `!` important modifier
// - Token: `transition` or `transition-all`
// - Trailing: whitespace OR end-of-string (lookahead, not consumed)
//
// This covers:
//   transition-all, transition, !transition-all, !transition,
//   hover:transition-all, md:transition-all, dark:transition-all,
//   group-hover:transition-all, md:!transition-all, etc.
const FORBIDDEN_TRANSITION_REGEX = /(?:^|\s|:)(!?transition(?:-all)?)(?=\s|$)/g;

// Matches arbitrary transition values that include forbidden properties.
// e.g. transition-[all], transition-[box-shadow,color], md:transition-[outline]
// Narrow arbitrary values like transition-[transform] pass through.
const FORBIDDEN_ARBITRARY_REGEX =
  /(?:^|\s|:)!?transition-\[(?:[^\]]*\b(?:all|box-shadow|border-color|outline)\b[^\]]*)\]/g;

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow `transition-all` and the bare `transition` utility. Use narrow transitions (transition-colors, transition-opacity, transition-transform).',
      url: '../../docs/rules/no-forbidden-transitions.md',
    },
    hasSuggestions: true,
    schema: [],
    messages: {
      noForbiddenTransition:
        '"{{className}}" is prohibited. Use narrow transitions: transition-colors (hover states), transition-opacity (images/avatars), or transition-transform (movement). See CLAUDE.md §Transiciones and ADR-001 §9.',
      noForbiddenArbitrary:
        'Arbitrary transition "{{className}}" includes forbidden properties (all/box-shadow/border-color/outline). Use narrow explicit values like transition-[transform] instead.',
      suggestReplaceColors: 'Replace with transition-colors (for bg/text hover states)',
      suggestReplaceOpacity: 'Replace with transition-opacity (for images/avatars)',
      suggestReplaceTransform: 'Replace with transition-transform (for movement)',
    },
  },
  create(context) {
    return createClassAttrVisitor(context, (value, ctx) => {
      let match;

      FORBIDDEN_TRANSITION_REGEX.lastIndex = 0;
      while ((match = FORBIDDEN_TRANSITION_REGEX.exec(value)) !== null) {
        // match[0] may include a leading space or colon (part of the separator).
        // match[1] is the captured forbidden token (e.g. "transition-all" or "!transition").
        const fullMatchText = match[1];
        // Adjust the match index to point at the captured group, not the separator.
        const tokenIndex = match.index + match[0].length - fullMatchText.length;
        // Build a synthetic "match" with correct index/text for per-match loc.
        const tokenMatch = Object.assign([fullMatchText], { index: tokenIndex, input: value });

        ctx.report(tokenMatch, 'noForbiddenTransition', { className: fullMatchText }, {
          suggest: buildSuggestions(ctx, tokenMatch, value),
        });
      }

      FORBIDDEN_ARBITRARY_REGEX.lastIndex = 0;
      while ((match = FORBIDDEN_ARBITRARY_REGEX.exec(value)) !== null) {
        // Extract the arbitrary-value token from the match (skip leading separator char).
        const full = match[0];
        const leadingSepLen = /^(?:\s|:)/.test(full) ? 1 : 0;
        const tokenText = full.slice(leadingSepLen);
        const tokenIndex = match.index + leadingSepLen;
        const tokenMatch = Object.assign([tokenText], { index: tokenIndex, input: value });

        ctx.report(tokenMatch, 'noForbiddenArbitrary', { className: tokenText }, {
          suggest: buildSuggestions(ctx, tokenMatch, value),
        });
      }
    });
  },
};

/**
 * Build suggestion fixers for a forbidden transition match.
 *
 * Each suggestion replaces the offending token in-source with the narrow variant.
 * Preserves any variant prefix (hover:, md:, !) on the replacement.
 *
 * For bound attributes (where ctx is non-static), we don't provide fixers because
 * the match offset doesn't map to a precise source range reliably.
 */
function buildSuggestions(ctx, match, value) {
  if (!ctx.isStatic || !ctx.node.valueSpan) return [];

  const token = match[0];
  // Extract any prefix (everything before "transition"): e.g. "hover:!", "md:", "!"
  const transitionIdx = token.indexOf('transition');
  const prefix = transitionIdx > 0 ? token.slice(0, transitionIdx) : '';

  const makeFix = (replacement) => (fixer) => {
    const valueStart = ctx.node.valueSpan.start.offset;
    const tokenStart = valueStart + match.index;
    const tokenEnd = tokenStart + token.length;
    return fixer.replaceTextRange([tokenStart, tokenEnd], prefix + replacement);
  };

  return [
    { messageId: 'suggestReplaceColors', fix: makeFix('transition-colors') },
    { messageId: 'suggestReplaceOpacity', fix: makeFix('transition-opacity') },
    { messageId: 'suggestReplaceTransform', fix: makeFix('transition-transform') },
  ];
}
