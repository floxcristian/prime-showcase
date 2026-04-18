// @ts-check
'use strict';

/**
 * @fileoverview Requires `aria-hidden="true"` on decorative `<i>` icons.
 *
 * Font Awesome's own guidance: icons placed with `<i class="fa-*">` are
 * decorative by default — the semantic meaning lives in the adjacent text
 * (or in `aria-label` on the parent button). Without `aria-hidden="true"`,
 * screen readers may announce the icon's font character, which leaks garbage
 * into the accessible name.
 *
 * Rule:
 *   Every `<i>` element carrying a Font Awesome class (matches /\bfa-/ in
 *   any class-carrying attribute — `class`, `[ngClass]`, `[class]`, or any
 *   `*StyleClass` binding) MUST declare `aria-hidden="true"` or the Angular
 *   binding `[attr.aria-hidden]="true"`.
 *
 * Exempt:
 *   - `<i>` without any `fa-*` class (used as emphasis in copy — rare but valid)
 *
 * If an icon needs to convey semantic meaning (no adjacent text label),
 * use `<span role="img" aria-label="..."></span>` instead of `<i>`.
 */

const { collectElementClassStrings } = require('../utils');

const FA_CLASS_RE = /\bfa-/;

function hasFontAwesomeClass(node) {
  return collectElementClassStrings(node).some((s) => FA_CLASS_RE.test(s));
}

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        '<i> icons must declare aria-hidden="true" — they are decorative and must not be announced by screen readers.',
      url: '../../docs/rules/no-decorative-icon-without-aria-hidden.md',
    },
    schema: [],
    messages: {
      missingAriaHidden:
        '<i> icon is missing aria-hidden="true". Icons are decorative; the accessible name should live on the parent button/control.',
    },
  },
  create(context) {
    const parserServices = context.sourceCode.parserServices;

    return {
      Element(node) {
        if (node.name !== 'i') return;
        if (!hasFontAwesomeClass(node)) return;

        const allAttrs = [...(node.attributes || []), ...(node.inputs || [])];

        const hasAriaHidden = allAttrs.some(
          (a) => a.name === 'aria-hidden' || a.name === 'attr.aria-hidden',
        );
        if (hasAriaHidden) return;

        context.report({
          loc: parserServices.convertNodeSourceSpanToLoc(node.sourceSpan),
          messageId: 'missingAriaHidden',
        });
      },
    };
  },
};
