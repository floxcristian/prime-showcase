// @ts-check
'use strict';

/**
 * RuleTester suite for showcase/no-missing-dark-pair.
 *
 * Covers:
 *   - Valid: each required pair, variant prefixes (active:, hover:, !)
 *     on both sides, no surface class at all, dark-only shades (900/950)
 *     used standalone as their own dark variant.
 *   - Invalid: missing dark counterpart for surface-0 / 50 / 100 / 200;
 *     wrong dark shade present.
 *   - Bound attributes scan.
 */

const test = require('node:test');
const { RuleTester } = require('eslint');
const templateParser = require('@angular-eslint/template-parser');
const rule = require('../no-missing-dark-pair');

const ruleTester = new RuleTester({
  languageOptions: { parser: templateParser },
});

test('no-missing-dark-pair', () => {
  ruleTester.run('no-missing-dark-pair', rule, {
    valid: [
      // Canonical pairs
      { code: '<div class="bg-surface-0 dark:bg-surface-950"></div>' },
      { code: '<div class="bg-surface-0 dark:bg-surface-900"></div>' },
      { code: '<div class="bg-surface-50 dark:bg-surface-950"></div>' },
      { code: '<div class="bg-surface-100 dark:bg-surface-800"></div>' },
      { code: '<div class="bg-surface-200 dark:bg-surface-700"></div>' },
      // Variant prefixes paired correctly
      { code: '<div class="active:bg-surface-200 dark:active:bg-surface-700"></div>' },
      { code: '<div class="hover:bg-surface-100 dark:hover:bg-surface-800"></div>' },
      // ! variant
      { code: '<div class="!bg-surface-0 dark:!bg-surface-950"></div>' },
      // No surface at all — nothing to enforce
      { code: '<div class="text-color"></div>' },
      // Dark-only shades used standalone (no light pair required)
      { code: '<div class="bg-surface-900"></div>' },
      { code: '<div class="bg-surface-950"></div>' },
      // Bound attribute with both pair members present
      { code: `<div [ngClass]="{ 'bg-surface-0 dark:bg-surface-950': isLight }"></div>` },
    ],

    invalid: [
      // surface-0 with no dark counterpart
      {
        code: '<div class="bg-surface-0"></div>',
        errors: [{
          messageId: 'missingDarkPair',
          data: { shade: '0', expectedDark: '950' },
        }],
      },
      // surface-100 missing
      {
        code: '<div class="bg-surface-100"></div>',
        errors: [{
          messageId: 'missingDarkPair',
          data: { shade: '100', expectedDark: '800' },
        }],
      },
      // surface-200 missing
      {
        code: '<div class="bg-surface-200"></div>',
        errors: [{
          messageId: 'missingDarkPair',
          data: { shade: '200', expectedDark: '700' },
        }],
      },
      // Wrong dark pair — surface-0 paired with surface-700 (which is for surface-200)
      {
        code: '<div class="bg-surface-0 dark:bg-surface-700"></div>',
        errors: [{
          messageId: 'wrongDarkPair',
          data: {
            shade: '0',
            actualDark: '700',
            expectedOptions: 'dark:bg-surface-950 or dark:bg-surface-900',
          },
        }],
      },
    ],
  });
});
