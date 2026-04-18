// @ts-check
'use strict';

/**
 * RuleTester suite for showcase/no-button-without-type.
 *
 * Covers:
 *   - Valid: type="button"/"submit"/"reset", [attr.type], pButton exempt, p-button exempt
 *   - Invalid: plain <button> with no type
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
      // pButton directive exemption
      { code: '<button pButton label="OK"></button>' },
      { code: '<button pButton icon="fa-sharp fa-regular fa-x"></button>' },
      // <p-button> component is not <button>
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
