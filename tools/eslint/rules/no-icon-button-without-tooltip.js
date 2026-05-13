// @ts-check
'use strict';

/**
 * @fileoverview Requires icon-only p-button elements to have a pTooltip — either
 * directly on the <p-button> OR on a wrapping ancestor (Material UI / Mantine /
 * Radix canonical pattern).
 *
 * Icon-only buttons (those without a `label`) are visually ambiguous. A tooltip
 * ensures the user understands the button's purpose on hover, matching the
 * standard set by GitHub, Linear, Figma, and other big-tech UIs.
 *
 * **Why accept the wrapper pattern**: when a <p-button> has `[loading]="true"`,
 * PrimeNG sets the `disabled` attribute on the inner button → the browser
 * applies `pointer-events: none` → the TooltipDirective listener registered on
 * the button host doesn't fire mouseenter/leave during loading. Wrapping the
 * button in `<span pTooltip>` makes the wrapper the listener target — the
 * wrapper isn't disabled and keeps capturing events. This is the canonical
 * Material UI / Mantine / Radix pattern for icon buttons that may enter
 * loading/disabled states.
 *
 * The rule reports a `<p-button>` only when:
 *   - it lacks `label` (icon-only)
 *   - AND it lacks `pTooltip` on itself
 *   - AND no ancestor element has `pTooltip`
 */

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Icon-only <p-button> must have pTooltip — on itself or a wrapping ancestor.',
      url: '../../docs/rules/no-icon-button-without-tooltip.md',
    },
    schema: [],
    messages: {
      missingTooltip:
        'Icon-only <p-button> is missing pTooltip. Add pTooltip="..." to the button or wrap it in a `<span pTooltip="...">`.',
    },
  },
  create(context) {
    const parserServices = context.sourceCode.parserServices;

    /**
     * Stack de ancestros en orden de profundidad. Se pushea en `Element` y
     * pop en `Element:exit` — así cuando visitamos un descendiente, la pila
     * contiene exactamente sus ancestors (no incluye al nodo actual hasta
     * después del push).
     */
    const ancestorStack = [];

    /** @param {object} el */
    function elementHasTooltip(el) {
      const allAttrs = [...(el.attributes || []), ...(el.inputs || [])];
      return allAttrs.some((a) => a.name === 'pTooltip');
    }

    return {
      Element(node) {
        // Push ANTES del check para que ancestors[]: si el nodo actual es el
        // wrapper con pTooltip Y un descendiente lo necesita, la pila debe
        // contener al wrapper cuando el descendiente sea visitado.
        const ancestorsAtVisit = [...ancestorStack];
        ancestorStack.push(node);

        if (node.name !== 'p-button') return;

        const allAttrs = [...(node.attributes || []), ...(node.inputs || [])];
        const hasLabel = allAttrs.some((a) => a.name === 'label');
        if (hasLabel) return;

        const hasOwnTooltip = allAttrs.some((a) => a.name === 'pTooltip');
        if (hasOwnTooltip) return;

        const hasAncestorTooltip = ancestorsAtVisit.some((anc) => elementHasTooltip(anc));
        if (hasAncestorTooltip) return;

        context.report({
          loc: parserServices.convertNodeSourceSpanToLoc(node.sourceSpan),
          messageId: 'missingTooltip',
        });
      },
      'Element:exit'() {
        ancestorStack.pop();
      },
    };
  },
};
