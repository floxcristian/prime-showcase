// @ts-check
'use strict';

/**
 * RuleTester suite for showcase/no-color-on-pbutton-icon.
 *
 * Scope mirrors the rule docstring:
 *   FORBIDDEN — design-system color tokens (text-color, text-muted-color,
 *     text-primary*, text-surface-*), bg-*, state variants (hover|focus|
 *     active|dark:), important versions of the above.
 *   ALLOWED  — fa-*, text-(xs..4xl) size, leading-*, font-*, tailwind named
 *     colors (semantic exceptions per DESIGN.md), routerLink-related icons
 *     on non-p-button elements.
 *
 * Covers static `icon="..."` and bound `[icon]="..."` (string literal,
 * ternary, object key); multiple violations in one icon string; non-p-button
 * elements ignored.
 */

const test = require('node:test');
const { RuleTester } = require('eslint');
const templateParser = require('@angular-eslint/template-parser');
const rule = require('../no-color-on-pbutton-icon');

const ruleTester = new RuleTester({
  languageOptions: { parser: templateParser },
});

test('no-color-on-pbutton-icon', () => {
  ruleTester.run('no-color-on-pbutton-icon', rule, {
    valid: [
      // Sharp regular only
      { code: '<p-button icon="fa-sharp fa-regular fa-phone" />' },
      // Sharp solid (toggle active state)
      { code: '<p-button icon="fa-sharp fa-solid fa-bookmark" />' },
      // Sharp duotone (hero usage on a button is rare but legal)
      { code: '<p-button icon="fa-sharp-duotone fa-regular fa-cloud" />' },
      // Brands logo
      { code: '<p-button icon="fa-brands fa-github" />' },
      // FA modifier (fixed width)
      { code: '<p-button icon="fa-sharp fa-regular fa-phone fa-fw" />' },
      // Empty icon (no violation to report)
      { code: '<p-button icon="" />' },
      // No icon attribute at all
      { code: '<p-button label="Save" />' },
      // Size token — load-bearing for icon size
      { code: '<p-button icon="fa-sharp fa-regular fa-download text-sm" />' },
      { code: '<p-button icon="fa-sharp fa-regular fa-bell text-2xl" />' },
      // Leading token — load-bearing for line stacking
      { code: '<p-button icon="fa-sharp fa-solid fa-star text-sm !leading-none" />' },
      // Tailwind named-color token (semantic exception per DESIGN.md)
      { code: '<p-button icon="fa-sharp fa-solid fa-circle text-green-500" />' },
      { code: '<p-button icon="fa-sharp fa-solid fa-bitcoin text-yellow-500" />' },
      // Bound icon — both ternary branches valid
      {
        code: `<p-button [icon]="active ? 'fa-sharp fa-solid fa-bookmark' : 'fa-sharp fa-regular fa-bookmark'" />`,
      },
      // Bound icon — single literal
      { code: `<p-button [icon]="'fa-sharp fa-regular fa-bell'" />` },
      // Non-p-button element with icon attribute is out of scope
      { code: `<my-card icon="fa-sharp fa-regular fa-bell text-primary" />` },
      // <i> with color class in `class` attribute is out of scope (different rule lane)
      { code: `<i class="fa-sharp fa-regular fa-bell text-muted-color" aria-hidden="true"></i>` },
    ],

    invalid: [
      // Audit-baseline scenario: text-muted-color on icon string with severity="secondary"
      {
        code: '<p-button icon="fa-sharp fa-regular fa-phone text-muted-color" severity="secondary" text />',
        errors: [{ messageId: 'foreignToken', data: { token: 'text-muted-color' } }],
      },
      // Design-system primary token
      {
        code: '<p-button icon="fa-sharp fa-regular fa-bell text-primary" />',
        errors: [{ messageId: 'foreignToken', data: { token: 'text-primary' } }],
      },
      // text-color itself
      {
        code: '<p-button icon="fa-sharp fa-regular fa-bell text-color" />',
        errors: [{ messageId: 'foreignToken', data: { token: 'text-color' } }],
      },
      // text-primary-contrast
      {
        code: '<p-button icon="fa-sharp fa-regular fa-bell text-primary-contrast" />',
        errors: [{ messageId: 'foreignToken', data: { token: 'text-primary-contrast' } }],
      },
      // Surface token
      {
        code: '<p-button icon="fa-sharp fa-regular fa-bell text-surface-500" />',
        errors: [{ messageId: 'foreignToken', data: { token: 'text-surface-500' } }],
      },
      // Background on icon
      {
        code: '<p-button icon="fa-sharp fa-regular fa-bell bg-surface-100" />',
        errors: [{ messageId: 'foreignToken', data: { token: 'bg-surface-100' } }],
      },
      // Hover utility — wrong place; belongs on the button itself
      {
        code: '<p-button icon="fa-sharp fa-regular fa-bell hover:opacity-70" />',
        errors: [{ messageId: 'foreignToken', data: { token: 'hover:opacity-70' } }],
      },
      // Dark variant — wrong attribute
      {
        code: '<p-button icon="fa-sharp fa-regular fa-bell dark:text-surface-50" />',
        errors: [{ messageId: 'foreignToken', data: { token: 'dark:text-surface-50' } }],
      },
      // Important variant of a design-system token
      {
        code: '<p-button icon="fa-sharp fa-regular fa-bell !text-muted-color" />',
        errors: [{ messageId: 'foreignToken', data: { token: '!text-muted-color' } }],
      },
      // Multiple violations in one icon string — each token reported
      {
        code: '<p-button icon="fa-sharp fa-regular fa-bell text-color hover:opacity-70" />',
        errors: [
          { messageId: 'foreignToken', data: { token: 'text-color' } },
          { messageId: 'foreignToken', data: { token: 'hover:opacity-70' } },
        ],
      },
      // Bound icon — ternary with one bad branch
      {
        code: `<p-button [icon]="active ? 'fa-sharp fa-solid fa-star text-primary' : 'fa-sharp fa-regular fa-star'" />`,
        errors: [{ messageId: 'foreignToken', data: { token: 'text-primary' } }],
      },
      // Bound icon — single literal with violation
      {
        code: `<p-button [icon]="'fa-sharp fa-regular fa-bell text-muted-color'" />`,
        errors: [{ messageId: 'foreignToken', data: { token: 'text-muted-color' } }],
      },
    ],
  });
});
