// @ts-check
'use strict';

const { extractClassStrings, CLASS_ATTRIBUTE_NAMES, BOUND_CLASS_ATTR_NAMES } = require('../utils');

/**
 * @fileoverview Forbids bare Font Awesome family classes without a `fa-sharp`
 * (or `fa-sharp-duotone`, or `fa-brands`) prefix.
 *
 * The project loads ONLY the Sharp families (regular/solid/duotone) plus brands.
 * A bare `fa-regular fa-star` produces an invisible icon because the
 * non-sharp stylesheet is not loaded. Silent rendering failure → UX bug.
 *
 * ## Element-level scan
 *
 * The rule visits ELEMENTS (pattern of text-3xl-requires-bold), not isolated
 * class strings, because the runtime unit is the element's final class list:
 *
 *   <i class="fa-sharp" [ngClass]="{ 'fa-regular': cond }"></i>   ← valid
 *
 * The `fa-sharp` prefix in the STATIC `class` attribute is always applied,
 * so whenever the conditional `fa-regular` kicks in the pair resolves to a
 * loaded face. A per-string scan flagged this as a false positive.
 *
 * Conditional sources (`[ngClass]` object keys, ternary branches) are NOT
 * treated as an always-on prefix — in
 *
 *   <i [ngClass]="cond ? 'fa-solid fa-star' : 'fa-sharp fa-regular fa-star'"></i>
 *
 * only one branch applies at runtime, so the `fa-solid` branch still renders
 * an invisible icon and is still reported. Decision procedure:
 *
 *   1. Any STATIC class-bearing attribute contains a valid prefix → element
 *      exempt (the prefix is unconditionally present).
 *   2. Otherwise each class string stands alone: strings that carry their
 *      own prefix pass; bare style tokens are reported.
 *
 * Valid:
 *   fa-sharp fa-regular fa-star
 *   fa-sharp fa-solid fa-star
 *   fa-sharp-duotone fa-regular fa-cloud text-4xl
 *   fa-brands fa-github
 *   class="fa-sharp" [ngClass]="{'fa-regular': cond}"   (static prefix + conditional token)
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

// A valid prefix — in the same class string, or in any STATIC class string
// of the element (always applied at runtime).
const VALID_PREFIX_RE = /\bfa-sharp(?:-duotone)?\b|\bfa-brands\b/;

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Font Awesome style classes (fa-regular, fa-solid, etc.) must be paired with fa-sharp or fa-brands on the same element; bare style classes produce invisible icons because only the Sharp families are loaded.',
      url: '../../docs/rules/no-bare-fa-without-sharp.md',
    },
    schema: [],
    messages: {
      missingSharp:
        '"{{ token }}" is not loaded standalone — the project loads only the Sharp families. Use "fa-sharp {{ token }}" (or "fa-sharp-duotone {{ token }}" for hero icons).',
    },
  },
  create(context) {
    const parserServices = context.sourceCode.parserServices;

    return {
      Element(node) {
        /** @type {string[]} */
        const staticStrings = [];
        for (const attr of node.attributes || []) {
          if (!CLASS_ATTRIBUTE_NAMES.has(attr.name)) continue;
          if (typeof attr.value !== 'string') continue;
          staticStrings.push(attr.value);
        }

        /** @type {string[]} */
        const boundStrings = [];
        for (const input of node.inputs || []) {
          if (!BOUND_CLASS_ATTR_NAMES.has(input.name)) continue;
          if (!input.value) continue;
          boundStrings.push(...extractClassStrings(input.value));
        }

        if (staticStrings.length === 0 && boundStrings.length === 0) return;

        // Static class attributes are ALWAYS applied — a prefix there covers
        // every conditional style token on the element.
        if (staticStrings.some((s) => VALID_PREFIX_RE.test(s))) return;

        const loc = parserServices.convertNodeSourceSpanToLoc(node.sourceSpan);

        for (const value of [...staticStrings, ...boundStrings]) {
          // A string carrying its own prefix is self-sufficient.
          if (VALID_PREFIX_RE.test(value)) continue;

          STYLE_TOKEN_RE.lastIndex = 0;
          /** @type {RegExpMatchArray | null} */
          let match;
          while ((match = STYLE_TOKEN_RE.exec(value)) !== null) {
            context.report({
              loc,
              messageId: 'missingSharp',
              data: { token: match[1] },
            });
          }
        }
      },
    };
  },
};
