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
 * The rule reports a `<p-button>` / `<button pButton>` only when:
 *   - it lacks `label` (icon-only)
 *   - AND it has no non-empty projected text content (a `<p-button>Texto</p-button>`
 *     or `<button pButton>Texto</button>` renders a visible text label —
 *     not icon-only, tooltip is redundant). Interpolated text ({{ expr }})
 *     counts as text content.
 *   - AND it lacks `pTooltip` on itself
 *   - AND no ancestor element has `pTooltip`
 */

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Icon-only <p-button> / <button pButton> must have pTooltip — on itself or a wrapping ancestor.',
      url: '../../docs/rules/no-icon-button-without-tooltip.md',
    },
    schema: [],
    messages: {
      missingTooltip:
        'Icon-only PrimeNG button is missing pTooltip. Add pTooltip="..." to the button or wrap it in a `<span pTooltip="...">`.',
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

    /**
     * True when the element projects visible text content: a non-whitespace
     * Text child, or a BoundText child (`{{ expr }}` — renders text at
     * runtime). A button with projected text is NOT icon-only, so the
     * tooltip requirement doesn't apply. Element children (e.g. a lone
     * `<i class="fa-...">`) do NOT count as text.
     *
     * @param {object} el
     */
    function hasProjectedText(el) {
      return (el.children || []).some(
        (child) =>
          // Text node with non-whitespace content
          (typeof child.value === 'string' && child.value.trim().length > 0) ||
          // BoundText — interpolation like {{ label() }}
          (child.value && typeof child.value === 'object' && 'ast' in child.value),
      );
    }

    return {
      Element(node) {
        // Push ANTES del check para que ancestors[]: si el nodo actual es el
        // wrapper con pTooltip Y un descendiente lo necesita, la pila debe
        // contener al wrapper cuando el descendiente sea visitado.
        const ancestorsAtVisit = [...ancestorStack];
        ancestorStack.push(node);

        const allAttrs = [...(node.attributes || []), ...(node.inputs || [])];

        // Scope: <p-button> component + native <button pButton> (the
        // directive form is just as icon-only-capable and just as opaque
        // without a tooltip).
        const isPButtonComponent = node.name === 'p-button';
        const isPButtonDirective =
          node.name === 'button' && allAttrs.some((a) => a.name === 'pButton');
        if (!isPButtonComponent && !isPButtonDirective) return;

        const hasLabel = allAttrs.some((a) => a.name === 'label');
        if (hasLabel) return;

        // Projected text content renders a visible label → not icon-only.
        if (hasProjectedText(node)) return;

        const hasOwnTooltip = allAttrs.some((a) => a.name === 'pTooltip');
        if (hasOwnTooltip) return;

        const hasAncestorTooltip = ancestorsAtVisit.some((anc) =>
          elementHasTooltip(anc),
        );
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
