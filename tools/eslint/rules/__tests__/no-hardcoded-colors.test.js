// @ts-check
'use strict';

/**
 * RuleTester suite for showcase/no-hardcoded-colors.
 *
 * Covers:
 *   - Valid: design tokens (text-color, bg-surface-*, bg-primary), allowed
 *     semantic exceptions (bg-violet-100, text-green-500, etc.), allowed
 *     border-black/10 + border-white/20 for main layout.
 *   - Invalid: generic Tailwind colors (text-gray-*, bg-blue-*), text-white
 *     / text-black outside the allowlist, arbitrary hex (bg-[#fff]),
 *     arbitrary CSS color functions (bg-[rgb(...)]).
 *   - Bound attributes: [ngClass], [class], routerLinkActive scan.
 *   - Multiple violations in one string surface separately.
 */

const test = require('node:test');
const { RuleTester } = require('eslint');
const templateParser = require('@angular-eslint/template-parser');
const rule = require('../no-hardcoded-colors');

const ruleTester = new RuleTester({
  languageOptions: { parser: templateParser },
});

test('no-hardcoded-colors', () => {
  ruleTester.run('no-hardcoded-colors', rule, {
    valid: [
      // Design tokens are always allowed
      { code: '<div class="text-color bg-surface-0"></div>' },
      { code: '<div class="bg-primary text-primary-contrast"></div>' },
      { code: '<div class="bg-emphasis text-muted-color"></div>' },
      { code: '<div class="border-surface"></div>' },
      // Allowed semantic exceptions
      { code: '<span class="bg-violet-100 text-violet-950"></span>' },
      { code: '<span class="bg-orange-100 text-orange-950"></span>' },
      { code: '<i class="fa-sharp fa-solid fa-circle text-yellow-500"></i>' },
      { code: '<i class="fa-sharp fa-solid fa-circle text-green-500"></i>' },
      // Allowed black/white opacity for main layout
      { code: '<div class="border-black/10 dark:border-white/20"></div>' },
      // Bound attribute with valid classes
      { code: `<div [ngClass]="{ 'bg-surface-0': isLight }"></div>` },
      // routerLinkActive with valid classes
      { code: '<a routerLinkActive="text-primary-contrast bg-primary"></a>' },
    ],

    invalid: [
      // Generic gray
      {
        code: '<div class="text-gray-500"></div>',
        errors: [{ messageId: 'noHardcodedColor', data: { className: 'text-gray-500' } }],
      },
      // Generic blue
      {
        code: '<div class="bg-blue-100"></div>',
        errors: [{ messageId: 'noHardcodedColor', data: { className: 'bg-blue-100' } }],
      },
      // Slate (one of the most-tempting generic colors)
      {
        code: '<p class="text-slate-700"></p>',
        errors: [{ messageId: 'noHardcodedColor', data: { className: 'text-slate-700' } }],
      },
      // text-white outside the layout allowlist
      {
        code: '<div class="text-white"></div>',
        errors: [{ messageId: 'noHardcodedColor', data: { className: 'text-white' } }],
      },
      // Arbitrary hex
      {
        code: '<div class="bg-[#fff]"></div>',
        errors: [{ messageId: 'noHexColor', data: { className: 'bg-[#fff]' } }],
      },
      // Arbitrary rgb()
      {
        code: '<div class="text-[rgb(255,0,0)]"></div>',
        errors: [{ messageId: 'noArbitraryColor', data: { className: 'text-[rgb(255,0,0)]' } }],
      },
      // Multiple violations in one class — each is a separate error
      {
        code: '<div class="text-gray-500 bg-blue-100"></div>',
        errors: [
          { messageId: 'noHardcodedColor', data: { className: 'text-gray-500' } },
          { messageId: 'noHardcodedColor', data: { className: 'bg-blue-100' } },
        ],
      },
      // Bound attribute (object key)
      {
        code: `<div [ngClass]="{ 'text-red-500': hasError }"></div>`,
        errors: [{ messageId: 'noHardcodedColor', data: { className: 'text-red-500' } }],
      },
      // Bound ternary — one bad branch
      {
        code: `<div [ngClass]="cond ? 'text-green-500 bg-emerald-50' : 'text-color'"></div>`,
        errors: [{ messageId: 'noHardcodedColor', data: { className: 'bg-emerald-50' } }],
      },
      // routerLinkActive with bad color
      {
        code: '<a routerLinkActive="text-purple-500"></a>',
        errors: [{ messageId: 'noHardcodedColor', data: { className: 'text-purple-500' } }],
      },
    ],
  });
});
