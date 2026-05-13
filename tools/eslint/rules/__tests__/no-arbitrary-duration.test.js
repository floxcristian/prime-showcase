// @ts-check
'use strict';

/**
 * RuleTester suite for showcase/no-arbitrary-duration.
 *
 * Covers:
 *   - Forbidden numeric durations: duration-100, duration-200, duration-300,
 *     duration-500
 *   - Anchor exemption: duration-150 (paired with
 *     showcase/anchor-link-classes which REQUIRES it on text links)
 *   - Allowed token forms: duration-(--app-motion-duration-fast/base/slow)
 *   - Variant prefixes: hover:, md:, dark:
 *   - Bound attributes: [ngClass], [class], ternary branches
 *   - PrimeNG *StyleClass attributes
 *   - routerLinkActive scanning
 *   - Bare `transition-*` without duration is unaffected
 */

const test = require('node:test');
const { RuleTester } = require('eslint');
const templateParser = require('@angular-eslint/template-parser');
const rule = require('../no-arbitrary-duration');

const ruleTester = new RuleTester({
  languageOptions: {
    parser: templateParser,
  },
});

test('no-arbitrary-duration', () => {
  ruleTester.run('no-arbitrary-duration', rule, {
    valid: [
      // Anchor exemption (paired with showcase/anchor-link-classes)
      { code: '<a class="duration-150"></a>' },
      // Token forms — allowed
      {
        code: '<div class="transition-colors duration-(--app-motion-duration-fast)"></div>',
      },
      {
        code: '<button class="duration-(--app-motion-duration-base)"></button>',
      },
      {
        code: '<div class="duration-(--app-motion-duration-slow)"></div>',
      },
      // No duration class — bare transition is fine
      { code: '<div class="transition-colors"></div>' },
      { code: '<div class="transition-opacity transition-transform"></div>' },
      // No transition at all
      { code: '<div class="flex items-center gap-2"></div>' },
      // Variant on the anchor-exempt value
      { code: '<a class="hover:duration-150"></a>' },
      // Bound attributes with allowed values
      {
        code: `<div [ngClass]="{ 'duration-150': isLink }"></div>`,
      },
      {
        code: `<div [class]="'duration-(--app-motion-duration-fast)'"></div>`,
      },
      // PrimeNG styleClass
      {
        code: `<p-button styleClass="duration-150"></p-button>`,
      },
      // routerLinkActive
      {
        code: `<a routerLinkActive="bg-primary duration-150"></a>`,
      },
    ],
    invalid: [
      // Classic numeric durations
      {
        code: '<div class="duration-100"></div>',
        errors: [{ messageId: 'arbitrary', data: { className: 'duration-100' } }],
      },
      {
        code: '<div class="duration-200"></div>',
        errors: [{ messageId: 'arbitrary', data: { className: 'duration-200' } }],
      },
      {
        code: '<div class="duration-300"></div>',
        errors: [{ messageId: 'arbitrary', data: { className: 'duration-300' } }],
      },
      {
        code: '<div class="duration-500"></div>',
        errors: [{ messageId: 'arbitrary', data: { className: 'duration-500' } }],
      },
      // Toolbar regression — the actual case we corrected
      {
        code: '<i class="absolute inset-0 transition-[transform,opacity] duration-200"></i>',
        errors: [{ messageId: 'arbitrary', data: { className: 'duration-200' } }],
      },
      // With variant prefix — still forbidden (the value is what matters)
      {
        code: '<div class="hover:duration-300"></div>',
        errors: [{ messageId: 'arbitrary', data: { className: 'duration-300' } }],
      },
      // PrimeNG *StyleClass — same enforcement
      {
        code: '<p-button styleClass="duration-200"></p-button>',
        errors: [{ messageId: 'arbitrary', data: { className: 'duration-200' } }],
      },
      // Bound attribute object key
      {
        code: `<div [ngClass]="{ 'duration-300': condition }"></div>`,
        errors: [{ messageId: 'arbitrary', data: { className: 'duration-300' } }],
      },
      // Multiple violations in one class string
      {
        code: '<div class="duration-100 transition-colors duration-300"></div>',
        errors: [
          { messageId: 'arbitrary', data: { className: 'duration-100' } },
          { messageId: 'arbitrary', data: { className: 'duration-300' } },
        ],
      },
      // routerLinkActive — same scan policy as class
      {
        code: '<a routerLinkActive="bg-primary duration-300"></a>',
        errors: [{ messageId: 'arbitrary', data: { className: 'duration-300' } }],
      },
    ],
  });
});
