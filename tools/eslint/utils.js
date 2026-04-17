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
 *   - `routerLinkActive="..."` — Angular router active class list
 *
 * Bound attributes (Angular expressions):
 *   - `[ngClass]="{ 'class': cond }"` — object literal keys are class strings
 *   - `[ngClass]="cond ? 'class-a' : 'class-b'"` — ternary branches
 *   - `[class]="'class-a class-b'"` — string literals
 *
 * This utility provides a single visitor creator that handles all of them,
 * so individual rules only define the check callback.
 *
 * ## Per-match loc
 *
 * Rule callbacks receive a `ctx` object with:
 *   - `ctx.loc`           — attribute-level loc (backward-compat; always present)
 *   - `ctx.report(match, messageId, data, extras?)` — reports with precise per-match
 *                            loc when possible, else falls back to attribute-level loc.
 *   - `ctx.locForMatch(match)` — returns precise loc for a given regex match.
 *   - `ctx.isStatic`       — true for static attrs (class="..."), false for bound ([ngClass]).
 *   - `ctx.node`           — the parser attribute node.
 *
 * Precise per-match loc works for STATIC attributes (the regex match index maps
 * directly onto the attribute value source offset). For BOUND attributes, the
 * class strings come from AST literals inside expressions; mapping each match
 * back to source text is fragile, so we fall back to attribute-level loc.
 *
 * Big-tech plugins (typescript-eslint, eslint-plugin-react) all compute per-match
 * loc — it's table-stakes for editor squiggle precision.
 *
 * `extras` supports:
 *   - `suggest: Array<{ messageId, data?, fix }>` — ESLint suggestions
 *   - `fix: (fixer) => ...` — autofix (rarely applicable here)
 */

// All static attributes that may contain Tailwind class strings.
// PrimeNG uses various *StyleClass attributes that accept the same syntax as `class`.
// `routerLinkActive` is included because it accepts a space-separated class list
// applied when the link is active — same lint rules apply.
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
  'routerLinkActive',
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
  'routerLinkActive',
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

    if (Array.isArray(node.keys) && Array.isArray(node.values)) {
      for (const key of node.keys) {
        if (typeof key === 'string') {
          results.push(key);
        } else if (key && typeof key.key === 'string') {
          results.push(key.key);
        }
      }
      for (const v of node.values) walk(v);
      return;
    }

    if (Array.isArray(node.expressions)) {
      for (const expr of node.expressions) walk(expr);
      return;
    }

    if ('condition' in node && 'trueExp' in node && 'falseExp' in node) {
      walk(node.trueExp);
      walk(node.falseExp);
      return;
    }

    if ('left' in node && 'right' in node && 'operation' in node) {
      walk(node.left);
      walk(node.right);
      return;
    }

    if (typeof node.value === 'string') {
      results.push(node.value);
      return;
    }

    if (node.ast) {
      walk(node.ast);
      return;
    }
  }
}

/**
 * Converts a 0-based source offset into a {line, column} object.
 * Lines are 1-based, columns are 0-based (ESLint convention).
 *
 * @param {string} text — source text
 * @param {number} offset
 * @returns {{line: number, column: number} | null}
 */
function offsetToLoc(text, offset) {
  if (offset < 0 || offset > text.length) return null;
  let line = 1;
  let lineStart = 0;
  for (let i = 0; i < offset; i++) {
    if (text.charCodeAt(i) === 10 /* \n */) {
      line++;
      lineStart = i + 1;
    }
  }
  return { line, column: offset - lineStart };
}

/**
 * Computes a precise loc object for a regex match within a static attribute value.
 *
 * @param {object} context — ESLint rule context
 * @param {object} node — Angular template TextAttribute node
 * @param {RegExpMatchArray} match — regex match result (must have .index)
 * @returns {object|null} — { start, end } loc, or null if we can't compute it
 */
function computePreciseLocForStatic(context, node, match) {
  if (!node.valueSpan) return null;
  if (typeof match.index !== 'number') return null;

  const text = context.sourceCode.text;
  const valueStart = node.valueSpan.start.offset;
  const matchStart = valueStart + match.index;
  const matchEnd = matchStart + match[0].length;

  const startLoc = offsetToLoc(text, matchStart);
  const endLoc = offsetToLoc(text, matchEnd);
  if (!startLoc || !endLoc) return null;
  return { start: startLoc, end: endLoc };
}

/**
 * Creates a template visitor that calls `checkFn` for every class string found in:
 * - Static attributes: class="...", styleClass="...", *StyleClass="...", routerLinkActive="..."
 * - Bound attributes: [ngClass]="...", [class]="..."
 *
 * @param {object} context — ESLint rule context
 * @param {(value: string, ctx: any) => void} checkFn
 * @returns {object} — ESLint visitor object
 */
function createClassAttrVisitor(context, checkFn) {
  const parserServices = context.sourceCode.parserServices;

  function makeStaticCtx(node) {
    const fallbackLoc = parserServices.convertNodeSourceSpanToLoc(node.sourceSpan);
    return {
      // Backward-compat: legacy rules read `ctx.loc` and pass to context.report.
      loc: fallbackLoc,
      fallbackLoc,
      isStatic: true,
      node,
      locForMatch(match) {
        return computePreciseLocForStatic(context, node, match) || fallbackLoc;
      },
      report(match, messageId, data, extras) {
        const loc = computePreciseLocForStatic(context, node, match) || fallbackLoc;
        /** @type {any} */
        const reportObj = { loc, messageId, data: data || {} };
        if (extras && extras.suggest) reportObj.suggest = extras.suggest;
        if (extras && extras.fix) reportObj.fix = extras.fix;
        context.report(reportObj);
      },
    };
  }

  function makeBoundCtx(node) {
    const fallbackLoc = parserServices.convertNodeSourceSpanToLoc(node.sourceSpan);
    return {
      loc: fallbackLoc,
      fallbackLoc,
      isStatic: false,
      node,
      locForMatch() {
        return fallbackLoc;
      },
      report(_match, messageId, data, extras) {
        /** @type {any} */
        const reportObj = { loc: fallbackLoc, messageId, data: data || {} };
        if (extras && extras.suggest) reportObj.suggest = extras.suggest;
        if (extras && extras.fix) reportObj.fix = extras.fix;
        context.report(reportObj);
      },
    };
  }

  return {
    TextAttribute(node) {
      if (!CLASS_ATTRIBUTE_NAMES.has(node.name)) return;
      if (!node.value) return;
      checkFn(node.value, makeStaticCtx(node));
    },

    BoundAttribute(node) {
      if (!BOUND_CLASS_ATTR_NAMES.has(node.name)) return;
      if (!node.value) return;
      const strings = extractClassStrings(node.value);
      if (strings.length === 0) return;
      const ctx = makeBoundCtx(node);
      for (const str of strings) {
        checkFn(str, ctx);
      }
    },
  };
}

module.exports = {
  createClassAttrVisitor,
  extractClassStrings,
  computePreciseLocForStatic,
  offsetToLoc,
  CLASS_ATTRIBUTE_NAMES,
  BOUND_CLASS_ATTR_NAMES,
};
