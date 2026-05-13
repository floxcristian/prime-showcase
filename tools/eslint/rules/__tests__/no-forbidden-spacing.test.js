// @ts-check
'use strict';

/**
 * RuleTester suite for showcase/no-forbidden-spacing.
 *
 * Covers:
 *   - Valid: each prefix family at allowed shades; documented exceptions
 *     (p-5, gap-7, gap-8, py-8, mt-3, mt-5, mt-10, p-[1px], px-12).
 *   - Invalid: forbidden values per family (gap-9, p-8, m-3), arbitrary
 *     spacing.
 *   - Bound attributes scan.
 */

const test = require('node:test');
const { RuleTester } = require('eslint');
const templateParser = require('@angular-eslint/template-parser');
const rule = require('../no-forbidden-spacing');

const ruleTester = new RuleTester({
  languageOptions: { parser: templateParser },
});

test('no-forbidden-spacing', () => {
  ruleTester.run('no-forbidden-spacing', rule, {
    valid: [
      // Allowed gap values
      { code: '<div class="gap-1 gap-2 gap-3 gap-4 gap-6"></div>' },
      // Allowed padding values
      { code: '<div class="p-1 p-2 p-3 p-4 p-6"></div>' },
      { code: '<div class="px-4 py-1"></div>' },
      // Allowed margin values
      { code: '<div class="mt-1 mb-2 mx-4 my-6 mb-0"></div>' },
      // Documented exceptions
      { code: '<div class="p-5"></div>' }, // side-menu EX-005
      { code: '<div class="gap-7 gap-8 py-8"></div>' }, // chat EX-005
      { code: '<div class="mt-3 mt-5 mb-5"></div>' }, // pre-existing
      { code: '<div class="mt-10"></div>' }, // side-menu separators
      { code: '<div class="px-12"></div>' }, // login marketing panel
      { code: '<div class="p-[1px]"></div>' }, // badge alignment
      // No spacing utility at all
      { code: '<div class="text-color"></div>' },
      // Bound attribute with valid spacing
      { code: `<div [ngClass]="{ 'gap-2': isCompact }"></div>` },
    ],

    invalid: [
      // gap-9 (just above the scale)
      {
        code: '<div class="gap-9"></div>',
        errors: [{ messageId: 'forbiddenSpacing', data: { className: 'gap-9' } }],
      },
      // gap-10
      {
        code: '<div class="gap-10"></div>',
        errors: [{ messageId: 'forbiddenSpacing', data: { className: 'gap-10' } }],
      },
      // p-9 / p-10
      {
        code: '<div class="p-9"></div>',
        errors: [{ messageId: 'forbiddenSpacing', data: { className: 'p-9' } }],
      },
      // m-7 (no documented exception)
      {
        code: '<div class="mt-7"></div>',
        errors: [{ messageId: 'forbiddenSpacing', data: { className: 'mt-7' } }],
      },
      // Arbitrary spacing
      {
        code: '<div class="gap-[13px]"></div>',
        errors: [{ messageId: 'arbitrarySpacing', data: { className: 'gap-[13px]' } }],
      },
      // Multiple violations
      {
        code: '<div class="gap-10 p-12 mt-9"></div>',
        errors: [
          { messageId: 'forbiddenSpacing', data: { className: 'gap-10' } },
          { messageId: 'forbiddenSpacing', data: { className: 'p-12' } },
          { messageId: 'forbiddenSpacing', data: { className: 'mt-9' } },
        ],
      },
      // Bound ternary — one bad branch
      {
        code: `<div [ngClass]="cond ? 'gap-9' : 'gap-2'"></div>`,
        errors: [{ messageId: 'forbiddenSpacing', data: { className: 'gap-9' } }],
      },
    ],
  });
});
