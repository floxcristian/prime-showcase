// @ts-check
'use strict';

/**
 * RuleTester suite for showcase/no-icon-button-without-tooltip.
 *
 * Covers:
 *   - Valid: p-button with `label` (no tooltip required); p-button with
 *     `pTooltip`; non-p-button elements ignored.
 *   - Invalid: p-button with no label AND no pTooltip — applies to both
 *     icon attribute and content-projected icons.
 */

const test = require('node:test');
const { RuleTester } = require('eslint');
const templateParser = require('@angular-eslint/template-parser');
const rule = require('../no-icon-button-without-tooltip');

const ruleTester = new RuleTester({
  languageOptions: { parser: templateParser },
});

test('no-icon-button-without-tooltip', () => {
  ruleTester.run('no-icon-button-without-tooltip', rule, {
    valid: [
      // Has label — tooltip is redundant
      { code: '<p-button label="Save" />' },
      // Icon-only with pTooltip (canonical pattern)
      { code: '<p-button icon="fa-sharp fa-regular fa-bell" pTooltip="Notifications" ariaLabel="Notifications" />' },
      // Content-projected with pTooltip
      { code: '<p-button pTooltip="Refresh"><i class="fa-sharp fa-regular fa-arrows-rotate"></i></p-button>' },
      // Non-p-button elements are out of scope
      { code: '<button class="rounded-lg"><i class="fa-sharp fa-regular fa-bell"></i></button>' },
      // Bound label still counts as a label
      { code: '<p-button [label]="dynamicLabel" />' },
      // Bound pTooltip
      { code: '<p-button icon="fa-sharp fa-regular fa-bell" [pTooltip]="hint" ariaLabel="Action" />' },
    ],

    invalid: [
      // Icon attribute, no label, no pTooltip
      {
        code: '<p-button icon="fa-sharp fa-regular fa-bell" />',
        errors: [{ messageId: 'missingTooltip' }],
      },
      // Content-projected icon, no tooltip
      {
        code: '<p-button><i class="fa-sharp fa-regular fa-bell"></i></p-button>',
        errors: [{ messageId: 'missingTooltip' }],
      },
      // Has ariaLabel but missing pTooltip (mouse users still need affordance)
      {
        code: '<p-button icon="fa-sharp fa-regular fa-bell" ariaLabel="Notifications" />',
        errors: [{ messageId: 'missingTooltip' }],
      },
      // Severity / variant attributes don't substitute for tooltip
      {
        code: '<p-button icon="fa-sharp fa-regular fa-bell" severity="secondary" text rounded />',
        errors: [{ messageId: 'missingTooltip' }],
      },
    ],
  });
});
