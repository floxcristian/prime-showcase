// @ts-check
'use strict';

/**
 * @fileoverview Tests for showcase/no-forbidden-spacing ESLint rule.
 *
 * Run: node --test tools/eslint/rules/__tests__/no-forbidden-spacing.test.js
 */

const { describe, it } = require('node:test');
const { RuleTester } = require('eslint');
const templateParser = require('@angular-eslint/template-parser');
const rule = require('../no-forbidden-spacing');

const tester = new RuleTester({
  languageOptions: { parser: templateParser },
});

describe('no-forbidden-spacing', () => {
  // ── GAP (allowed) ──────────────────────────────────────────────────

  describe('gap — allowed values', () => {
    it('allows gap 0-6 and 8', () => {
      tester.run('gap-allowed', rule, {
        valid: [
          { code: '<div class="gap-0"></div>' },
          { code: '<div class="gap-1"></div>' },
          { code: '<div class="gap-2"></div>' },
          { code: '<div class="gap-3"></div>' },
          { code: '<div class="gap-4"></div>' },
          { code: '<div class="gap-5"></div>' },
          { code: '<div class="gap-6"></div>' },
        ],
        invalid: [],
      });
    });

    it('allows gap-x and gap-y variants', () => {
      tester.run('gap-xy', rule, {
        valid: [{ code: '<div class="gap-x-4"></div>' }, { code: '<div class="gap-y-6"></div>' }],
        invalid: [],
      });
    });

    it('allows gap exceptions from baseline', () => {
      tester.run('gap-exceptions', rule, {
        valid: [{ code: '<div class="gap-7"></div>' }, { code: '<div class="gap-8"></div>' }],
        invalid: [],
      });
    });
  });

  // ── GAP (forbidden) ────────────────────────────────────────────────

  describe('gap — forbidden values', () => {
    it('blocks forbidden gap values', () => {
      tester.run('gap-forbidden', rule, {
        valid: [],
        invalid: [
          { code: '<div class="gap-9"></div>', errors: [{ messageId: 'forbiddenSpacing' }] },
          { code: '<div class="gap-10"></div>', errors: [{ messageId: 'forbiddenSpacing' }] },
          { code: '<div class="gap-12"></div>', errors: [{ messageId: 'forbiddenSpacing' }] },
          { code: '<div class="gap-16"></div>', errors: [{ messageId: 'forbiddenSpacing' }] },
          { code: '<div class="gap-24"></div>', errors: [{ messageId: 'forbiddenSpacing' }] },
        ],
      });
    });

    it('blocks forbidden gap-x, gap-y variants', () => {
      tester.run('gap-xy-forbidden', rule, {
        valid: [],
        invalid: [
          { code: '<div class="gap-x-12"></div>', errors: [{ messageId: 'forbiddenSpacing' }] },
          { code: '<div class="gap-y-16"></div>', errors: [{ messageId: 'forbiddenSpacing' }] },
        ],
      });
    });
  });

  // ── PADDING (allowed) ──────────────────────────────────────────────

  describe('padding — allowed values', () => {
    it('allows p 1-4 and 6', () => {
      tester.run('padding-allowed', rule, {
        valid: [
          { code: '<div class="p-1"></div>' },
          { code: '<div class="p-2"></div>' },
          { code: '<div class="p-3"></div>' },
          { code: '<div class="p-4"></div>' },
          { code: '<div class="p-6"></div>' },
        ],
        invalid: [],
      });
    });

    it('allows padding directional variants', () => {
      tester.run('padding-directional', rule, {
        valid: [
          { code: '<div class="px-4 py-1"></div>' },
          { code: '<div class="px-7 py-5"></div>' },
          { code: '<div class="pt-2 pb-4"></div>' },
        ],
        invalid: [],
      });
    });

    it('allows p-5 exception from baseline', () => {
      tester.run('p5-exception', rule, {
        valid: [{ code: '<div class="p-5"></div>' }],
        invalid: [],
      });
    });

    it('allows py-8 exception from baseline', () => {
      tester.run('py8-exception', rule, {
        valid: [{ code: '<div class="py-8"></div>' }],
        invalid: [],
      });
    });
  });

  // ── PADDING (forbidden) ────────────────────────────────────────────

  describe('padding — forbidden values', () => {
    it('blocks forbidden padding values', () => {
      tester.run('padding-forbidden', rule, {
        valid: [],
        invalid: [
          { code: '<div class="p-8"></div>', errors: [{ messageId: 'forbiddenSpacing' }] },
          { code: '<div class="p-10"></div>', errors: [{ messageId: 'forbiddenSpacing' }] },
          { code: '<div class="px-16"></div>', errors: [{ messageId: 'forbiddenSpacing' }] },
          { code: '<div class="py-24"></div>', errors: [{ messageId: 'forbiddenSpacing' }] },
        ],
      });
    });
  });

  // ── MARGIN (allowed) ───────────────────────────────────────────────

  describe('margin — allowed values', () => {
    it('allows m 0, 1, 2, 4, 6', () => {
      tester.run('margin-allowed', rule, {
        valid: [
          { code: '<div class="m-0"></div>' },
          { code: '<div class="mt-1"></div>' },
          { code: '<div class="mb-2"></div>' },
          { code: '<div class="mt-4"></div>' },
          { code: '<div class="mb-6"></div>' },
        ],
        invalid: [],
      });
    });

    it('allows margin exceptions from baseline', () => {
      tester.run('margin-exceptions', rule, {
        valid: [
          { code: '<div class="mt-3"></div>' },
          { code: '<div class="mb-5"></div>' },
          { code: '<div class="mt-5"></div>' },
          { code: '<div class="mt-10"></div>' },
        ],
        invalid: [],
      });
    });
  });

  // ── MARGIN (forbidden) ─────────────────────────────────────────────

  describe('margin — forbidden values', () => {
    it('blocks forbidden margin values', () => {
      tester.run('margin-forbidden', rule, {
        valid: [],
        invalid: [
          { code: '<div class="m-3"></div>', errors: [{ messageId: 'forbiddenSpacing' }] },
          { code: '<div class="m-5"></div>', errors: [{ messageId: 'forbiddenSpacing' }] },
          { code: '<div class="mt-7"></div>', errors: [{ messageId: 'forbiddenSpacing' }] },
          { code: '<div class="mb-8"></div>', errors: [{ messageId: 'forbiddenSpacing' }] },
          { code: '<div class="mx-12"></div>', errors: [{ messageId: 'forbiddenSpacing' }] },
        ],
      });
    });
  });

  // ── ARBITRARY SPACING (forbidden) ──────────────────────────────────

  describe('arbitrary spacing', () => {
    it('blocks arbitrary gap, padding, margin', () => {
      tester.run('arbitrary-spacing', rule, {
        valid: [],
        invalid: [
          { code: '<div class="gap-[13px]"></div>', errors: [{ messageId: 'arbitrarySpacing' }] },
          { code: '<div class="p-[20px]"></div>', errors: [{ messageId: 'arbitrarySpacing' }] },
          { code: '<div class="m-[10px]"></div>', errors: [{ messageId: 'arbitrarySpacing' }] },
          { code: '<div class="mt-[2rem]"></div>', errors: [{ messageId: 'arbitrarySpacing' }] },
          { code: '<div class="px-[var(--spacing)]"></div>', errors: [{ messageId: 'arbitrarySpacing' }] },
        ],
      });
    });

    it('allows p-[1px] exception (badge alignment)', () => {
      tester.run('p1px-exception', rule, {
        valid: [{ code: '<div class="p-[1px]"></div>' }],
        invalid: [],
      });
    });
  });

  // ── COMBINED & EDGE CASES ──────────────────────────────────────────

  describe('combined classes and edge cases', () => {
    it('reports multiple spacing violations in one class string', () => {
      tester.run('multi-violations', rule, {
        valid: [],
        invalid: [
          {
            code: '<div class="gap-12 p-8 m-5"></div>',
            errors: [
              { messageId: 'forbiddenSpacing' },
              { messageId: 'forbiddenSpacing' },
              { messageId: 'forbiddenSpacing' },
            ],
          },
        ],
      });
    });

    it('does not false-positive on non-spacing classes', () => {
      tester.run('no-false-positive', rule, {
        valid: [
          // p-button, m-auto, etc. should NOT match (not numeric)
          { code: '<div class="flex-1 h-full overflow-auto"></div>' },
          { code: '<div class="w-4/12 min-w-40"></div>' },
        ],
        invalid: [],
      });
    });
  });

  // ── PrimeNG styleClass ─────────────────────────────────────────────

  describe('PrimeNG styleClass', () => {
    it('checks spacing in styleClass', () => {
      tester.run('styleClass-spacing', rule, {
        valid: [{ code: '<p-table styleClass="p-4"></p-table>' }],
        invalid: [
          {
            code: '<p-table styleClass="p-10"></p-table>',
            errors: [{ messageId: 'forbiddenSpacing' }],
          },
        ],
      });
    });
  });
});
