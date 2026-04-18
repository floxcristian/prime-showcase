// @ts-check
'use strict';

const { createClassAttrVisitor } = require('../utils');

/**
 * @fileoverview Forbids bare Font Awesome family classes without a `fa-sharp`
 * (or `fa-sharp-duotone`, or `fa-brands`) prefix.
 *
 * The project loads ONLY the Sharp families (regular/solid/duotone) plus brands.
 * A bare `fa-regular fa-star` produces an invisible icon because the
 * non-sharp stylesheet is not loaded. Silent rendering failure → UX bug.
 *
 * Valid:
 *   fa-sharp fa-regular fa-star
 *   fa-sharp fa-solid fa-star
 *   fa-sharp-duotone fa-regular fa-cloud text-4xl
 *   fa-brands fa-github
 *
 * Invalid:
 *   fa-regular fa-star        → missing `fa-sharp`
 *   fa-solid fa-bell          → missing `fa-sharp`
 *   fa-light fa-x             → light variant not loaded
 *   fa-duotone fa-x           → duotone not loaded (only sharp-duotone is)
 */

// Matches a style class token that REQUIRES a family prefix:
//   fa-regular | fa-solid | fa-light | fa-duotone
// Detected as whole-word tokens so we don't match e.g. "fa-regularized".
const STYLE_TOKEN_RE = /\b(fa-(?:regular|solid|light|duotone))\b/g;

// A valid prefix appears in the SAME class string as the style token.
const VALID_PREFIX_RE = /\bfa-sharp(?:-duotone)?\b|\bfa-brands\b/;

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Font Awesome style classes (fa-regular, fa-solid, etc.) must be paired with fa-sharp or fa-brands; bare style classes produce invisible icons because only the Sharp families are loaded.',
      url: '../../docs/rules/no-bare-fa-without-sharp.md',
    },
    schema: [],
    messages: {
      missingSharp:
        '"{{ token }}" is not loaded standalone — the project loads only the Sharp families. Use "fa-sharp {{ token }}" (or "fa-sharp-duotone {{ token }}" for hero icons).',
    },
  },
  create(context) {
    return createClassAttrVisitor(context, (value, ctx) => {
      if (!value || typeof value !== 'string') return;
      if (VALID_PREFIX_RE.test(value)) return;

      STYLE_TOKEN_RE.lastIndex = 0;
      /** @type {RegExpMatchArray | null} */
      let match;
      while ((match = STYLE_TOKEN_RE.exec(value)) !== null) {
        ctx.report(match, 'missingSharp', { token: match[1] });
      }
    });
  },
};
