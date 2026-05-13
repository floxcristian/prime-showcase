// @ts-check
'use strict';

/**
 * RuleTester suite for showcase/no-forbidden-typography.
 *
 * Covers:
 *   - Valid: each axis at allowed values (text-xs..3xl, leading-4..8 and
 *     named, font-{normal,medium,semibold,bold}); 4xl-6xl exception for
 *     icons / stats / login marketing.
 *   - Invalid: text-7xl+ (above the exception list), leading-snug /
 *     relaxed / arbitrary, font-thin / font-extrabold / font-black,
 *     arbitrary text-[size].
 *   - Bound attributes scan.
 */

const test = require('node:test');
const { RuleTester } = require('eslint');
const templateParser = require('@angular-eslint/template-parser');
const rule = require('../no-forbidden-typography');

const ruleTester = new RuleTester({
  languageOptions: { parser: templateParser },
});

test('no-forbidden-typography', () => {
  ruleTester.run('no-forbidden-typography', rule, {
    valid: [
      // Each allowed text size
      { code: '<div class="text-xs"></div>' },
      { code: '<div class="text-base"></div>' },
      { code: '<div class="text-3xl font-bold"></div>' },
      // 4xl-6xl exceptions (icons, stats, login marketing)
      { code: '<i class="fa-sharp-duotone fa-regular fa-cloud text-4xl"></i>' },
      { code: '<div class="text-5xl"></div>' },
      { code: '<div class="text-6xl"></div>' },
      // Each allowed leading
      { code: '<div class="leading-5 leading-6 leading-7"></div>' },
      { code: '<div class="leading-normal"></div>' },
      { code: '<div class="leading-none"></div>' },
      { code: '<div class="leading-tight"></div>' },
      // Each allowed font weight
      { code: '<div class="font-normal"></div>' },
      { code: '<div class="font-medium"></div>' },
      { code: '<div class="font-semibold"></div>' },
      { code: '<div class="font-bold"></div>' },
      // No typography at all
      { code: '<div class="bg-surface-0"></div>' },
      // Bound attribute with allowed values
      { code: `<div [ngClass]="{ 'font-medium': bold }"></div>` },
    ],

    invalid: [
      // text-7xl above the exception list
      {
        code: '<div class="text-7xl"></div>',
        errors: [{ messageId: 'forbiddenTextSize', data: { className: 'text-7xl' } }],
      },
      // Arbitrary text size
      {
        code: '<div class="text-[18px]"></div>',
        errors: [{ messageId: 'forbiddenTextSize' }],
      },
      // leading-snug — not in the allowed list
      {
        code: '<div class="leading-snug"></div>',
        errors: [{ messageId: 'forbiddenLeading', data: { className: 'leading-snug' } }],
      },
      // leading-relaxed
      {
        code: '<div class="leading-relaxed"></div>',
        errors: [{ messageId: 'forbiddenLeading', data: { className: 'leading-relaxed' } }],
      },
      // Arbitrary leading
      {
        code: '<div class="leading-[1.5]"></div>',
        errors: [{ messageId: 'forbiddenLeading' }],
      },
      // font-thin / extralight / light — not allowed
      {
        code: '<div class="font-thin"></div>',
        errors: [{ messageId: 'forbiddenFontWeight', data: { className: 'font-thin' } }],
      },
      {
        code: '<div class="font-extralight"></div>',
        errors: [{ messageId: 'forbiddenFontWeight', data: { className: 'font-extralight' } }],
      },
      {
        code: '<div class="font-extrabold"></div>',
        errors: [{ messageId: 'forbiddenFontWeight', data: { className: 'font-extrabold' } }],
      },
      {
        code: '<div class="font-black"></div>',
        errors: [{ messageId: 'forbiddenFontWeight', data: { className: 'font-black' } }],
      },
      // Multiple violations across axes
      {
        code: '<div class="text-7xl leading-loose font-black"></div>',
        errors: [
          { messageId: 'forbiddenTextSize', data: { className: 'text-7xl' } },
          { messageId: 'forbiddenLeading', data: { className: 'leading-loose' } },
          { messageId: 'forbiddenFontWeight', data: { className: 'font-black' } },
        ],
      },
      // Bound ternary
      {
        code: `<div [ngClass]="cond ? 'font-bold' : 'font-light'"></div>`,
        errors: [{ messageId: 'forbiddenFontWeight', data: { className: 'font-light' } }],
      },
      // Arbitrary font weights — font-[800], font-[var(--fw)]
      {
        code: '<div class="font-[800]"></div>',
        errors: [{ messageId: 'forbiddenFontWeight' }],
      },
      {
        code: '<div class="font-[900]"></div>',
        errors: [{ messageId: 'forbiddenFontWeight' }],
      },
      {
        code: '<div class="font-[var(--fw)]"></div>',
        errors: [{ messageId: 'forbiddenFontWeight' }],
      },
    ],
  });
});
