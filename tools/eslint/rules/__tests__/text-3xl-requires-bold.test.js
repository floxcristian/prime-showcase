// @ts-check
'use strict';

/**
 * RuleTester suite for showcase/text-3xl-requires-bold.
 *
 * Covers:
 *   - Valid: text-3xl + font-bold in same class
 *   - Valid: split across class + [ngClass] on same element
 *   - Invalid: text-3xl without font-bold
 *   - Invalid: text-3xl + font-semibold (or font-medium, etc.)
 *   - Invalid: bound attributes (object literal key, ternary)
 */

const test = require('node:test');
const { RuleTester } = require('eslint');
const templateParser = require('@angular-eslint/template-parser');
const rule = require('../text-3xl-requires-bold');

const ruleTester = new RuleTester({
  languageOptions: { parser: templateParser },
});

test('text-3xl-requires-bold', () => {
  ruleTester.run('text-3xl-requires-bold', rule, {
    valid: [
      // Same class string
      { code: '<h1 class="text-3xl font-bold leading-normal text-color">Title</h1>' },
      { code: '<h1 class="font-bold text-3xl">Title</h1>' },
      // Split across class + [class]
      { code: `<h1 class="text-3xl" [class]="'font-bold'">Title</h1>` },
      // Split across class + [ngClass] key
      {
        code: `<h1 class="text-3xl text-color" [ngClass]="{ 'font-bold': cond }">Title</h1>`,
      },
      // Bound: both tokens in same ngClass key
      {
        code: `<h1 [ngClass]="{ 'text-3xl font-bold leading-normal': cond }">Title</h1>`,
      },
      // No text-3xl — rule doesn't apply
      { code: '<div class="text-2xl font-medium">Subtitle</div>' },
      // No class at all
      { code: '<div></div>' },
    ],

    invalid: [
      // Bare text-3xl
      {
        code: '<h1 class="text-3xl text-color">Title</h1>',
        errors: [{ messageId: 'missingBold' }],
      },
      // With font-semibold (old recipe)
      {
        code: '<h1 class="text-3xl font-semibold leading-normal text-color">Title</h1>',
        errors: [{ messageId: 'missingBold' }],
      },
      // With font-medium (brand wordmark pattern)
      {
        code: '<div class="font-medium text-3xl">Prime</div>',
        errors: [{ messageId: 'missingBold' }],
      },
      // Bound: object literal key with text-3xl but no font-bold
      {
        code: `<h1 [ngClass]="{ 'text-3xl font-semibold': cond }">Title</h1>`,
        errors: [{ messageId: 'missingBold' }],
      },
      // Bound: ternary — both branches have text-3xl but neither has font-bold
      {
        code: `<h1 [ngClass]="cond ? 'text-3xl font-semibold' : 'text-3xl font-medium'">Title</h1>`,
        errors: [{ messageId: 'missingBold' }],
      },
    ],
  });
});
