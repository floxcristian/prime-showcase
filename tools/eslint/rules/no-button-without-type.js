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
 * Scope: every native `<button>` tag, INCLUDING `<button pButton>`. The
 * PrimeNG `ButtonDirective` only adds classes to its host — it has NO host
 * binding for `type` (verified against primeng 21 `ButtonDirective` ɵdir
 * metadata), so a `<button pButton>` inside a form still defaults to
 * `type="submit"`. Only the `<p-button>` COMPONENT emits `type="button"`
 * on its inner button (`[attr.type]="type || buttonProps?.type"`), and
 * `<p-button>` is not a native `<button>` so it never matches this rule.
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
