// @ts-check
'use strict';

/**
 * @fileoverview Requires icon-only p-button elements to have a pTooltip attribute.
 *
 * Icon-only buttons (those without a `label`) are visually ambiguous.
 * A tooltip ensures the user understands the button's purpose on hover, matching
 * the standard set by GitHub, Linear, Figma, and other big-tech UIs.
 *
 * This rule reports when a `<p-button>` has no `label` attribute and no `pTooltip`
 * directive. This covers both `icon="..."` buttons and buttons with projected icon
 * content (e.g. `<p-button><i class="fa-..."></i></p-button>`).
 */

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Icon-only <p-button> must have a pTooltip attribute so users can discover its purpose on hover.',
      url: '../../docs/rules/no-icon-button-without-tooltip.md',
    },
    schema: [],
    messages: {
      missingTooltip:
        'Icon-only <p-button> is missing pTooltip. Add pTooltip="..." to describe the action.',
    },
  },
  create(context) {
    const parserServices = context.sourceCode.parserServices;

    return {
      Element(node) {
        if (node.name !== 'p-button') return;

        const allAttrs = [...(node.attributes || []), ...(node.inputs || [])];

        const hasLabel = allAttrs.some((a) => a.name === 'label');
        if (hasLabel) return;

        const hasTooltip = allAttrs.some((a) => a.name === 'pTooltip');
        if (hasTooltip) return;

        context.report({
          loc: parserServices.convertNodeSourceSpanToLoc(node.sourceSpan),
          messageId: 'missingTooltip',
        });
      },
    };
  },
};
