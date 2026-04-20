// @ts-check
'use strict';

const { collectElementClassStrings } = require('../utils');

/**
 * @fileoverview Restricts `fa-sharp-duotone` to icons ≥24px (text-2xl+).
 *
 * CLAUDE.md design rule: Sharp Duotone is decorative. A los dos tonos les hace
 * falta suficiente área para distinguirse — inline a text-sm/base/lg/xl (16-20px)
 * se embarran y se lee como "icono sucio", rompiendo el ritmo visual de Sharp
 * Regular UI. A partir de text-2xl (24px) los dos tonos se separan lo suficiente
 * como para leer "profundidad" en standalone icons (feature cards, hero tiles).
 *
 * El umbral era text-4xl (48px) hasta 2026-04; se bajó a text-2xl después de
 * validar que los feature icons del panel marketing del login (24px dentro de
 * un box 48px) se leen bien sin embarrarse. text-xl (20px) sigue bloqueado.
 *
 * Valid uses:
 *   fa-sharp-duotone fa-regular fa-file-invoice text-2xl   (feature card icons)
 *   fa-sharp-duotone fa-regular fa-cloud-arrow-up text-4xl (empty states)
 *   fa-sharp-duotone fa-regular fa-shield text-5xl         (hero feature card)
 *
 * Invalid (flag):
 *   fa-sharp-duotone fa-regular fa-bell                    (inline, no size)
 *   fa-sharp-duotone fa-regular fa-bell text-sm            (inline, muddy)
 *   fa-sharp-duotone fa-regular fa-bell text-xl            (20px, still muddy)
 *
 * The rule aggregates ALL class strings on the element (static + bound,
 * across `class`, `[ngClass]`, `[class]`, and every `*StyleClass` variant).
 * Duotone is valid iff a duotone-safe size (`text-2xl`+) appears anywhere on
 * the same element — even if the duotone class and the size are split across
 * separate attributes (e.g. `class="fa-sharp-duotone fa-x" [class]="'text-2xl'"`).
 */

const DUOTONE_RE = /\bfa-sharp-duotone\b/;

// Tailwind size tokens considered "duotone-safe" (≥24px in default config).
const DUOTONE_SAFE_SIZE_RE = /\btext-(2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)\b/;

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'fa-sharp-duotone requires ≥text-2xl (24px) on the same element. Below that, the two tones blur and break the UI rhythm — use fa-sharp fa-regular instead.',
      url: '../../docs/rules/no-duotone-inline-icon.md',
    },
    schema: [],
    messages: {
      duotoneTooSmall:
        'fa-sharp-duotone requires text-2xl or larger on the same element. For icons below 24px use fa-sharp fa-regular.',
    },
  },
  create(context) {
    const parserServices = context.sourceCode.parserServices;

    return {
      Element(node) {
        const classStrings = collectElementClassStrings(node);
        if (classStrings.length === 0) return;

        const hasDuotone = classStrings.some((s) => DUOTONE_RE.test(s));
        if (!hasDuotone) return;

        const hasSafeSize = classStrings.some((s) => DUOTONE_SAFE_SIZE_RE.test(s));
        if (hasSafeSize) return;

        context.report({
          loc: parserServices.convertNodeSourceSpanToLoc(node.sourceSpan),
          messageId: 'duotoneTooSmall',
        });
      },
    };
  },
};
