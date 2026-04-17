// @ts-check
'use strict';

/**
 * RuleTester suite for showcase/hover-requires-cursor-pointer.
 *
 * Covers:
 *   - Valid: both present, PrimeNG exemption, pButton exemption, neither present,
 *            group-hover:/peer-hover: on an element without cursor-pointer (legitimate
 *            parent/sibling pattern — the parent has cursor-pointer)
 *   - Invalid: cursor-pointer alone, hover:* alone, cursor-pointer with only
 *              group-hover:* (not equivalent), hover across bound attrs without
 *              cursor-pointer on element, routerLinkActive with hover but no cursor
 *   - Suggestions: 3 hover suggestions when cursor-only, 1 cursor suggestion when
 *                  hover-only
 */

const test = require('node:test');
const { RuleTester } = require('eslint');
const templateParser = require('@angular-eslint/template-parser');
const rule = require('../hover-requires-cursor-pointer');

const ruleTester = new RuleTester({
  languageOptions: {
    parser: templateParser,
  },
});

test('hover-requires-cursor-pointer', () => {
  ruleTester.run('hover-requires-cursor-pointer', rule, {
    valid: [
      // Both present — happy path
      { code: '<div class="cursor-pointer hover:bg-emphasis"></div>' },
      { code: '<button class="cursor-pointer hover:opacity-70"></button>' },
      // PrimeNG component — exempt
      { code: '<p-button></p-button>' },
      { code: '<p-select class="hover:bg-emphasis"></p-select>' },
      // pButton directive — exempt
      { code: '<button pButton label="OK"></button>' },
      { code: '<button pButton class="cursor-pointer"></button>' },
      // Neither hover nor cursor — nothing to enforce
      { code: '<div class="flex items-center gap-2"></div>' },
      { code: '<span class="text-color font-medium"></span>' },
      { code: '<div></div>' },
      // group-hover / peer-hover: child can use these WITHOUT cursor-pointer on itself
      // (the .group/.peer parent carries cursor-pointer)
      { code: '<div class="group-hover:bg-emphasis"></div>' },
      { code: '<div class="peer-hover:text-primary"></div>' },
      // routerLinkActive with hover AND cursor-pointer — OK
      {
        code: '<a class="cursor-pointer" routerLinkActive="bg-primary hover:bg-primary-emphasis"></a>',
      },
      // Bound attributes covering both
      {
        code: `<div [ngClass]="{ 'cursor-pointer': true, 'hover:bg-emphasis': true }"></div>`,
      },
    ],

    invalid: [
      // 1. cursor-pointer alone
      {
        code: '<div class="cursor-pointer"></div>',
        errors: [{ messageId: 'cursorWithoutHover', suggestions: 3 }],
      },
      // 2. hover:* alone on <div>
      {
        code: '<div class="hover:bg-emphasis"></div>',
        errors: [{ messageId: 'hoverWithoutCursor', suggestions: 1 }],
      },
      // 3. Plain <button> (no pButton) with cursor but no hover
      {
        code: '<button class="cursor-pointer flex items-center"></button>',
        errors: [{ messageId: 'cursorWithoutHover', suggestions: 3 }],
      },
      // 4. cursor-pointer via [ngClass] without hover
      {
        code: `<div [ngClass]="{ 'cursor-pointer': true }"></div>`,
        errors: [{ messageId: 'cursorWithoutHover', suggestions: 3 }],
      },
      // 5. hover:* via [ngClass] without cursor
      {
        code: `<div [ngClass]="{ 'hover:bg-emphasis': x }"></div>`,
        errors: [{ messageId: 'hoverWithoutCursor', suggestions: 1 }],
      },
      // 6. cursor-pointer with ONLY group-hover:* — not equivalent; group-hover is a child state
      {
        code: '<div class="cursor-pointer group-hover:bg-emphasis"></div>',
        errors: [{ messageId: 'cursorWithoutHover', suggestions: 3 }],
      },
      // 7. Split across attrs: cursor in `class`, nothing else
      {
        code: `<span class="cursor-pointer" [ngClass]="{ 'text-color': x }"></span>`,
        errors: [{ messageId: 'cursorWithoutHover', suggestions: 3 }],
      },
      // 8. routerLinkActive with hover but no cursor on element static class
      {
        code: '<a routerLinkActive="hover:bg-primary-emphasis text-color"></a>',
        errors: [{ messageId: 'hoverWithoutCursor', suggestions: 1 }],
      },
      // 9. Ternary branch with cursor only
      {
        code: `<div [ngClass]="x ? 'cursor-pointer' : 'text-color'"></div>`,
        errors: [{ messageId: 'cursorWithoutHover', suggestions: 3 }],
      },
      // 10. <a> with hover:* only
      {
        code: '<a class="hover:text-muted-color-emphasis">link</a>',
        errors: [{ messageId: 'hoverWithoutCursor', suggestions: 1 }],
      },
    ],
  });
});

test('hover-requires-cursor-pointer — suggestion autofix output', () => {
  ruleTester.run('hover-requires-cursor-pointer', rule, {
    valid: [],
    invalid: [
      {
        // Suggest appending hover:* to existing class attribute.
        code: '<div class="cursor-pointer flex"></div>',
        errors: [
          {
            messageId: 'cursorWithoutHover',
            suggestions: [
              {
                messageId: 'suggestHoverBgEmphasis',
                output: '<div class="cursor-pointer flex hover:bg-emphasis"></div>',
              },
              {
                messageId: 'suggestHoverOpacity',
                output: '<div class="cursor-pointer flex hover:opacity-70"></div>',
              },
              {
                messageId: 'suggestHoverText',
                output: '<div class="cursor-pointer flex hover:text-muted-color-emphasis"></div>',
              },
            ],
          },
        ],
      },
      {
        // Suggest appending cursor-pointer when only hover:* exists.
        code: '<div class="hover:bg-emphasis"></div>',
        errors: [
          {
            messageId: 'hoverWithoutCursor',
            suggestions: [
              {
                messageId: 'suggestAddCursorPointer',
                output: '<div class="hover:bg-emphasis cursor-pointer"></div>',
              },
            ],
          },
        ],
      },
    ],
  });
});
