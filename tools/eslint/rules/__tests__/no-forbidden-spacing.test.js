// @ts-check
'use strict';

/**
 * RuleTester suite for showcase/no-forbidden-spacing (ALLOW-LIST version).
 *
 * Covers:
 *   - Valid: each prefix family at allowed values (incl. fractionals 0.5,
 *     1.5, 3.5); documented full-class exceptions (gap-7, px-7, py-8,
 *     px-12, p-[1px], mt-3, mt-5, mb-5, mt-10); negative and important
 *     variants of allowed values.
 *   - Invalid: values OUTSIDE the allow-list — both the old deny-list
 *     entries (gap-9, p-8, mt-7) and values the deny-list used to let
 *     through (gap-13, p-32, m-40, pt-96); exceptions do NOT bleed to
 *     other prefixes (py-12, pb-8, mb-10); arbitrary spacing.
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
      // Allowed gap values (DESIGN.md scale + reset + fractionals)
      { code: '<div class="gap-0 gap-1 gap-2 gap-3 gap-4 gap-5 gap-6 gap-8"></div>' },
      { code: '<div class="gap-0.5 gap-1.5 gap-x-4 gap-y-2"></div>' },
      // Allowed padding values
      { code: '<div class="p-0 p-1 p-2 p-3 p-4 p-5 p-6"></div>' },
      { code: '<div class="px-4 py-1 py-5 px-1.5 py-3.5 pb-0.5"></div>' },
      // Allowed margin values
      { code: '<div class="mt-1 mb-2 mx-4 my-6 mb-0 mt-0.5"></div>' },
      // Negative / important variants of allowed values
      { code: '<div class="-mx-2 -my-2 !p-0 [&>*]:-mr-2"></div>' },
      // Documented full-class exceptions
      { code: '<div class="gap-7 py-8"></div>' },        // chat EX-005
      { code: '<div class="py-5 px-7"></div>' },          // cabecera expandida
      { code: '<div class="mt-3 mt-5 mb-5"></div>' },     // pre-existing
      { code: '<div class="mt-10"></div>' },              // side-menu separators
      { code: '<div class="px-12"></div>' },              // login marketing panel
      { code: '<div class="p-[1px]"></div>' },            // badge alignment
      // Responsive/dark variants of allowed values and exceptions
      { code: '<div class="p-4 lg:py-5 lg:px-7"></div>' },
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
      // Values the old deny-list silently let through — allow-list catches them
      {
        code: '<div class="gap-13"></div>',
        errors: [{ messageId: 'forbiddenSpacing', data: { className: 'gap-13' } }],
      },
      {
        code: '<div class="p-32"></div>',
        errors: [{ messageId: 'forbiddenSpacing', data: { className: 'p-32' } }],
      },
      {
        code: '<div class="m-40"></div>',
        errors: [{ messageId: 'forbiddenSpacing', data: { className: 'm-40' } }],
      },
      {
        code: '<div class="pt-96"></div>',
        errors: [{ messageId: 'forbiddenSpacing', data: { className: 'pt-96' } }],
      },
      // Off-scale fractional
      {
        code: '<div class="gap-2.5"></div>',
        errors: [{ messageId: 'forbiddenSpacing', data: { className: 'gap-2.5' } }],
      },
      // p-8 / p-9
      {
        code: '<div class="p-8"></div>',
        errors: [{ messageId: 'forbiddenSpacing', data: { className: 'p-8' } }],
      },
      {
        code: '<div class="p-9"></div>',
        errors: [{ messageId: 'forbiddenSpacing', data: { className: 'p-9' } }],
      },
      // m-3 / mt-7 (no documented exception)
      {
        code: '<div class="m-3"></div>',
        errors: [{ messageId: 'forbiddenSpacing', data: { className: 'm-3' } }],
      },
      {
        code: '<div class="mt-7"></div>',
        errors: [{ messageId: 'forbiddenSpacing', data: { className: 'mt-7' } }],
      },
      // Exceptions do NOT bleed to sibling prefixes
      {
        code: '<div class="py-12"></div>', // only px-12 is excepted
        errors: [{ messageId: 'forbiddenSpacing', data: { className: 'py-12' } }],
      },
      {
        code: '<div class="pb-8"></div>', // only py-8 is excepted
        errors: [{ messageId: 'forbiddenSpacing', data: { className: 'pb-8' } }],
      },
      {
        code: '<div class="mb-10"></div>', // only mt-10 is excepted
        errors: [{ messageId: 'forbiddenSpacing', data: { className: 'mb-10' } }],
      },
      {
        code: '<div class="pt-7"></div>', // only px-7 is excepted
        errors: [{ messageId: 'forbiddenSpacing', data: { className: 'pt-7' } }],
      },
      // Arbitrary spacing
      {
        code: '<div class="gap-[13px]"></div>',
        errors: [{ messageId: 'arbitrarySpacing', data: { className: 'gap-[13px]' } }],
      },
      {
        code: '<div class="p-[2rem]"></div>',
        errors: [{ messageId: 'arbitrarySpacing', data: { className: 'p-[2rem]' } }],
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
