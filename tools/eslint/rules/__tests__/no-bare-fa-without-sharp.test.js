// @ts-check
'use strict';

/**
 * RuleTester suite for showcase/no-bare-fa-without-sharp.
 *
 * Covers:
 *   - Valid: fa-sharp + style token, fa-sharp-duotone + style token, fa-brands alone
 *   - Valid: prefix and style token SPLIT across attributes of the same
 *     element (class="fa-sharp" + [ngClass] with 'fa-regular') — the rule
 *     is element-level, matching the runtime class list
 *   - Invalid: bare fa-regular/fa-solid/fa-light/fa-duotone without fa-sharp
 *     anywhere on the element
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
      // Element-level: prefix in STATIC class (always applied), style token
      // toggled via [ngClass] — the runtime class list combines them.
      // Previously a false positive under the per-string scan.
      { code: `<i class="fa-sharp" [ngClass]="{ 'fa-regular': cond }"></i>` },
      { code: `<i class="fa-sharp fa-bookmark" [ngClass]="bookmarked ? 'fa-solid' : 'fa-regular'"></i>` },
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
      // Bound attribute (element-level loc, single error)
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
      // Split across attrs but NO prefix anywhere — still flagged
      {
        code: `<i class="text-lg" [ngClass]="{ 'fa-regular fa-bell': cond }"></i>`,
        errors: [{ messageId: 'missingSharp', data: { token: 'fa-regular' } }],
      },
      // Two bare tokens across two attributes → two errors, element-level loc
      {
        code: `<i class="fa-regular fa-bell" [ngClass]="{ 'fa-solid': active }"></i>`,
        errors: [
          { messageId: 'missingSharp', data: { token: 'fa-regular' } },
          { messageId: 'missingSharp', data: { token: 'fa-solid' } },
        ],
      },
      // Prefix only in a CONDITIONAL source does not cover a bare static
      // token — at runtime the bound class may be off.
      {
        code: `<i class="fa-regular fa-bell" [ngClass]="{ 'fa-sharp': cond }"></i>`,
        errors: [{ messageId: 'missingSharp', data: { token: 'fa-regular' } }],
      },
    ],
  });
});
