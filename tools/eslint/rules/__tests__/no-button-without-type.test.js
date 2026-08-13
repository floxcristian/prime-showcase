// @ts-check
'use strict';

/**
 * RuleTester suite for showcase/no-button-without-type.
 *
 * Covers:
 *   - Valid: type="button"/"submit"/"reset", [attr.type], <button pButton> WITH
 *     explicit type, <p-button> (not a native button)
 *   - Invalid: plain <button> with no type, <button pButton> without type
 *     (ButtonDirective has NO host binding for `type` — only the p-button
 *     component emits type="button" on its inner button)
 *   - Non-button elements ignored
 */

const test = require('node:test');
const { RuleTester } = require('eslint');
const templateParser = require('@angular-eslint/template-parser');
const rule = require('../no-button-without-type');

const ruleTester = new RuleTester({
  languageOptions: { parser: templateParser },
});

test('no-button-without-type', () => {
  ruleTester.run('no-button-without-type', rule, {
    valid: [
      { code: '<button type="button">OK</button>' },
      { code: '<button type="submit">Save</button>' },
      { code: '<button type="reset">Reset</button>' },
      // Angular attribute binding form
      { code: `<button [attr.type]="isSubmit ? 'submit' : 'button'">X</button>` },
      // pButton directive with explicit type — the directive does NOT emit
      // type="button", so the author must declare it.
      { code: '<button pButton type="button" label="OK"></button>' },
      { code: '<button pButton type="submit" label="Save"></button>' },
      // <p-button> component is not <button> (its inner button gets
      // type="button" from the component template)
      { code: '<p-button label="Download" />' },
      // Non-button tags ignored
      { code: '<div (click)="x()"></div>' },
      { code: '<a href="/">link</a>' },
    ],

    invalid: [
      {
        code: '<button (click)="action()">…</button>',
        errors: [{ messageId: 'missingType' }],
      },
      {
        code: '<button class="flex"></button>',
        errors: [{ messageId: 'missingType' }],
      },
      {
        code: '<button [attr.aria-label]="\'Close\'">×</button>',
        errors: [{ messageId: 'missingType' }],
      },
      // No attributes at all
      {
        code: '<button>Click</button>',
        errors: [{ messageId: 'missingType' }],
      },
      // pButton without type — NOT exempt: ButtonDirective has no host
      // binding for `type`, so this still submits forms by default.
      {
        code: '<button pButton label="OK"></button>',
        errors: [{ messageId: 'missingType' }],
      },
      {
        code: '<button pButton icon="fa-sharp fa-regular fa-x"></button>',
        errors: [{ messageId: 'missingType' }],
      },
      // Two offending buttons → two errors
      {
        code: '<button>A</button><button>B</button>',
        errors: [
          { messageId: 'missingType' },
          { messageId: 'missingType' },
        ],
      },
    ],
  });
});
