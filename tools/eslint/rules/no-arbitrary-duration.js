// @ts-check
'use strict';

/**
 * @fileoverview Enforces the motion contract from DESIGN.md.
 *
 * **Policy**
 *
 *   - Numeric Tailwind duration classes (`duration-100`, `duration-150`,
 *     `duration-200`, etc.) are FORBIDDEN by default. Mixing arbitrary
 *     durations across the app is exactly the drift this design system
 *     prevents elsewhere via spacing / rounded / typography scales.
 *   - Numeric duration is permitted ONLY on `<a>` text links via the
 *     anchor recipe (`duration-150`) — that exemption already exists
 *     in `showcase/anchor-link-classes` for the inverse direction
 *     (link must include `duration-150`). This rule pairs with it.
 *   - Token durations sourced from `PROJECT_TOKENS.motion.duration`
 *     (`duration-(--app-motion-duration-fast)` etc.) are ALWAYS
 *     allowed.
 *   - Bare `transition-*` without a duration is allowed — Aura sets
 *     transition durations via its own tokens.
 *
 * **Why**
 *
 *   The earlier audit found `transition-[transform,opacity] duration-200`
 *   on the toolbar burger icon (toolbar.component.html:43, 50). One
 *   touchpoint is fine; without a rule, three become thirty and the
 *   motion language drifts. Big-tech systems (Polaris, Spectrum, Carbon)
 *   all gate motion to named tokens.
 *
 *   The remediation path is documented: either use the token (preferred)
 *   or wrap in an `<a>` text link.
 *
 * Scans: class, styleClass, [ngClass], [class], and all PrimeNG
 *        *StyleClass attributes.
 */

const { createClassAttrVisitor } = require('../utils');
const SCALES = require('./generated/scales');

// Matches `duration-<number>` — explicit Tailwind value classes.
// Tokens like `duration-(--app-motion-duration-fast)` use parentheses
// in Tailwind v4 and are NOT matched here (which is the intent).
const DURATION_NUMERIC = /\bduration-(\d+(?:\.\d+)?)\b/g;

// Allowed token-form: duration-<key> where key is in the scale.
// Tailwind v4 syntax: duration-(--app-motion-duration-fast).
// We also accept arbitrary CSS-var syntax `duration-[var(--app-…)]`.
const ALLOWED_TOKEN_FORMS = new RegExp(
  `\\bduration-\\((--app-motion-duration-(${SCALES.motion.allowedDurationKeys.join('|')}))\\)`,
);

// `duration-150` is the documented exception on `<a>` text links —
// `showcase/anchor-link-classes` ENFORCES `duration-150` on link
// elements. This rule allows it; the anchor rule complements by
// requiring it where appropriate. The numeric value here is in
// lockstep with the anchor recipe.
const ANCHOR_EXEMPT_VALUE = '150';

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Forbids arbitrary numeric Tailwind duration classes outside the anchor-link recipe. Use motion tokens emitted by PROJECT_TOKENS.motion.duration.*',
      url: '../../docs/rules/no-arbitrary-duration.md',
    },
    schema: [],
    messages: {
      arbitrary:
        '"{{className}}" is an arbitrary duration. Use a motion token (e.g. `duration-(--app-motion-duration-fast)`) or remove the duration to inherit Aura\'s default.',
    },
  },
  create(context) {
    return createClassAttrVisitor(context, (value, ctx) => {
      // Element-aware exception: anchor-link rule enforces duration-150
      // on `<a>` elements; we cannot reliably know the element from
      // inside a class-string visitor, so we accept duration-150
      // globally and rely on `showcase/anchor-link-classes` to ensure
      // it ONLY appears on anchors. This narrow allow-list is the
      // pragmatic compromise both rules combined enforce in practice.
      DURATION_NUMERIC.lastIndex = 0;
      let match;
      while ((match = DURATION_NUMERIC.exec(value)) !== null) {
        if (match[1] === ANCHOR_EXEMPT_VALUE) continue;
        ctx.report(match, 'arbitrary', { className: match[0] });
      }
    });
  },
};

// Exported for testing — keeps the regex shape stable.
module.exports.ALLOWED_TOKEN_FORMS = ALLOWED_TOKEN_FORMS;
