// @ts-check
'use strict';

const { collectElementClassStrings } = require('../utils');

/**
 * @fileoverview Pairs `text-3xl` with `font-bold` on the same element.
 *
 * CLAUDE.md design rule: los titulos hero (text-3xl, principal) llevan peso
 * `font-bold`. El resto de la escala tipografica usa `font-medium` / `font-semibold`
 * — se reserva `font-bold` explicitamente para este size. La diferencia peso/size
 * da jerarquia visual inmediata: al escanear la pagina el ojo identifica el
 * titulo principal sin leer el tamano porque el weight ya lo dice.
 *
 * Patron: Linear, Vercel, Stripe, Figma — todos usan peso reforzado en el hero
 * H1 de cada vista. Mezclar `text-3xl font-semibold` con `text-3xl font-bold`
 * en distintas pantallas crea inconsistencia que ESLint no detecta si solo se
 * validan valores individuales (esa validacion vive en no-forbidden-typography).
 *
 * Valid:
 *   text-3xl font-bold leading-normal text-color
 *   class="text-color text-3xl font-bold"
 *   [ngClass]="{ 'text-3xl font-bold': cond }"
 *   class="text-3xl"          [ngClass]="{ 'font-bold': cond }"     (split across attrs)
 *
 * Invalid:
 *   text-3xl font-semibold
 *   text-3xl font-medium
 *   text-3xl                  (sin font-weight explicito — el default tipografico no es bold)
 *
 * El scan agrega TODAS las class strings del elemento (static + bound, a traves
 * de `class`, `[ngClass]`, `[class]` y `*StyleClass`). Se considera valido si
 * `font-bold` aparece en cualquiera de esas strings del mismo elemento.
 */

const TEXT_3XL_RE = /\btext-3xl\b/;
const FONT_BOLD_RE = /\bfont-bold\b/;

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'text-3xl must be paired with font-bold on the same element. Hero titles use bold weight for visual hierarchy.',
      url: '../../docs/rules/text-3xl-requires-bold.md',
    },
    schema: [],
    messages: {
      missingBold:
        'text-3xl must be paired with font-bold on the same element. Hero titles use bold weight — replace font-semibold/font-medium with font-bold, or add font-bold if missing.',
    },
  },
  create(context) {
    const parserServices = context.sourceCode.parserServices;

    return {
      Element(node) {
        const classStrings = collectElementClassStrings(node);
        if (classStrings.length === 0) return;

        const hasText3xl = classStrings.some((s) => TEXT_3XL_RE.test(s));
        if (!hasText3xl) return;

        const hasBold = classStrings.some((s) => FONT_BOLD_RE.test(s));
        if (hasBold) return;

        context.report({
          loc: parserServices.convertNodeSourceSpanToLoc(node.sourceSpan),
          messageId: 'missingBold',
        });
      },
    };
  },
};
