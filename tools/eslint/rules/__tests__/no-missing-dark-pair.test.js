// @ts-check
'use strict';

/**
 * @fileoverview Tests for showcase/no-missing-dark-pair ESLint rule.
 *
 * Run: node --test tools/eslint/rules/__tests__/no-missing-dark-pair.test.js
 */

const { describe, it } = require('node:test');
const { RuleTester } = require('eslint');
const templateParser = require('@angular-eslint/template-parser');
const rule = require('../no-missing-dark-pair');

const tester = new RuleTester({
  languageOptions: { parser: templateParser },
});

describe('no-missing-dark-pair', () => {
  // ── VALID PAIRS ────────────────────────────────────────────────────

  describe('allows correctly paired surfaces', () => {
    it('allows bg-surface-0 with dark:bg-surface-950', () => {
      tester.run('pair-0-950', rule, {
        valid: [{ code: '<div class="bg-surface-0 dark:bg-surface-950"></div>' }],
        invalid: [],
      });
    });

    it('allows bg-surface-0 with dark:bg-surface-900 (alternative)', () => {
      tester.run('pair-0-900', rule, {
        valid: [{ code: '<div class="bg-surface-0 dark:bg-surface-900"></div>' }],
        invalid: [],
      });
    });

    it('allows bg-surface-50 with dark:bg-surface-950', () => {
      tester.run('pair-50-950', rule, {
        valid: [{ code: '<div class="bg-surface-50 dark:bg-surface-950"></div>' }],
        invalid: [],
      });
    });

    it('allows bg-surface-100 with dark:bg-surface-800', () => {
      tester.run('pair-100-800', rule, {
        valid: [{ code: '<div class="bg-surface-100 dark:bg-surface-800"></div>' }],
        invalid: [],
      });
    });

    it('allows bg-surface-200 with dark:bg-surface-700', () => {
      tester.run('pair-200-700', rule, {
        valid: [{ code: '<div class="bg-surface-200 dark:bg-surface-700"></div>' }],
        invalid: [],
      });
    });

    it('allows bg-surface-200 with dark:bg-surface-800 (alternative)', () => {
      tester.run('pair-200-800', rule, {
        valid: [{ code: '<div class="bg-surface-200 dark:bg-surface-800"></div>' }],
        invalid: [],
      });
    });
  });

  // ── DARK-ONLY SURFACES (no pair needed) ────────────────────────────

  describe('allows dark-only surfaces without pair', () => {
    it('allows bg-surface-900 standalone', () => {
      tester.run('dark-only-900', rule, {
        valid: [{ code: '<div class="bg-surface-900"></div>' }],
        invalid: [],
      });
    });

    it('allows bg-surface-950 standalone', () => {
      tester.run('dark-only-950', rule, {
        valid: [{ code: '<div class="bg-surface-950"></div>' }],
        invalid: [],
      });
    });
  });

  // ── NO SURFACES (nothing to check) ────────────────────────────────

  describe('allows elements without surface classes', () => {
    it('passes when no bg-surface-* is used', () => {
      tester.run('no-surfaces', rule, {
        valid: [
          { code: '<div class="bg-primary text-color p-4"></div>' },
          { code: '<div class="bg-emphasis rounded-lg"></div>' },
        ],
        invalid: [],
      });
    });
  });

  // ── MISSING DARK PAIR (forbidden) ──────────────────────────────────

  describe('blocks surfaces without dark pair', () => {
    it('blocks bg-surface-0 without dark pair', () => {
      tester.run('missing-0', rule, {
        valid: [],
        invalid: [{ code: '<div class="bg-surface-0"></div>', errors: [{ messageId: 'missingDarkPair' }] }],
      });
    });

    it('blocks bg-surface-50 without dark pair', () => {
      tester.run('missing-50', rule, {
        valid: [],
        invalid: [{ code: '<div class="bg-surface-50"></div>', errors: [{ messageId: 'missingDarkPair' }] }],
      });
    });

    it('blocks bg-surface-100 without dark pair', () => {
      tester.run('missing-100', rule, {
        valid: [],
        invalid: [{ code: '<div class="bg-surface-100"></div>', errors: [{ messageId: 'missingDarkPair' }] }],
      });
    });

    it('blocks bg-surface-200 without dark pair', () => {
      tester.run('missing-200', rule, {
        valid: [],
        invalid: [{ code: '<div class="bg-surface-200"></div>', errors: [{ messageId: 'missingDarkPair' }] }],
      });
    });
  });

  // ── WRONG DARK PAIR (forbidden) ────────────────────────────────────

  describe('blocks wrong dark pair combinations', () => {
    it('blocks bg-surface-0 with dark:bg-surface-700 (wrong shade)', () => {
      tester.run('wrong-0-700', rule, {
        valid: [],
        invalid: [
          {
            code: '<div class="bg-surface-0 dark:bg-surface-700"></div>',
            errors: [{ messageId: 'wrongDarkPair' }],
          },
        ],
      });
    });

    it('blocks bg-surface-100 with dark:bg-surface-950 (wrong shade)', () => {
      tester.run('wrong-100-950', rule, {
        valid: [],
        invalid: [
          {
            code: '<div class="bg-surface-100 dark:bg-surface-950"></div>',
            errors: [{ messageId: 'wrongDarkPair' }],
          },
        ],
      });
    });
  });

  // ── VARIANT PREFIXES ───────────────────────────────────────────────

  describe('handles variant prefixes', () => {
    it('allows paired surfaces with variant prefixes', () => {
      tester.run('variant-prefixes', rule, {
        valid: [
          { code: '<div class="active:bg-surface-200 dark:active:bg-surface-700"></div>' },
          { code: '<div class="hover:bg-surface-100 dark:hover:bg-surface-800"></div>' },
        ],
        invalid: [],
      });
    });
  });

  // ── PrimeNG styleClass ─────────────────────────────────────────────

  describe('PrimeNG styleClass', () => {
    it('checks dark pairs in styleClass', () => {
      tester.run('styleClass-dark', rule, {
        valid: [{ code: '<p-dialog styleClass="bg-surface-0 dark:bg-surface-950"></p-dialog>' }],
        invalid: [
          {
            code: '<p-dialog styleClass="bg-surface-0"></p-dialog>',
            errors: [{ messageId: 'missingDarkPair' }],
          },
        ],
      });
    });
  });

  // ── BOUND ATTRIBUTES ───────────────────────────────────────────────

  describe('bound attributes', () => {
    it('checks [ngClass] object keys', () => {
      tester.run('ngClass-dark', rule, {
        valid: [{ code: `<div [ngClass]="{ 'bg-surface-0 dark:bg-surface-950': true }"></div>` }],
        invalid: [
          {
            code: `<div [ngClass]="{ 'bg-surface-100': active }"></div>`,
            errors: [{ messageId: 'missingDarkPair' }],
          },
        ],
      });
    });
  });
});
