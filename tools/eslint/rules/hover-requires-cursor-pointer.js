// @ts-check
'use strict';

/**
 * @fileoverview Enforces that `hover:*` classes and `cursor-pointer` appear together.
 *
 * Policy: CLAUDE.md §"Estados interactivos" — every cursor-pointer must have a hover:*,
 * and every hover:* feedback implies interactivity (cursor-pointer).
 *
 * Design decision — **BIDIRECTIONAL** enforcement:
 *   - `cursor-pointer` without any `hover:*`  → missing feedback (users don't see interactivity)
 *   - `hover:*` without `cursor-pointer`       → missing affordance (cursor doesn't signal clickability)
 *
 * Scope — only plain HTML elements. PrimeNG components (`p-button`, `p-*`) and any element
 * with the `pButton` directive already receive hover styles from PrimeNG, so they're
 * exempt. This rule runs on `<div>`, `<button>` (without pButton), `<span>`, `<a>`, etc.
 *
 * Scans all class-bearing attributes on the element: class, styleClass, [ngClass], [class],
 * [styleClass], routerLinkActive, and all *StyleClass variants (static + bound).
 *
 * ## `group-hover:` / `peer-hover:` are NOT flagged
 *
 * These are legitimate Tailwind patterns where the hover state is triggered on a PARENT
 * (`.group`) or SIBLING (`.peer`) element. The cursor-pointer lives on the parent, not
 * on the element being styled. We explicitly exclude them from the `hover:*` detection
 * via a negative lookbehind.
 *
 * ## Suggestions
 *
 * When `cursor-pointer` is present without `hover:*`, we suggest 3 hover utilities.
 * When `hover:*` is present without `cursor-pointer`, we suggest adding `cursor-pointer`.
 * Fixers append the suggestion to the element's `class` attribute if present (static only).
 */

const { extractClassStrings } = require('../utils');

// Match `hover:` only when NOT preceded by a word char or dash.
// This excludes `group-hover:`, `peer-hover:`, and any `X-hover:` variant — those are
// parent/sibling state triggers, not element-level hover, and don't imply cursor-pointer
// on the element itself.
//
// Token chars after `hover:` include: alnum, `_`, `-`, `/`, `[`, `]`, `.`, `:` (for
// chained variants like `hover:dark:*` or `hover:[&>*]:bg-x`).
const HOVER_REGEX = /(?<![\w-])hover:[\w:/\[\].\-]+/;
const CURSOR_POINTER_REGEX = /\bcursor-pointer\b/;

const CLASS_ATTRS = new Set([
  'class',
  'styleClass',
  'paginatorStyleClass',
  'valueStyleClass',
  'panelStyleClass',
  'contentStyleClass',
  'headerStyleClass',
  'footerStyleClass',
  'inputStyleClass',
  'labelStyleClass',
  'ngClass',
  'routerLinkActive',
]);

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require `cursor-pointer` and `hover:*` to appear together on plain HTML elements. PrimeNG components are exempt.',
      url: '../../docs/rules/hover-requires-cursor-pointer.md',
    },
    hasSuggestions: true,
    schema: [],
    messages: {
      cursorWithoutHover:
        '`cursor-pointer` indicates interactivity but no `hover:*` state is defined. Users need visual feedback. Add hover:bg-emphasis, hover:opacity-70, or hover:text-muted-color-emphasis.',
      hoverWithoutCursor:
        '`hover:*` is defined but `cursor-pointer` is missing. Add cursor-pointer so the cursor signals the element is clickable.',
      suggestHoverBgEmphasis: 'Add hover:bg-emphasis (for containers, cards, rows)',
      suggestHoverOpacity: 'Add hover:opacity-70 (for images, avatars)',
      suggestHoverText: 'Add hover:text-muted-color-emphasis (for text, links)',
      suggestAddCursorPointer: 'Add cursor-pointer',
    },
  },
  create(context) {
    const parserServices = context.sourceCode.parserServices;
    const sourceCode = context.sourceCode;

    return {
      Element(node) {
        if (typeof node.name === 'string' && node.name.startsWith('p-')) return;

        const staticAttrs = node.attributes || [];
        const boundAttrs = node.inputs || [];

        const hasPButton = [...staticAttrs, ...boundAttrs].some((a) => a.name === 'pButton');
        if (hasPButton) return;

        const classStrings = [];
        for (const attr of staticAttrs) {
          if (CLASS_ATTRS.has(attr.name) && typeof attr.value === 'string') {
            classStrings.push(attr.value);
          }
        }
        for (const attr of boundAttrs) {
          if (CLASS_ATTRS.has(attr.name) && attr.value) {
            classStrings.push(...extractClassStrings(attr.value));
          }
        }
        if (classStrings.length === 0) return;

        const combined = classStrings.join(' ');
        const hasHover = HOVER_REGEX.test(combined);
        const hasCursor = CURSOR_POINTER_REGEX.test(combined);

        if (hasCursor === hasHover) return;

        const loc = parserServices.convertNodeSourceSpanToLoc(node.sourceSpan);

        // Find a static `class` attribute on this element to target for suggestions.
        const staticClassAttr = staticAttrs.find(
          (a) => a.name === 'class' && typeof a.value === 'string',
        );

        if (hasCursor) {
          context.report({
            loc,
            messageId: 'cursorWithoutHover',
            suggest: buildHoverSuggestions(sourceCode, staticClassAttr, node),
          });
        } else {
          context.report({
            loc,
            messageId: 'hoverWithoutCursor',
            suggest: buildCursorSuggestions(sourceCode, staticClassAttr, node),
          });
        }
      },
    };
  },
};

/**
 * Builds suggestions that append a hover:* class to the element's static `class` attr.
 * If no static class attribute exists, returns suggestions without fixers.
 */
function buildHoverSuggestions(sourceCode, classAttr, element) {
  const suggestions = [
    { messageId: 'suggestHoverBgEmphasis', token: 'hover:bg-emphasis' },
    { messageId: 'suggestHoverOpacity', token: 'hover:opacity-70' },
    { messageId: 'suggestHoverText', token: 'hover:text-muted-color-emphasis' },
  ];
  return suggestions.map((s) => ({
    messageId: s.messageId,
    fix: buildClassAppender(sourceCode, classAttr, element, s.token),
  }));
}

function buildCursorSuggestions(sourceCode, classAttr, element) {
  return [
    {
      messageId: 'suggestAddCursorPointer',
      fix: buildClassAppender(sourceCode, classAttr, element, 'cursor-pointer'),
    },
  ];
}

/**
 * Returns a fixer function that appends `token` to the element's static `class="..."`
 * attribute value, or adds a new `class="token"` attribute if none exists.
 */
function buildClassAppender(sourceCode, classAttr, element, token) {
  return (fixer) => {
    if (classAttr && classAttr.valueSpan) {
      // Insert token at the end of the attribute value (before closing quote).
      const endOffset = classAttr.valueSpan.end.offset;
      return fixer.insertTextBeforeRange([endOffset, endOffset], ` ${token}`);
    }
    // No static class attr — add one right after the tag name.
    // element.startSourceSpan points at `<tagName`, so insert after the tag name.
    if (element.startSourceSpan) {
      const tagOpenEnd =
        element.startSourceSpan.start.offset + element.name.length + 1; /* `<` + name */
      return fixer.insertTextBeforeRange([tagOpenEnd, tagOpenEnd], ` class="${token}"`);
    }
    return null;
  };
}
