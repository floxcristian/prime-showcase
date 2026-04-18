// @ts-check
'use strict';

/**
 * RuleTester suite for showcase/no-decorative-icon-without-aria-hidden.
 *
 * Covers:
 *   - Valid: <i> with aria-hidden="true", [attr.aria-hidden]="true",
 *            <i> without fa-* class (exempt)
 *   - Invalid: <i> with fa-* static class, no aria-hidden
 *   - Bound classes: [ngClass] with fa-* in object literal / ternary
 *   - Non-<i> tags ignored
 *   - Mixed fa-* + utility classes detected
 */

const test = require('node:test');
const { RuleTester } = require('eslint');
const templateParser = require('@angular-eslint/template-parser');
const rule = require('../no-decorative-icon-without-aria-hidden');

const ruleTester = new RuleTester({
  languageOptions: { parser: templateParser },
});

test('no-decorative-icon-without-aria-hidden', () => {
  ruleTester.run('no-decorative-icon-without-aria-hidden', rule, {
    valid: [
      // Static aria-hidden
      { code: '<i class="fa-sharp fa-regular fa-bell" aria-hidden="true"></i>' },
      // Angular attr binding
      { code: `<i class="fa-sharp fa-regular fa-bell" [attr.aria-hidden]="true"></i>` },
      // Bound class with aria-hidden present
      {
        code: `<i [ngClass]="cond ? 'fa-sharp fa-solid fa-star' : 'fa-sharp fa-regular fa-star'" aria-hidden="true"></i>`,
      },
      // <i> without FA class — exempt (emphasis markup)
      { code: '<i>italic</i>' },
      { code: '<i class="font-medium text-color">em</i>' },
      // Non-<i> tag with fa-* in class — rule only targets <i>
      { code: '<span class="fa-sharp fa-regular fa-bell"></span>' },
      // Mixed fa-* and utility, aria-hidden present
      {
        code: '<i class="text-lg fa-sharp fa-regular fa-x" aria-hidden="true"></i>',
      },
    ],

    invalid: [
      // Static fa-* class, missing aria-hidden
      {
        code: '<i class="fa-sharp fa-regular fa-bell"></i>',
        errors: [{ messageId: 'missingAriaHidden' }],
      },
      // fa-solid
      {
        code: '<i class="fa-sharp fa-solid fa-star"></i>',
        errors: [{ messageId: 'missingAriaHidden' }],
      },
      // fa-brands
      {
        code: '<i class="fa-brands fa-bitcoin"></i>',
        errors: [{ messageId: 'missingAriaHidden' }],
      },
      // Mixed utility + FA, missing aria-hidden
      {
        code: '<i class="text-lg fa-sharp fa-regular fa-x"></i>',
        errors: [{ messageId: 'missingAriaHidden' }],
      },
      // [ngClass] ternary with fa-*, missing aria-hidden
      {
        code: `<i [ngClass]="cond ? 'fa-sharp fa-solid fa-star' : 'fa-sharp fa-regular fa-star'"></i>`,
        errors: [{ messageId: 'missingAriaHidden' }],
      },
      // [ngClass] object literal with fa-* in key
      {
        code: `<i [ngClass]="{ 'fa-sharp fa-solid fa-bookmark': on }"></i>`,
        errors: [{ messageId: 'missingAriaHidden' }],
      },
      // [class] with string literal containing fa-*
      {
        code: `<i [class]="'fa-sharp fa-regular fa-cloud'"></i>`,
        errors: [{ messageId: 'missingAriaHidden' }],
      },
      // styleClass="..." — PrimeNG static variant, fa-* present
      {
        code: `<i styleClass="fa-sharp fa-regular fa-bell"></i>`,
        errors: [{ messageId: 'missingAriaHidden' }],
      },
      // [styleClass] bound — fa-* in string literal
      {
        code: `<i [styleClass]="'fa-sharp fa-regular fa-bell'"></i>`,
        errors: [{ messageId: 'missingAriaHidden' }],
      },
    ],
  });
});
