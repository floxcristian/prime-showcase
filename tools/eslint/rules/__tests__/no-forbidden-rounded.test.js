// @ts-check
'use strict';

/**
 * @fileoverview Tests for showcase/no-forbidden-rounded ESLint rule.
 *
 * Run: node --test tools/eslint/rules/__tests__/no-forbidden-rounded.test.js
 */

const { describe, it } = require('node:test');
const { RuleTester } = require('eslint');
const templateParser = require('@angular-eslint/template-parser');
const rule = require('../no-forbidden-rounded');

const tester = new RuleTester({
  languageOptions: { parser: templateParser },
});

describe('no-forbidden-rounded', () => {
  // ── ALLOWED VALUES ─────────────────────────────────────────────────

  describe('allows approved border-radius scale', () => {
    it('allows all approved values', () => {
      tester.run('allowed-rounded', rule, {
        valid: [
          { code: '<div class="rounded-full"></div>' },
          { code: '<div class="rounded-lg"></div>' },
          { code: '<div class="rounded-xl"></div>' },
          { code: '<div class="rounded-2xl"></div>' },
          { code: '<div class="rounded-3xl"></div>' },
          { code: '<div class="rounded-border"></div>' },
        ],
        invalid: [],
      });
    });

    it('allows directional variants', () => {
      tester.run('directional-rounded', rule, {
        valid: [
          { code: '<div class="rounded-t-lg"></div>' },
          { code: '<div class="rounded-b-xl"></div>' },
          { code: '<div class="rounded-tl-2xl"></div>' },
          { code: '<div class="rounded-br-lg"></div>' },
          { code: '<div class="rounded-l-3xl"></div>' },
          { code: '<div class="rounded-r-full"></div>' },
          // Logical directions (RTL-aware)
          { code: '<div class="rounded-s-lg"></div>' },
          { code: '<div class="rounded-e-xl"></div>' },
          { code: '<div class="rounded-ss-lg"></div>' },
          { code: '<div class="rounded-se-xl"></div>' },
          { code: '<div class="rounded-es-lg"></div>' },
          { code: '<div class="rounded-ee-xl"></div>' },
        ],
        invalid: [],
      });
    });

    it('allows elements with no rounded classes', () => {
      tester.run('no-rounded', rule, {
        valid: [{ code: '<div class="border border-surface p-6"></div>' }],
        invalid: [],
      });
    });
  });

  // ── FORBIDDEN VALUES ───────────────────────────────────────────────

  describe('blocks forbidden border-radius values', () => {
    it('blocks bare rounded', () => {
      tester.run('bare-rounded', rule, {
        valid: [],
        invalid: [{ code: '<div class="rounded"></div>', errors: [{ messageId: 'noForbiddenRounded' }] }],
      });
    });

    it('blocks rounded-sm and rounded-md', () => {
      tester.run('small-rounded', rule, {
        valid: [],
        invalid: [
          { code: '<div class="rounded-sm"></div>', errors: [{ messageId: 'noForbiddenRounded' }] },
          { code: '<div class="rounded-md"></div>', errors: [{ messageId: 'noForbiddenRounded' }] },
        ],
      });
    });

    it('blocks rounded-none', () => {
      tester.run('rounded-none', rule, {
        valid: [],
        invalid: [{ code: '<div class="rounded-none"></div>', errors: [{ messageId: 'noForbiddenRounded' }] }],
      });
    });

    it('blocks arbitrary rounded values', () => {
      tester.run('arbitrary-rounded', rule, {
        valid: [],
        invalid: [
          { code: '<div class="rounded-[5px]"></div>', errors: [{ messageId: 'noForbiddenRounded' }] },
          { code: '<div class="rounded-[0.5rem]"></div>', errors: [{ messageId: 'noForbiddenRounded' }] },
          { code: '<div class="rounded-[50%]"></div>', errors: [{ messageId: 'noForbiddenRounded' }] },
        ],
      });
    });
  });

  // ── PrimeNG styleClass ─────────────────────────────────────────────

  describe('PrimeNG styleClass', () => {
    it('validates rounded in styleClass', () => {
      tester.run('styleClass-rounded', rule, {
        valid: [{ code: '<p-avatar styleClass="rounded-full"></p-avatar>' }],
        invalid: [
          {
            code: '<p-avatar styleClass="rounded-md"></p-avatar>',
            errors: [{ messageId: 'noForbiddenRounded' }],
          },
        ],
      });
    });
  });

  // ── BOUND ATTRIBUTES ───────────────────────────────────────────────

  describe('bound attributes', () => {
    it('checks [ngClass] object keys', () => {
      tester.run('ngClass-rounded', rule, {
        valid: [{ code: `<div [ngClass]="{ 'rounded-lg': true }"></div>` }],
        invalid: [
          {
            code: `<div [ngClass]="{ 'rounded-sm': small }"></div>`,
            errors: [{ messageId: 'noForbiddenRounded' }],
          },
        ],
      });
    });
  });

  // ── COMBINED CLASSES ───────────────────────────────────────────────

  describe('combined with other classes', () => {
    it('reports rounded violations within longer class strings', () => {
      tester.run('combined', rule, {
        valid: [{ code: '<div class="border border-surface rounded-2xl p-6"></div>' }],
        invalid: [
          {
            code: '<div class="border border-surface rounded-md p-6"></div>',
            errors: [{ messageId: 'noForbiddenRounded' }],
          },
        ],
      });
    });
  });
});
