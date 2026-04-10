// @ts-check
'use strict';

/**
 * @fileoverview Shared utilities for showcase ESLint rules.
 *
 * Scans class strings from multiple sources in Angular templates:
 *
 * Static attributes:
 *   - `class="..."` — standard HTML attribute
 *   - `styleClass="..."` — PrimeNG component styling
 *   - `paginatorStyleClass`, `valueStyleClass`, etc. — PrimeNG variants
 *
 * Bound attributes (Angular expressions):
 *   - `[ngClass]="{ 'class': cond }"` — object literal keys are class strings
 *   - `[ngClass]="cond ? 'class-a' : 'class-b'"` — ternary branches
 *   - `[class]="'class-a class-b'"` — string literals
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

// Bound attribute names that contain class expressions.
// Includes Angular's [ngClass]/[class] and all PrimeNG [*StyleClass] bindings.
const BOUND_CLASS_ATTR_NAMES = new Set([
  'ngClass',
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
 * Recursively walks an Angular expression AST and extracts all string literals
 * that could contain CSS class names.
 *
 * Handles:
 *   - LiteralPrimitive: `'text-color bg-emphasis'`
 *   - LiteralMap keys: `{ 'text-gray-500': condition }` — keys are class strings
 *   - LiteralArray: `['class-a', 'class-b']`
 *   - Conditional: `cond ? 'class-a' : 'class-b'` — both branches
 *   - Binary: `'class-a ' + 'class-b'` — both sides
 *
 * Gracefully ignores PropertyRead, MethodCall, and other dynamic expressions.
 *
 * @param {object} ast — Angular compiler expression AST node
 * @returns {string[]} — extracted class strings
 */
function extractClassStrings(ast) {
  /** @type {string[]} */
  const results = [];
  walk(ast);
  return results;

  /** @param {object} node */
  function walk(node) {
    if (!node || typeof node !== 'object') return;

    // LiteralMap: { 'class-a': cond, 'class-b': cond }
    // The KEYS are the class names — this is the most common [ngClass] pattern.
    // Check this FIRST because LiteralMap also has a `value` property (the source).
    if (Array.isArray(node.keys) && Array.isArray(node.values)) {
      for (const key of node.keys) {
        if (typeof key === 'string') {
          results.push(key);
        } else if (key && typeof key.key === 'string') {
          results.push(key.key);
        }
      }
      // Walk values for nested expressions (rare but possible)
      for (const v of node.values) walk(v);
      return;
    }

    // LiteralArray: ['class-a', 'class-b']
    if (Array.isArray(node.expressions)) {
      for (const expr of node.expressions) walk(expr);
      return;
    }

    // Conditional: cond ? 'class-a' : 'class-b'
    if ('condition' in node && 'trueExp' in node && 'falseExp' in node) {
      walk(node.trueExp);
      walk(node.falseExp);
      return;
    }

    // Binary: 'class-a ' + 'class-b'
    if ('left' in node && 'right' in node && 'operation' in node) {
      walk(node.left);
      walk(node.right);
      return;
    }

    // LiteralPrimitive: 'text-color bg-emphasis'
    // Check this LAST — many node types have a `value` property (e.g. ASTWithSource),
    // but only LiteralPrimitive has a plain string value without keys/expressions/etc.
    if (typeof node.value === 'string') {
      results.push(node.value);
      return;
    }

    // ASTWithSource wraps the actual expression in an `ast` property
    if (node.ast) {
      walk(node.ast);
      return;
    }

    // PropertyRead, MethodCall, Interpolation, etc. — cannot extract static strings.
    // Silently skip.
  }
}

/**
 * Creates a template visitor that calls `checkFn` for every class string found in:
 * - Static attributes: class="...", styleClass="...", *StyleClass="..."
 * - Bound attributes: [ngClass]="...", [class]="..."
 *
 * @param {object} context — ESLint rule context
 * @param {(value: string, loc: object) => void} checkFn — receives each class string and loc
 * @returns {object} — ESLint visitor object
 */
function createClassAttrVisitor(context, checkFn) {
  const parserServices = context.sourceCode.parserServices;

  return {
    // Static attributes: class="...", styleClass="..."
    TextAttribute(node) {
      if (!CLASS_ATTRIBUTE_NAMES.has(node.name)) return;
      if (!node.value) return;

      const loc = parserServices.convertNodeSourceSpanToLoc(node.sourceSpan);
      checkFn(node.value, loc);
    },

    // Bound attributes: [ngClass]="{ 'class': cond }", [class]="expr"
    BoundAttribute(node) {
      if (!BOUND_CLASS_ATTR_NAMES.has(node.name)) return;
      if (!node.value) return;

      const strings = extractClassStrings(node.value);
      if (strings.length === 0) return;

      const loc = parserServices.convertNodeSourceSpanToLoc(node.sourceSpan);
      for (const str of strings) {
        // Each string may contain multiple space-separated classes
        // e.g. 'text-gray-500 bg-blue-100' from a single object key
        checkFn(str, loc);
      }
    },
  };
}

module.exports = { createClassAttrVisitor, extractClassStrings, CLASS_ATTRIBUTE_NAMES };
