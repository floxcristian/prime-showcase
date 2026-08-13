// @ts-check
'use strict';

/**
 * RuleTester suite for showcase/no-icon-button-without-tooltip.
 *
 * Covers:
 *   - Valid: p-button with `label` (no tooltip required); p-button with
 *     `pTooltip`; p-button with projected TEXT content (visible label →
 *     not icon-only); <button pButton> with label/text/tooltip; plain
 *     elements ignored.
 *   - Invalid: p-button OR <button pButton> with no label, no projected
 *     text, and no pTooltip — applies to both icon attribute and
 *     content-projected icons.
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
      // Plain <button> without pButton is out of scope
      { code: '<button class="rounded-lg"><i class="fa-sharp fa-regular fa-bell"></i></button>' },
      // Bound label still counts as a label
      { code: '<p-button [label]="dynamicLabel" />' },
      // Bound pTooltip
      { code: '<p-button icon="fa-sharp fa-regular fa-bell" [pTooltip]="hint" ariaLabel="Action" />' },
      // Projected TEXT content — renders a visible label, NOT icon-only.
      // Previously a false positive (treated like a projected icon).
      { code: '<p-button icon="fa-sharp fa-regular fa-download">Descargar</p-button>' },
      { code: '<p-button>{{ ctaLabel() }}</p-button>' },
      // <button pButton> with visible label (attr or projected text)
      { code: '<button pButton type="button" label="Guardar"></button>' },
      { code: '<button pButton type="button" icon="fa-sharp fa-regular fa-download">Descargar</button>' },
      // <button pButton> icon-only WITH tooltip
      { code: '<button pButton type="button" icon="fa-sharp fa-regular fa-bell" pTooltip="Notificaciones" aria-label="Notificaciones"></button>' },
      // <button pButton> icon-only wrapped by a pTooltip ancestor
      { code: '<span pTooltip="Refrescar"><button pButton type="button" icon="fa-sharp fa-regular fa-arrows-rotate"></button></span>' },
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
      // <button pButton> icon-only without tooltip — previously a false
      // negative (the rule only matched <p-button>)
      {
        code: '<button pButton type="button" icon="fa-sharp fa-regular fa-bell"></button>',
        errors: [{ messageId: 'missingTooltip' }],
      },
      // <button pButton> with only a projected icon (no text) — still icon-only
      {
        code: '<button pButton type="button"><i class="fa-sharp fa-regular fa-bell"></i></button>',
        errors: [{ messageId: 'missingTooltip' }],
      },
      // aria-label alone doesn't help mouse users
      {
        code: '<button pButton type="button" icon="fa-sharp fa-regular fa-bell" aria-label="Notificaciones"></button>',
        errors: [{ messageId: 'missingTooltip' }],
      },
    ],
  });
});
