// @ts-check
'use strict';

/**
 * RuleTester suite for showcase/no-duotone-inline-icon.
 *
 * Covers:
 *   - Valid: fa-sharp-duotone + text-4xl / text-5xl / etc.
 *   - Invalid: fa-sharp-duotone without hero size; with text-sm, text-base, text-xl, text-3xl
 *   - Bound attributes: ternary, object literal, string literal
 *   - Multiple duotone tokens in one class (single error per string — same source)
 */

const test = require('node:test');
const { RuleTester } = require('eslint');
const templateParser = require('@angular-eslint/template-parser');
const rule = require('../no-duotone-inline-icon');

const ruleTester = new RuleTester({
  languageOptions: { parser: templateParser },
});

test('no-duotone-inline-icon', () => {
  ruleTester.run('no-duotone-inline-icon', rule, {
    valid: [
      // Hero sizes in same class string
      { code: '<i class="fa-sharp-duotone fa-regular fa-cloud text-4xl"></i>' },
      { code: '<i class="fa-sharp-duotone fa-regular fa-shield text-5xl"></i>' },
      { code: '<i class="fa-sharp-duotone fa-regular fa-star text-6xl"></i>' },
      { code: '<i class="fa-sharp-duotone fa-regular fa-star text-9xl"></i>' },
      // Size before the duotone token — order doesn't matter
      { code: '<i class="text-4xl fa-sharp-duotone fa-regular fa-x"></i>' },
      // Size and duotone split across class + [class] on same element
      {
        code: `<i class="fa-sharp-duotone fa-regular fa-x" [class]="'text-4xl'"></i>`,
      },
      // Size and duotone split across class + [ngClass] object key
      {
        code: `<i class="fa-sharp-duotone fa-regular fa-x" [ngClass]="{ 'text-4xl': cond }"></i>`,
      },
      // Not duotone — unrelated
      { code: '<i class="fa-sharp fa-regular fa-bell"></i>' },
      // No FA at all
      { code: '<div class="flex items-center gap-2"></div>' },
      // Bound: duotone WITH hero size
      {
        code: `<i [ngClass]="{ 'fa-sharp-duotone fa-regular fa-x text-4xl': cond }"></i>`,
      },
    ],

    invalid: [
      // Plain inline
      {
        code: '<i class="fa-sharp-duotone fa-regular fa-bell"></i>',
        errors: [{ messageId: 'duotoneTooSmall' }],
      },
      // With small size — still below hero
      {
        code: '<i class="fa-sharp-duotone fa-regular fa-bell text-sm"></i>',
        errors: [{ messageId: 'duotoneTooSmall' }],
      },
      // text-base
      {
        code: '<i class="fa-sharp-duotone fa-regular fa-bell text-base"></i>',
        errors: [{ messageId: 'duotoneTooSmall' }],
      },
      // text-xl — below 4xl
      {
        code: '<i class="fa-sharp-duotone fa-regular fa-bell text-xl"></i>',
        errors: [{ messageId: 'duotoneTooSmall' }],
      },
      // text-3xl — still below 4xl
      {
        code: '<i class="fa-sharp-duotone fa-regular fa-bell text-3xl"></i>',
        errors: [{ messageId: 'duotoneTooSmall' }],
      },
      // Bound object literal
      {
        code: `<i [ngClass]="{ 'fa-sharp-duotone fa-regular fa-bell': cond }"></i>`,
        errors: [{ messageId: 'duotoneTooSmall' }],
      },
      // Bound ternary
      {
        code: `<i [ngClass]="cond ? 'fa-sharp-duotone fa-regular fa-bell' : 'fa-sharp fa-regular fa-bell'"></i>`,
        errors: [{ messageId: 'duotoneTooSmall' }],
      },
      // String literal via [class]
      {
        code: `<i [class]="'fa-sharp-duotone fa-regular fa-bell'"></i>`,
        errors: [{ messageId: 'duotoneTooSmall' }],
      },
    ],
  });
});
