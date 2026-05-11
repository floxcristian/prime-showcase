// @ts-check
'use strict';

/**
 * RuleTester suite for showcase/no-inline-styles.
 *
 * Covers:
 *   - Valid: no style attribute; [style.*] binding (dynamic); [ngStyle]
 *     binding; class-only.
 *   - Invalid: static style="...".
 *
 * Bound attributes are intentionally OUT of scope — `[style.*]` and
 * `[ngStyle]` are for data-driven values like chart colors and remain
 * allowed.
 */

const test = require('node:test');
const { RuleTester } = require('eslint');
const templateParser = require('@angular-eslint/template-parser');
const rule = require('../no-inline-styles');

const ruleTester = new RuleTester({
  languageOptions: { parser: templateParser },
});

test('no-inline-styles', () => {
  ruleTester.run('no-inline-styles', rule, {
    valid: [
      // No style attribute at all
      { code: '<div class="bg-surface-0"></div>' },
      // Dynamic style binding for data-driven values
      { code: '<div [style.backgroundColor]="item.color"></div>' },
      // ngStyle dynamic binding
      { code: '<div [ngStyle]="{ backgroundColor: item.color }"></div>' },
      // Multi-property dynamic
      { code: '<div [style.width.px]="width" [style.height.px]="height"></div>' },
    ],

    invalid: [
      // Static color
      {
        code: '<div style="color: red"></div>',
        errors: [{ messageId: 'noInlineStyle' }],
      },
      // Static background
      {
        code: '<div style="background-color: #fff"></div>',
        errors: [{ messageId: 'noInlineStyle' }],
      },
      // Static layout
      {
        code: '<div style="display: flex; gap: 8px"></div>',
        errors: [{ messageId: 'noInlineStyle' }],
      },
      // Long value is truncated in the message — verify the rule reports
      {
        code:
          '<div style="display: flex; gap: 8px; padding: 12px; border-radius: 8px"></div>',
        errors: [{ messageId: 'noInlineStyle' }],
      },
      // Empty style attribute is still a violation if present with a value
      {
        code: '<div style="margin: 0"></div>',
        errors: [{ messageId: 'noInlineStyle' }],
      },
    ],
  });
});
