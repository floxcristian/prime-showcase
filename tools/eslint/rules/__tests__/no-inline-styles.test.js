// @ts-check
'use strict';

/**
 * @fileoverview Tests for showcase/no-inline-styles ESLint rule.
 *
 * Run: node --test tools/eslint/rules/__tests__/no-inline-styles.test.js
 */

const { describe, it } = require('node:test');
const { RuleTester } = require('eslint');
const templateParser = require('@angular-eslint/template-parser');
const rule = require('../no-inline-styles');

const tester = new RuleTester({
  languageOptions: { parser: templateParser },
});

describe('no-inline-styles', () => {
  // ── ALLOWED (no inline styles) ─────────────────────────────────────

  describe('allows elements without inline styles', () => {
    it('allows Tailwind classes', () => {
      tester.run('tailwind-classes', rule, {
        valid: [
          { code: '<div class="text-color bg-surface-0 p-6"></div>' },
          { code: '<div class="flex items-center gap-2"></div>' },
        ],
        invalid: [],
      });
    });

    it('allows dynamic style bindings', () => {
      tester.run('dynamic-styles', rule, {
        valid: [
          { code: '<div [style.backgroundColor]="item.color"></div>' },
          { code: '<div [style.width.px]="progress"></div>' },
          { code: '<div [ngStyle]="{ backgroundColor: chart.color }"></div>' },
        ],
        invalid: [],
      });
    });
  });

  // ── FORBIDDEN (static inline styles) ──────────────────────────────

  describe('blocks static inline styles', () => {
    it('blocks simple inline styles', () => {
      tester.run('simple-inline', rule, {
        valid: [],
        invalid: [
          { code: '<div style="color: red"></div>', errors: [{ messageId: 'noInlineStyle' }] },
          { code: '<div style="padding: 10px"></div>', errors: [{ messageId: 'noInlineStyle' }] },
          { code: '<div style="margin: 0 auto"></div>', errors: [{ messageId: 'noInlineStyle' }] },
        ],
      });
    });

    it('blocks complex inline styles', () => {
      tester.run('complex-inline', rule, {
        valid: [],
        invalid: [
          {
            code: '<div style="background-color: #fff; border-radius: 8px; padding: 16px"></div>',
            errors: [{ messageId: 'noInlineStyle' }],
          },
        ],
      });
    });

    it('blocks inline styles on PrimeNG components', () => {
      tester.run('primeng-inline', rule, {
        valid: [],
        invalid: [{ code: '<p-button style="width: 100%"></p-button>', errors: [{ messageId: 'noInlineStyle' }] }],
      });
    });
  });
});
