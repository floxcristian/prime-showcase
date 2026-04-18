// @ts-check
'use strict';

const { collectElementClassStrings } = require('../utils');

/**
 * @fileoverview Restricts `fa-sharp-duotone` to hero-icon size (text-4xl+).
 *
 * CLAUDE.md design rule: Sharp Duotone is decorative and only reads correctly
 * at ≥48px (text-4xl). Used inline at text-sm/text-base next to body copy it
 * creates visual noise that breaks the ritmo visual of Sharp Regular UI.
 *
 * Valid uses:
 *   fa-sharp-duotone fa-regular fa-cloud-arrow-up text-4xl   (empty states)
 *   fa-sharp-duotone fa-regular fa-shield text-5xl           (hero feature card)
 *
 * Invalid (flag):
 *   fa-sharp-duotone fa-regular fa-bell                      (inline, no size)
 *   fa-sharp-duotone fa-regular fa-bell text-sm              (inline, small)
 *
 * The rule aggregates ALL class strings on the element (static + bound,
 * across `class`, `[ngClass]`, `[class]`, and every `*StyleClass` variant).
 * Duotone is valid iff a hero-size token (`text-4xl`+) appears anywhere on
 * the same element — even if the duotone class and the size are split
 * across separate attributes (e.g. `class="fa-sharp-duotone fa-x"
 * [class]="'text-4xl'"`).
 */

const DUOTONE_RE = /\bfa-sharp-duotone\b/;

// Tailwind size tokens considered "hero-sized" (≥48px in default config).
const HERO_SIZE_RE = /\btext-(4xl|5xl|6xl|7xl|8xl|9xl)\b/;

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'fa-sharp-duotone is reserved for hero icons (text-4xl+). Inline usage at body sizes breaks the UI rhythm — use fa-sharp fa-regular instead.',
      url: '../../docs/rules/no-duotone-inline-icon.md',
    },
    schema: [],
    messages: {
      duotoneTooSmall:
        'fa-sharp-duotone requires a hero size (text-4xl or larger) on the same element. For inline icons use fa-sharp fa-regular.',
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

        const hasHeroSize = classStrings.some((s) => HERO_SIZE_RE.test(s));
        if (hasHeroSize) return;

        context.report({
          loc: parserServices.convertNodeSourceSpanToLoc(node.sourceSpan),
          messageId: 'duotoneTooSmall',
        });
      },
    };
  },
};
