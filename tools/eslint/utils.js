// @ts-check
'use strict';

/**
 * @fileoverview Shared utilities for showcase ESLint rules.
 *
 * All custom template rules need to scan class strings from multiple sources:
 *   - `class="..."` — standard HTML attribute
 *   - `styleClass="..."` — PrimeNG component styling
 *   - `paginatorStyleClass="..."` — PrimeNG paginator styling
 *   - `valueStyleClass="..."` — PrimeNG progress bar fill styling
 *   - `panelStyleClass="..."` — PrimeNG panel styling
 *
 * This utility provides a single visitor creator that handles all of them,
 * so individual rules only define the check callback.
 */

// All static attributes that may contain Tailwind class strings.
// PrimeNG uses various *StyleClass attributes that accept the same syntax as `class`.
const CLASS_ATTRIBUTE_NAMES = new Set([
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
]);

/**
 * Creates a template visitor that calls `checkFn` for every static class-like attribute.
 *
 * @param {object} context — ESLint rule context
 * @param {(value: string, loc: object) => void} checkFn — receives the attribute value and loc
 * @returns {object} — ESLint visitor object
 */
function createClassAttrVisitor(context, checkFn) {
  const parserServices = context.sourceCode.parserServices;

  return {
    TextAttribute(node) {
      if (!CLASS_ATTRIBUTE_NAMES.has(node.name)) return;
      if (!node.value) return;

      const loc = parserServices.convertNodeSourceSpanToLoc(node.sourceSpan);
      checkFn(node.value, loc);
    },
  };
}

module.exports = { createClassAttrVisitor, CLASS_ATTRIBUTE_NAMES };
