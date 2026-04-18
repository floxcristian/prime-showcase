// @ts-check
'use strict';

/**
 * @fileoverview Requires plain `<button>` elements to declare an explicit `type`.
 *
 * HTML defaults `<button>` inside a `<form>` to `type="submit"`. A button meant
 * for a side-effect (open menu, toggle state) that lacks `type` will submit the
 * form when clicked — silent form submission bug. The fix is always:
 *   <button type="button" ...>
 *
 * Scope: only plain `<button>` tags. `[pButton]` / `<p-button>` are exempt
 * because PrimeNG renders its own button with `type="button"` by default.
 */

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Plain <button> elements must declare an explicit type attribute to avoid accidental form submission.',
      url: '../../docs/rules/no-button-without-type.md',
    },
    schema: [],
    messages: {
      missingType:
        '<button> is missing the `type` attribute. Add `type="button"` (or `type="submit"` / `type="reset"` when appropriate) to avoid default form submission.',
    },
  },
  create(context) {
    const parserServices = context.sourceCode.parserServices;

    return {
      Element(node) {
        if (node.name !== 'button') return;

        const allAttrs = [...(node.attributes || []), ...(node.inputs || [])];

        // pButton directive present → PrimeNG owns type (defaults to "button")
        const hasPButton = allAttrs.some((a) => a.name === 'pButton');
        if (hasPButton) return;

        const hasType = allAttrs.some(
          (a) => a.name === 'type' || a.name === 'attr.type',
        );
        if (hasType) return;

        context.report({
          loc: parserServices.convertNodeSourceSpanToLoc(node.sourceSpan),
          messageId: 'missingType',
        });
      },
    };
  },
};
