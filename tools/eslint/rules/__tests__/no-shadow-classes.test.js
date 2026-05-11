// @ts-check
'use strict';

/**
 * RuleTester suite for showcase/no-shadow-classes.
 *
 * Covers:
 *   - Valid: any non-shadow class; shadow-none / !shadow-none (PrimeNG reset).
 *   - Invalid: shadow, shadow-sm/md/lg/xl/2xl/inner, drop-shadow-*,
 *     arbitrary shadow-[...].
 *   - ! variants flagged the same as plain ones.
 *   - Bound attributes scan.
 */

const test = require('node:test');
const { RuleTester } = require('eslint');
const templateParser = require('@angular-eslint/template-parser');
const rule = require('../no-shadow-classes');

const ruleTester = new RuleTester({
  languageOptions: { parser: templateParser },
});

test('no-shadow-classes', () => {
  ruleTester.run('no-shadow-classes', rule, {
    valid: [
      { code: '<div class="border border-surface rounded-2xl"></div>' },
      // shadow-none is the PrimeNG reset and is explicitly allowed
      { code: '<div class="shadow-none"></div>' },
      { code: '<div class="!shadow-none"></div>' },
      // Word that contains "shadow" but isn't a Tailwind shadow utility
      { code: '<div class="text-color"></div>' },
      // Bound attribute with no shadows
      { code: `<div [ngClass]="{ 'shadow-none': resetShadow }"></div>` },
    ],

    invalid: [
      // Plain shadow
      {
        code: '<div class="shadow"></div>',
        errors: [{ messageId: 'noShadow', data: { className: 'shadow' } }],
      },
      // shadow-lg
      {
        code: '<div class="shadow-lg"></div>',
        errors: [{ messageId: 'noShadow', data: { className: 'shadow-lg' } }],
      },
      // shadow-2xl
      {
        code: '<div class="shadow-2xl"></div>',
        errors: [{ messageId: 'noShadow', data: { className: 'shadow-2xl' } }],
      },
      // shadow-inner
      {
        code: '<div class="shadow-inner"></div>',
        errors: [{ messageId: 'noShadow', data: { className: 'shadow-inner' } }],
      },
      // drop-shadow utility (filter family)
      {
        code: '<div class="drop-shadow-md"></div>',
        errors: [{ messageId: 'noShadow', data: { className: 'drop-shadow-md' } }],
      },
      // Arbitrary shadow value
      {
        code: '<div class="shadow-[0_4px_6px_rgba(0,0,0,0.1)]"></div>',
        errors: [{ messageId: 'noShadow' }],
      },
      // ! variant — still forbidden
      {
        code: '<div class="!shadow-lg"></div>',
        errors: [{ messageId: 'noShadow', data: { className: '!shadow-lg' } }],
      },
      // Multiple shadows in one string
      {
        code: '<div class="shadow shadow-lg"></div>',
        errors: [
          { messageId: 'noShadow', data: { className: 'shadow' } },
          { messageId: 'noShadow', data: { className: 'shadow-lg' } },
        ],
      },
      // Bound ternary with one bad branch
      {
        code: `<div [ngClass]="cond ? 'shadow-md' : 'border-surface'"></div>`,
        errors: [{ messageId: 'noShadow', data: { className: 'shadow-md' } }],
      },
    ],
  });
});
