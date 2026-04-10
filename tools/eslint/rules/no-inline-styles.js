// @ts-check
'use strict';

/**
 * @fileoverview Forbids static inline `style="..."` attributes in templates.
 * Dynamic bindings ([style.*]="expr" and [ngStyle]="expr") are allowed for
 * data-driven values like chart colors.
 *
 * The project convention is:
 *   - Use Tailwind classes for all styling
 *   - Use [style.backgroundColor]="item.color" for dynamic data-driven values
 *   - Never use static style="" attributes
 */

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow static inline style attributes. Use Tailwind classes or dynamic [style.*] bindings instead.',
    },
    schema: [],
    messages: {
      noInlineStyle:
        'Static inline style="{{value}}" is not allowed. Use Tailwind classes or [style.*]="expression" for dynamic values.',
    },
  },
  create(context) {
    return {
      'TextAttribute[name="style"]'(node) {
        if (!node.value) return;

        const parserServices = context.sourceCode.parserServices;
        context.report({
          loc: parserServices.convertNodeSourceSpanToLoc(node.sourceSpan),
          messageId: 'noInlineStyle',
          data: { value: node.value.length > 40 ? node.value.slice(0, 40) + '...' : node.value },
        });
      },
    };
  },
};
