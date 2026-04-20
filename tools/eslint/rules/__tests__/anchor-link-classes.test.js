// @ts-check
'use strict';

/**
 * RuleTester suite for showcase/anchor-link-classes.
 *
 * Covers:
 *   - Valid: full canonical class set
 *   - Valid: classes split across class + [ngClass] + [class]
 *   - Valid exemptions: routerLink, href="#...", wrapping <p-button> or <button pButton>
 *   - Invalid: missing each required class (one error per missing class)
 */

const test = require('node:test');
const { RuleTester } = require('eslint');
const templateParser = require('@angular-eslint/template-parser');
const rule = require('../anchor-link-classes');

const ruleTester = new RuleTester({
  languageOptions: { parser: templateParser },
});

const FULL_SET =
  'font-medium cursor-pointer transition-colors duration-150 underline text-primary hover:text-primary-emphasis';

test('anchor-link-classes', () => {
  ruleTester.run('anchor-link-classes', rule, {
    valid: [
      // Full canonical set in class=""
      { code: `<a href="/docs" class="${FULL_SET}">Docs</a>` },
      // Split: some in class, some in [ngClass]
      {
        code: `<a href="/docs" class="font-medium cursor-pointer transition-colors duration-150" [ngClass]="{ 'underline text-primary hover:text-primary-emphasis': true }">Docs</a>`,
      },
      // Split: some in class, some in [class]
      {
        code: `<a href="/docs" class="font-medium cursor-pointer transition-colors duration-150" [class]="'underline text-primary hover:text-primary-emphasis'">Docs</a>`,
      },

      // Exemption 1: routerLink (nav item)
      {
        code: `<a [routerLink]="'/home'" class="px-4 py-1 text-muted-color">Home</a>`,
      },
      {
        code: `<a routerLink="/home" class="px-4 py-1">Home</a>`,
      },
      // Exemption 2: href starts with "#"
      {
        code: `<a href="#main-content" class="sr-only focus:not-sr-only">Skip</a>`,
      },
      {
        code: `<a href="#section-1">Jump</a>`,
      },
      // Exemption 3: wraps <p-button>
      {
        code: `<a [href]="link" target="_blank"><p-button icon="fa-x" /></a>`,
      },
      // Exemption 3: wraps <button pButton>
      {
        code: `<a [href]="link" target="_blank"><button pButton>Go</button></a>`,
      },

      // Non-anchor elements are ignored
      { code: '<div class="underline">not a link</div>' },
    ],

    invalid: [
      // Missing ALL classes — one error per missing class = 7 errors
      {
        code: '<a href="/docs">Docs</a>',
        errors: [
          { messageId: 'missingClass', data: { className: 'font-medium' } },
          { messageId: 'missingClass', data: { className: 'cursor-pointer' } },
          { messageId: 'missingClass', data: { className: 'transition-colors' } },
          { messageId: 'missingClass', data: { className: 'duration-150' } },
          { messageId: 'missingClass', data: { className: 'underline' } },
          { messageId: 'missingClass', data: { className: 'text-primary' } },
          { messageId: 'missingClass', data: { className: 'hover:text-primary-emphasis' } },
        ],
      },
      // Has everything EXCEPT text-primary + hover:text-primary-emphasis
      {
        code: '<a href="/docs" class="font-medium cursor-pointer transition-colors duration-150 underline">Docs</a>',
        errors: [
          { messageId: 'missingClass', data: { className: 'text-primary' } },
          { messageId: 'missingClass', data: { className: 'hover:text-primary-emphasis' } },
        ],
      },
      // Has everything EXCEPT underline (common mistake — Tailwind preflight strips it)
      {
        code: '<a href="/docs" class="font-medium cursor-pointer transition-colors duration-150 text-primary hover:text-primary-emphasis">Docs</a>',
        errors: [{ messageId: 'missingClass', data: { className: 'underline' } }],
      },
      // Has text-blue-500 instead of text-primary (the anti-pattern the rule prevents)
      {
        code: '<a href="/docs" class="font-medium cursor-pointer transition-colors duration-150 underline text-blue-500 hover:text-blue-700">Docs</a>',
        errors: [
          { messageId: 'missingClass', data: { className: 'text-primary' } },
          { messageId: 'missingClass', data: { className: 'hover:text-primary-emphasis' } },
        ],
      },
      // href="javascript:..." does NOT match exemption 2 (only "#" prefix is exempt)
      {
        code: '<a href="https://example.com">External</a>',
        errors: [
          { messageId: 'missingClass', data: { className: 'font-medium' } },
          { messageId: 'missingClass', data: { className: 'cursor-pointer' } },
          { messageId: 'missingClass', data: { className: 'transition-colors' } },
          { messageId: 'missingClass', data: { className: 'duration-150' } },
          { messageId: 'missingClass', data: { className: 'underline' } },
          { messageId: 'missingClass', data: { className: 'text-primary' } },
          { messageId: 'missingClass', data: { className: 'hover:text-primary-emphasis' } },
        ],
      },
    ],
  });
});
