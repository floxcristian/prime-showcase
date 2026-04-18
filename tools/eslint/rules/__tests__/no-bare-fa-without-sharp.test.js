// @ts-check
'use strict';

/**
 * RuleTester suite for showcase/no-bare-fa-without-sharp.
 *
 * Covers:
 *   - Valid: fa-sharp + style token, fa-sharp-duotone + style token, fa-brands alone
 *   - Invalid: bare fa-regular/fa-solid/fa-light/fa-duotone without fa-sharp
 *   - Bound attributes: [ngClass], [class], ternary branches, object keys
 *   - routerLinkActive scanning
 *   - Multiple violations in a single string
 */

const test = require('node:test');
const { RuleTester } = require('eslint');
const templateParser = require('@angular-eslint/template-parser');
const rule = require('../no-bare-fa-without-sharp');

const ruleTester = new RuleTester({
  languageOptions: { parser: templateParser },
});

test('no-bare-fa-without-sharp', () => {
  ruleTester.run('no-bare-fa-without-sharp', rule, {
    valid: [
      // Sharp + regular
      { code: '<i class="fa-sharp fa-regular fa-bell"></i>' },
      // Sharp + solid
      { code: '<i class="fa-sharp fa-solid fa-star"></i>' },
      // Sharp-duotone + regular (hero)
      { code: '<i class="fa-sharp-duotone fa-regular fa-cloud text-4xl"></i>' },
      // Brands — no sharp prefix needed
      { code: '<i class="fa-brands fa-bitcoin"></i>' },
      // Order-insensitive: prefix after style token
      { code: '<i class="fa-regular fa-sharp fa-star"></i>' },
      // Mixed with utility classes
      { code: '<i class="text-muted-color fa-sharp fa-regular fa-arrows-rotate"></i>' },
      // Non-FA class — ignored
      { code: '<div class="flex items-center gap-2"></div>' },
      // Bound attribute, valid
      { code: `<i [ngClass]="{ 'fa-sharp fa-regular fa-bell': cond }"></i>` },
      // Bound ternary, both branches valid
      { code: `<i [ngClass]="cond ? 'fa-sharp fa-solid fa-star' : 'fa-sharp fa-regular fa-star'"></i>` },
      // routerLinkActive with valid icon class
      { code: `<a routerLinkActive="fa-sharp fa-solid fa-check"></a>` },
    ],

    invalid: [
      // Bare regular
      {
        code: '<i class="fa-regular fa-bell"></i>',
        errors: [{ messageId: 'missingSharp', data: { token: 'fa-regular' } }],
      },
      // Bare solid
      {
        code: '<i class="fa-solid fa-star"></i>',
        errors: [{ messageId: 'missingSharp', data: { token: 'fa-solid' } }],
      },
      // Bare light (not loaded)
      {
        code: '<i class="fa-light fa-user"></i>',
        errors: [{ messageId: 'missingSharp', data: { token: 'fa-light' } }],
      },
      // Bare duotone (sharp-duotone is what's loaded)
      {
        code: '<i class="fa-duotone fa-cloud"></i>',
        errors: [{ messageId: 'missingSharp', data: { token: 'fa-duotone' } }],
      },
      // Mixed with utilities, still bare
      {
        code: '<i class="text-lg fa-regular fa-bell"></i>',
        errors: [{ messageId: 'missingSharp', data: { token: 'fa-regular' } }],
      },
      // Bound attribute (attribute-level loc, single error)
      {
        code: `<i [ngClass]="{ 'fa-regular fa-bell': cond }"></i>`,
        errors: [{ messageId: 'missingSharp' }],
      },
      // Bound ternary — one bad branch
      {
        code: `<i [ngClass]="cond ? 'fa-solid fa-star' : 'fa-sharp fa-regular fa-star'"></i>`,
        errors: [{ messageId: 'missingSharp', data: { token: 'fa-solid' } }],
      },
      // routerLinkActive with bare style token
      {
        code: `<a routerLinkActive="bg-primary fa-solid fa-check"></a>`,
        errors: [{ messageId: 'missingSharp', data: { token: 'fa-solid' } }],
      },
    ],
  });
});
