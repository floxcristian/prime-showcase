// @ts-check
'use strict';

/**
 * RuleTester suite for showcase/label-requires-semibold.
 *
 * The rule has two branches by role:
 *   - Input labels (above the control)      → require font-semibold
 *   - Checkbox/radio labels (beside control) → require font-normal (and
 *                                                forbid heavier weights)
 *
 * Detection of checkbox/radio role:
 *   Case A: <label> wraps a <p-checkbox>, <p-radiobutton>, or
 *           <input type="checkbox|radio"> as descendant.
 *   Case B: <label> is a sibling of one of those controls in the same parent.
 */

const test = require('node:test');
const { RuleTester } = require('eslint');
const templateParser = require('@angular-eslint/template-parser');
const rule = require('../label-requires-semibold');

const ruleTester = new RuleTester({
  languageOptions: { parser: templateParser },
});

test('label-requires-semibold', () => {
  ruleTester.run('label-requires-semibold', rule, {
    valid: [
      // ─── Input labels: require font-semibold ──────────────────────────
      {
        code: '<label for="email" class="text-color font-semibold leading-6">Email</label>',
      },
      {
        code: `<label for="x" [class]="'font-semibold text-color'">X</label>`,
      },
      {
        code: `<label for="x" [ngClass]="{ 'font-semibold': true }">X</label>`,
      },

      // ─── Checkbox/radio labels: require font-normal ───────────────────
      // Case A: label wraps <p-checkbox>
      {
        code: '<label for="remember" class="font-normal"><p-checkbox inputId="remember" />Remember me</label>',
      },
      // Case A: label wraps <p-radiobutton>
      {
        code: '<label [for]="k" class="font-normal cursor-pointer"><p-radiobutton /><span>Yes</span></label>',
      },
      // Case A: label wraps native <input type="checkbox">
      {
        code: '<label for="t" class="font-normal"><input type="checkbox" id="t" />Terms</label>',
      },
      // Case A: label wraps native <input type="radio">
      {
        code: '<label for="r" class="font-normal"><input type="radio" id="r" />Option A</label>',
      },
      // Case B: label sibling of <p-checkbox> in the same parent
      {
        code: '<div><p-checkbox inputId="x" /><label for="x" class="font-normal">X</label></div>',
      },
      // Case B: label sibling of <p-radiobutton>
      {
        code: '<div><p-radiobutton inputId="y" /><label for="y" class="font-normal">Y</label></div>',
      },
      // font-normal via [ngClass] object key
      {
        code: `<div><p-checkbox inputId="z" /><label for="z" [ngClass]="{ 'font-normal': true }">Z</label></div>`,
      },

      // ─── Non-label elements are ignored ───────────────────────────────
      { code: '<span class="font-medium">Not a label</span>' },
      { code: '<div>plain div</div>' },
    ],

    invalid: [
      // ─── Input labels missing font-semibold ───────────────────────────
      {
        code: '<label for="email" class="text-color font-medium leading-6">Email</label>',
        errors: [{ messageId: 'missingSemibold' }],
      },
      {
        code: '<label for="x" class="ml-2">Inline</label>',
        errors: [{ messageId: 'missingSemibold' }],
      },
      {
        code: '<label for="x">Sin clases</label>',
        errors: [{ messageId: 'missingSemibold' }],
      },
      {
        code: `<label [for]="key" [ngClass]="cond ? 'font-medium' : 'text-color'">X</label>`,
        errors: [{ messageId: 'missingSemibold' }],
      },

      // ─── Checkbox/radio labels missing font-normal (Case A: wrap) ─────
      {
        code: '<label for="remember" class="ml-2"><p-checkbox inputId="remember" />Remember me</label>',
        errors: [{ messageId: 'missingNormal' }],
      },
      {
        code: '<label for="t"><input type="checkbox" id="t" />Terms</label>',
        errors: [{ messageId: 'missingNormal' }],
      },
      // Heavier weight (font-semibold) on a checkbox wrapper — also fails
      {
        code: '<label for="remember" class="font-semibold"><p-checkbox inputId="remember" />Remember</label>',
        errors: [{ messageId: 'missingNormal' }],
      },

      // ─── Checkbox/radio labels missing font-normal (Case B: sibling) ──
      {
        code: '<div><p-checkbox inputId="x" /><label for="x" class="ml-2">X</label></div>',
        errors: [{ messageId: 'missingNormal' }],
      },
      // Heavier weight on sibling label — should suggest font-normal
      {
        code: '<div><p-radiobutton inputId="y" /><label for="y" class="font-semibold">Y</label></div>',
        errors: [{ messageId: 'missingNormal' }],
      },
      // Native radio sibling + label without font-normal
      {
        code: '<div><input type="radio" id="r" /><label for="r" class="font-medium">Opt</label></div>',
        errors: [{ messageId: 'missingNormal' }],
      },
    ],
  });
});
