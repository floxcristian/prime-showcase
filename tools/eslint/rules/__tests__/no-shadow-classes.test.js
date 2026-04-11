// @ts-check
'use strict';

/**
 * @fileoverview Tests for showcase/no-shadow-classes ESLint rule.
 *
 * Run: node --test tools/eslint/rules/__tests__/no-shadow-classes.test.js
 */

const { describe, it } = require('node:test');
const { RuleTester } = require('eslint');
const templateParser = require('@angular-eslint/template-parser');
const rule = require('../no-shadow-classes');

const tester = new RuleTester({
  languageOptions: { parser: templateParser },
});

describe('no-shadow-classes', () => {
  // ── ALLOWED ────────────────────────────────────────────────────────

  describe('allows shadow resets', () => {
    it('allows shadow-none (PrimeNG reset)', () => {
      tester.run('shadow-none', rule, {
        valid: [{ code: '<div class="shadow-none"></div>' }, { code: '<div class="!shadow-none"></div>' }],
        invalid: [],
      });
    });

    it('allows elements with no shadow classes', () => {
      tester.run('no-shadows', rule, {
        valid: [
          { code: '<div class="border border-surface rounded-2xl"></div>' },
          { code: '<div class="text-color bg-surface-0"></div>' },
        ],
        invalid: [],
      });
    });
  });

  // ── BOX-SHADOW (forbidden) ─────────────────────────────────────────

  describe('blocks box-shadow utilities', () => {
    it('blocks bare shadow', () => {
      tester.run('bare-shadow', rule, {
        valid: [],
        invalid: [{ code: '<div class="shadow"></div>', errors: [{ messageId: 'noShadow' }] }],
      });
    });

    it('blocks shadow size variants', () => {
      tester.run('shadow-sizes', rule, {
        valid: [],
        invalid: [
          { code: '<div class="shadow-sm"></div>', errors: [{ messageId: 'noShadow' }] },
          { code: '<div class="shadow-md"></div>', errors: [{ messageId: 'noShadow' }] },
          { code: '<div class="shadow-lg"></div>', errors: [{ messageId: 'noShadow' }] },
          { code: '<div class="shadow-xl"></div>', errors: [{ messageId: 'noShadow' }] },
          { code: '<div class="shadow-2xl"></div>', errors: [{ messageId: 'noShadow' }] },
        ],
      });
    });

    it('blocks shadow-inner', () => {
      tester.run('shadow-inner', rule, {
        valid: [],
        invalid: [{ code: '<div class="shadow-inner"></div>', errors: [{ messageId: 'noShadow' }] }],
      });
    });

    it('blocks arbitrary shadow values', () => {
      tester.run('shadow-arbitrary', rule, {
        valid: [],
        invalid: [
          { code: '<div class="shadow-[0_4px_6px_rgba(0,0,0,0.1)]"></div>', errors: [{ messageId: 'noShadow' }] },
        ],
      });
    });
  });

  // ── DROP-SHADOW (forbidden) ────────────────────────────────────────

  describe('blocks drop-shadow utilities', () => {
    it('blocks drop-shadow variants', () => {
      tester.run('drop-shadow', rule, {
        valid: [],
        invalid: [
          { code: '<div class="drop-shadow"></div>', errors: [{ messageId: 'noShadow' }] },
          { code: '<div class="drop-shadow-md"></div>', errors: [{ messageId: 'noShadow' }] },
          { code: '<div class="drop-shadow-lg"></div>', errors: [{ messageId: 'noShadow' }] },
          { code: '<div class="drop-shadow-xl"></div>', errors: [{ messageId: 'noShadow' }] },
          { code: '<div class="drop-shadow-2xl"></div>', errors: [{ messageId: 'noShadow' }] },
        ],
      });
    });
  });

  // ── PrimeNG styleClass ─────────────────────────────────────────────

  describe('PrimeNG styleClass', () => {
    it('blocks shadows in styleClass', () => {
      tester.run('styleClass-shadow', rule, {
        valid: [{ code: '<p-select styleClass="!shadow-none"></p-select>' }],
        invalid: [
          {
            code: '<p-dialog styleClass="shadow-xl"></p-dialog>',
            errors: [{ messageId: 'noShadow' }],
          },
        ],
      });
    });
  });

  // ── BOUND ATTRIBUTES ───────────────────────────────────────────────

  describe('bound attributes', () => {
    it('checks [ngClass] object keys', () => {
      tester.run('ngClass-shadow', rule, {
        valid: [],
        invalid: [
          {
            code: `<div [ngClass]="{ 'shadow-lg': elevated }"></div>`,
            errors: [{ messageId: 'noShadow' }],
          },
        ],
      });
    });
  });
});
