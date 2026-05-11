// @ts-check
'use strict';

/**
 * RuleTester suite for showcase/no-forbidden-rounded.
 *
 * Covers:
 *   - Valid: rounded-full / lg / xl / 2xl / 3xl / border, directional
 *     variants (rounded-t-lg, rounded-br-2xl), rounded inside arbitrary
 *     compound shapes only when they match an allowed token.
 *   - Invalid: bare `rounded`, rounded-sm / md / none, arbitrary
 *     rounded-[*].
 *   - Bound attribute scans.
 */

const test = require('node:test');
const { RuleTester } = require('eslint');
const templateParser = require('@angular-eslint/template-parser');
const rule = require('../no-forbidden-rounded');

const ruleTester = new RuleTester({
  languageOptions: { parser: templateParser },
});

test('no-forbidden-rounded', () => {
  ruleTester.run('no-forbidden-rounded', rule, {
    valid: [
      { code: '<div class="rounded-full"></div>' },
      { code: '<div class="rounded-lg"></div>' },
      { code: '<div class="rounded-xl"></div>' },
      { code: '<div class="rounded-2xl"></div>' },
      { code: '<div class="rounded-3xl"></div>' },
      // PrimeNG design token
      { code: '<div class="rounded-border"></div>' },
      // Directional variants are allowed
      { code: '<div class="rounded-t-lg"></div>' },
      { code: '<div class="rounded-br-2xl"></div>' },
      { code: '<div class="rounded-tl-xl rounded-tr-xl"></div>' },
      // Logical directional (RTL-friendly)
      { code: '<div class="rounded-ss-lg"></div>' },
      // No rounded at all — nothing to report
      { code: '<div class="border border-surface"></div>' },
      // Bound attribute with valid value
      { code: `<div [ngClass]="{ 'rounded-2xl': isCard }"></div>` },
    ],

    invalid: [
      // Bare rounded
      {
        code: '<div class="rounded"></div>',
        errors: [{ messageId: 'noForbiddenRounded', data: { className: 'rounded' } }],
      },
      // rounded-sm
      {
        code: '<div class="rounded-sm"></div>',
        errors: [{ messageId: 'noForbiddenRounded', data: { className: 'rounded-sm' } }],
      },
      // rounded-md (Tailwind default radius)
      {
        code: '<div class="rounded-md"></div>',
        errors: [{ messageId: 'noForbiddenRounded', data: { className: 'rounded-md' } }],
      },
      // rounded-none
      {
        code: '<div class="rounded-none"></div>',
        errors: [{ messageId: 'noForbiddenRounded', data: { className: 'rounded-none' } }],
      },
      // Arbitrary value
      {
        code: '<div class="rounded-[5px]"></div>',
        errors: [{ messageId: 'noForbiddenRounded' }],
      },
      // Mixed: one valid + one invalid
      {
        code: '<div class="rounded-2xl rounded-sm"></div>',
        errors: [{ messageId: 'noForbiddenRounded', data: { className: 'rounded-sm' } }],
      },
      // Bound ternary — one bad branch
      {
        code: `<div [ngClass]="active ? 'rounded-2xl' : 'rounded-md'"></div>`,
        errors: [{ messageId: 'noForbiddenRounded', data: { className: 'rounded-md' } }],
      },
    ],
  });
});
