// @ts-check
'use strict';

const { extractClassStrings } = require('../utils');

/**
 * @fileoverview Forbids design-system color tokens and state variants inside
 * the `icon` string of a <p-button>.
 *
 * **Why this rule.** PrimeNG renders the icon by splatting `[icon]` onto an
 * internal `<i>`. Two distinct surfaces fight for that element's `color`:
 *
 *   1. The Aura preset's button-skin CSS (severity / state) wires
 *      `--p-button-text-*-color` via selectors like
 *      `.p-button-text > .p-icon`, with higher specificity than a
 *      single-class Tailwind utility.
 *   2. Tailwind utilities applied through `[icon]` land on the same `<i>`
 *      but lose to the PrimeNG selector unless escalated with `!important`.
 *
 * **Result.** A reviewer who sees
 * `icon="fa-sharp fa-regular fa-phone text-muted-color"` believes the muted
 * tone is load-bearing. It isn't — the button's `severity="secondary"`
 * already paints the icon muted; the class is dead code that misleads
 * future edits. Same story for `bg-*` (paints nothing in a default
 * `<i>` flow), and for `hover:*` / `dark:*` (the state variant belongs on
 * the button element, not on the leaf icon).
 *
 * **Scope.** This rule fires ONLY on tokens that we know don't work:
 *   - Design-system color tokens (`text-color`, `text-muted-color`,
 *     `text-primary*`, `text-surface-*`, `text-primary-contrast`,
 *     `text-color-emphasis`, `text-muted-color-emphasis`).
 *   - Backgrounds (`bg-*`) — never desired on a glyph icon.
 *   - State variants (`hover:*`, `dark:*`, `focus:*`, `active:*`) — wrong
 *     surface; belong on the <p-button> itself.
 *   - Important versions of the above (`!text-color`, `!bg-surface-100`).
 *
 * **NOT in scope** (allowed inside icon=):
 *   - `fa-*` tokens (family/style/name/modifier).
 *   - Size tokens (`text-xs|sm|base|lg|xl|2xl|3xl|4xl`) — load-bearing for
 *     icon size in <p-button text>.
 *   - Leading/weight (`leading-*`, `font-*`) — load-bearing for icon
 *     line-height when stacked.
 *   - Tailwind named-color tokens (`text-green-500`, `text-yellow-500`,
 *     etc.) — these CAN work because they map to a value that overrides
 *     the inherited button color via specificity in many cases, and they
 *     are explicit semantic exceptions in DESIGN.md (status indicators,
 *     BTC icon, online dot). If they don't render as expected the bug
 *     surface is the consumer, not this rule.
 *
 * Audit reference: chat module 2026-05-08 — five icon-only buttons with
 * dead `text-muted-color`; intent ("secondary action") was already encoded
 * by `severity="secondary"`.
 */

// Design-system color tokens that PrimeNG's button skin overrides.
const DS_COLOR_TOKENS = new Set([
  'text-color',
  'text-color-emphasis',
  'text-muted-color',
  'text-muted-color-emphasis',
  'text-primary',
  'text-primary-emphasis',
  'text-primary-contrast',
]);

const FORBIDDEN_PATTERNS = [
  // Design-system color tokens (exact match, with optional ! prefix)
  (t) => DS_COLOR_TOKENS.has(t) || (t.startsWith('!') && DS_COLOR_TOKENS.has(t.slice(1))),
  // Surface text tokens — text-surface-50, text-surface-950, !text-surface-100, etc.
  (t) => /^!?text-surface-\d+$/.test(t),
  // Any background on a glyph icon is wrong
  (t) => /^!?bg-/.test(t),
  // State variants — wrong surface
  (t) => /^(hover|focus|active|dark):/.test(t),
];

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Design-system color tokens and state variants inside `icon` on <p-button> are dead code — color is owned by severity/skin, state belongs on the button.',
      url: '../../docs/rules/no-color-on-pbutton-icon.md',
    },
    schema: [],
    messages: {
      foreignToken:
        '"{{ token }}" inside `icon` on <p-button> is dead code — icon color is owned by the button severity/skin, not by classes on the icon string. Drop it, or apply it via `styleClass` on the <p-button>.',
    },
  },
  create(context) {
    const parserServices = context.sourceCode.parserServices;

    /**
     * Reports any forbidden token in a class string.
     * @param {string} iconValue
     * @param {object} loc
     */
    function checkIconString(iconValue, loc) {
      if (!iconValue || typeof iconValue !== 'string') return;
      const tokens = iconValue.split(/\s+/).filter(Boolean);
      for (const token of tokens) {
        if (FORBIDDEN_PATTERNS.some((p) => p(token))) {
          context.report({ loc, messageId: 'foreignToken', data: { token } });
        }
      }
    }

    return {
      Element(node) {
        if (node.name !== 'p-button') return;

        // Static icon="..."
        for (const attr of node.attributes || []) {
          if (attr.name !== 'icon') continue;
          const loc = parserServices.convertNodeSourceSpanToLoc(node.sourceSpan);
          checkIconString(attr.value, loc);
        }

        // Bound [icon]="expr" — extract every string literal reachable from
        // the expression (LiteralPrimitive, ternary branches, binary +).
        for (const input of node.inputs || []) {
          if (input.name !== 'icon') continue;
          if (!input.value) continue;
          const strings = extractClassStrings(input.value);
          if (strings.length === 0) continue;
          const loc = parserServices.convertNodeSourceSpanToLoc(node.sourceSpan);
          for (const str of strings) checkIconString(str, loc);
        }
      },
    };
  },
};
