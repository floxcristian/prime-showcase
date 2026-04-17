// @ts-check
'use strict';

/**
 * RuleTester suite for showcase/no-forbidden-transitions.
 *
 * Covers:
 *   - Whitelist: transition-colors, transition-opacity, transition-transform,
 *     transition-none, transition-shadow, transition-[transform]
 *   - Variant prefixes: hover:, md:, dark:, group-hover:, and !important modifier
 *   - Arbitrary values with forbidden properties: transition-[all], transition-[box-shadow]
 *   - Bound attributes: [ngClass]="{ 'transition-all': x }", [class]="'transition-all'",
 *     ternary branches
 *   - routerLinkActive scanning
 *   - Suggestions count (3 per error)
 */

const test = require('node:test');
const { RuleTester } = require('eslint');
const templateParser = require('@angular-eslint/template-parser');
const rule = require('../no-forbidden-transitions');

const ruleTester = new RuleTester({
  languageOptions: {
    parser: templateParser,
  },
});

test('no-forbidden-transitions', () => {
  ruleTester.run('no-forbidden-transitions', rule, {
    valid: [
      // Plain whitelisted utilities
      { code: '<div class="transition-colors"></div>' },
      { code: '<div class="transition-opacity"></div>' },
      { code: '<div class="transition-transform"></div>' },
      { code: '<div class="transition-none"></div>' },
      { code: '<div class="transition-shadow"></div>' },
      // Narrow arbitrary value — allowed
      { code: '<div class="transition-[transform]"></div>' },
      // No transition at all
      { code: '<div class="flex items-center gap-2"></div>' },
      // Whitelisted with variant prefix
      { code: '<div class="hover:transition-colors"></div>' },
      { code: '<div class="md:transition-opacity"></div>' },
      { code: '<button class="dark:transition-transform"></button>' },
      // Bound attributes with allowed values
      { code: `<div [ngClass]="{ 'transition-colors': x }"></div>` },
      { code: `<div [class]="'transition-opacity'"></div>` },
      // routerLinkActive — new scan target, this content is compliant
      { code: `<a routerLinkActive="bg-primary transition-colors"></a>` },
    ],

    invalid: [
      // 1. Static `class` — plain transition-all
      {
        code: '<div class="transition-all"></div>',
        errors: [{ messageId: 'noForbiddenTransition', data: { className: 'transition-all' }, suggestions: 3 }],
      },
      // 2. Bare `transition`
      {
        code: '<div class="transition"></div>',
        errors: [{ messageId: 'noForbiddenTransition', data: { className: 'transition' }, suggestions: 3 }],
      },
      // 3. hover:transition-all
      {
        code: '<div class="hover:transition-all"></div>',
        errors: [{ messageId: 'noForbiddenTransition', data: { className: 'transition-all' }, suggestions: 3 }],
      },
      // 4. md:transition-all
      {
        code: '<div class="md:transition-all"></div>',
        errors: [{ messageId: 'noForbiddenTransition', data: { className: 'transition-all' }, suggestions: 3 }],
      },
      // 5. group-hover:transition-all
      {
        code: '<div class="group-hover:transition-all"></div>',
        errors: [{ messageId: 'noForbiddenTransition', data: { className: 'transition-all' }, suggestions: 3 }],
      },
      // 6. !transition-all (important)
      {
        code: '<div class="!transition-all"></div>',
        errors: [{ messageId: 'noForbiddenTransition', data: { className: '!transition-all' }, suggestions: 3 }],
      },
      // 7. md:!transition-all — important after prefix
      {
        code: '<div class="md:!transition-all"></div>',
        errors: [{ messageId: 'noForbiddenTransition', data: { className: '!transition-all' }, suggestions: 3 }],
      },
      // 8. transition-[all] — arbitrary "all"
      {
        code: '<div class="transition-[all]"></div>',
        errors: [{ messageId: 'noForbiddenArbitrary', data: { className: 'transition-[all]' }, suggestions: 3 }],
      },
      // 9. transition-[box-shadow,color]
      {
        code: '<div class="transition-[box-shadow,color]"></div>',
        errors: [{ messageId: 'noForbiddenArbitrary', data: { className: 'transition-[box-shadow,color]' }, suggestions: 3 }],
      },
      // 10. [ngClass] with transition-all
      {
        code: `<div [ngClass]="{ 'transition-all': x }"></div>`,
        errors: [{ messageId: 'noForbiddenTransition', suggestions: 0 }],
      },
      // 11. [class] with string literal
      {
        code: `<div [class]="'transition-all'"></div>`,
        errors: [{ messageId: 'noForbiddenTransition', suggestions: 0 }],
      },
      // 12. Ternary branch
      {
        code: `<div [ngClass]="x ? 'transition-all' : 'bg-red'"></div>`,
        errors: [{ messageId: 'noForbiddenTransition', suggestions: 0 }],
      },
    ],
  });
});

test('no-forbidden-transitions — suggestion autofix output', () => {
  ruleTester.run('no-forbidden-transitions', rule, {
    valid: [],
    invalid: [
      {
        // Verify the suggestion preserves the `hover:` prefix when replacing.
        code: '<div class="hover:transition-all"></div>',
        errors: [
          {
            messageId: 'noForbiddenTransition',
            suggestions: [
              {
                messageId: 'suggestReplaceColors',
                output: '<div class="hover:transition-colors"></div>',
              },
              {
                messageId: 'suggestReplaceOpacity',
                output: '<div class="hover:transition-opacity"></div>',
              },
              {
                messageId: 'suggestReplaceTransform',
                output: '<div class="hover:transition-transform"></div>',
              },
            ],
          },
        ],
      },
      {
        // Verify !important is preserved.
        code: '<div class="md:!transition-all"></div>',
        errors: [
          {
            messageId: 'noForbiddenTransition',
            suggestions: [
              {
                messageId: 'suggestReplaceColors',
                output: '<div class="md:!transition-colors"></div>',
              },
              {
                messageId: 'suggestReplaceOpacity',
                output: '<div class="md:!transition-opacity"></div>',
              },
              {
                messageId: 'suggestReplaceTransform',
                output: '<div class="md:!transition-transform"></div>',
              },
            ],
          },
        ],
      },
    ],
  });
});
