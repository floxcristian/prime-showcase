// @ts-check
'use strict';

const { collectElementClassStrings } = require('../utils');

/**
 * @fileoverview Enforces weight on <label> by role.
 *
 * CLAUDE.md design rule: el peso del label depende de donde vive el label
 * relativo al control:
 *
 *   - Label de INPUT (encima del control, como "Correo electronico" arriba
 *     de un <input>, <p-select>, <p-password>, <p-textarea>): `font-semibold`.
 *     Anuncia un campo y necesita jerarquia visual sobre placeholder/valor.
 *     Patron Stripe / Linear / Shopify Polaris — el label es UN step por
 *     encima del body (`font-semibold` vs `font-medium`).
 *
 *   - Label de CHECKBOX / RADIO (al lado del control, como "Mantener sesion"
 *     junto a un <p-checkbox>, o "Terms" junto a un <p-radiobutton>):
 *     `font-normal`. Vive inline como body text que describe la accion del
 *     control, no como titulo de campo. Patron GitHub "Keep me signed in",
 *     Stripe "Remember this device", Linear "Stay signed in", Google "Stay
 *     signed in" — todos regular weight, nunca semibold. Si le pones el
 *     mismo peso que a los inputs labels, compite visualmente con los
 *     titulares verdaderos del formulario.
 *
 * Deteccion del rol checkbox/radio (dos patrones posibles):
 *
 *   A. Label WRAPPING — el <label> contiene el control como descendiente:
 *      <label><input type="radio" />Texto</label>
 *      <label><p-checkbox />Texto</label>
 *
 *   B. Label SIBLING — el <label> y el control son hermanos en el mismo
 *      contenedor:
 *      <div>
 *        <p-checkbox inputId="x" />
 *        <label for="x">Texto</label>
 *      </div>
 *
 * Ambos patrones son legitimos; el rol se detecta por presencia del control
 * entre children (propios o del padre inmediato). Controles reconocidos:
 * <p-checkbox>, <p-radiobutton>, <input type="checkbox|radio">.
 *
 * Valid:
 *   <label for="email" class="text-color font-semibold leading-6">Email</label>
 *   <label for="x" class="font-normal"><p-checkbox />Remember</label>
 *   <div><p-radiobutton /><label for="x" class="font-normal">Yes</label></div>
 *
 * Invalid:
 *   <label for="email" class="font-medium">Email</label>
 *   <label for="x" class="font-semibold"><p-checkbox />Remember</label>
 *   <div><p-radiobutton /><label for="x" class="font-semibold">Yes</label></div>
 */

const FONT_SEMIBOLD_RE = /\bfont-semibold\b/;
const FONT_NORMAL_RE = /\bfont-normal\b/;

const CHECKBOX_RADIO_NAMES = new Set(['p-checkbox', 'p-radiobutton']);

function isCheckboxOrRadioElement(node) {
  if (!node || !node.name) return false;
  if (CHECKBOX_RADIO_NAMES.has(node.name)) return true;
  if (node.name === 'input') {
    for (const attr of node.attributes || []) {
      if (attr.name === 'type' && (attr.value === 'checkbox' || attr.value === 'radio')) {
        return true;
      }
    }
  }
  return false;
}

function anyDescendantIsCheckboxOrRadio(node) {
  if (!node || !node.children) return false;
  for (const child of node.children) {
    if (isCheckboxOrRadioElement(child)) return true;
    if (anyDescendantIsCheckboxOrRadio(child)) return true;
  }
  return false;
}

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        '<label> weight depends on role: font-semibold for input labels (above the control), font-normal for checkbox/radio labels (beside the control).',
      url: '../../docs/rules/label-requires-semibold.md',
    },
    schema: [],
    messages: {
      missingSemibold:
        '<label> must include font-semibold. Input labels (above the control) use semibold weight (Stripe/Linear/Polaris pattern) — add font-semibold to class / [ngClass] / [class].',
      missingNormal:
        '<label> for a checkbox/radio must include font-normal. Labels beside the control read as body text, not field titles (GitHub/Stripe/Google pattern) — add font-normal and remove font-semibold/medium/bold.',
    },
  },
  create(context) {
    const parserServices = context.sourceCode.parserServices;

    /**
     * Source-offset set of <label> nodes that sit next to a checkbox/radio
     * as a sibling (Case B). Populated when we visit the PARENT element,
     * read back when we visit the label itself.
     */
    const checkboxRadioSiblingLabels = new Set();

    return {
      Element(node) {
        // Scan this element's direct children for the sibling pattern
        // (Case B): <parent><p-checkbox /><label /></parent>. When we find
        // it, we mark the label's source offset so the later visit of the
        // label element routes to the checkbox/radio branch.
        if (node.children && node.children.length > 0) {
          const hasControl = node.children.some(isCheckboxOrRadioElement);
          if (hasControl) {
            for (const child of node.children) {
              if (child && child.name === 'label' && child.sourceSpan) {
                checkboxRadioSiblingLabels.add(child.sourceSpan.start.offset);
              }
            }
          }
        }

        if (node.name !== 'label') return;

        // Case A: the label itself wraps the control
        const wrapsControl = anyDescendantIsCheckboxOrRadio(node);
        const offset = node.sourceSpan && node.sourceSpan.start.offset;
        const isSibling = typeof offset === 'number' && checkboxRadioSiblingLabels.has(offset);
        const isCheckboxRadioLabel = wrapsControl || isSibling;

        const classStrings = collectElementClassStrings(node);
        const combined = classStrings.join(' ');

        if (isCheckboxRadioLabel) {
          // Two failure modes: missing font-normal, OR a heavier weight present.
          // Either one results in the label reading too heavy — report in both cases.
          if (!FONT_NORMAL_RE.test(combined) || FONT_SEMIBOLD_RE.test(combined)) {
            context.report({
              loc: parserServices.convertNodeSourceSpanToLoc(node.sourceSpan),
              messageId: 'missingNormal',
            });
          }
          return;
        }

        if (!FONT_SEMIBOLD_RE.test(combined)) {
          context.report({
            loc: parserServices.convertNodeSourceSpanToLoc(node.sourceSpan),
            messageId: 'missingSemibold',
          });
        }
      },
    };
  },
};
