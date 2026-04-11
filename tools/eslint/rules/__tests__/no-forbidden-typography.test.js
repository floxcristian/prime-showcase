// @ts-check
'use strict';

/**
 * @fileoverview Tests for showcase/no-forbidden-typography ESLint rule.
 *
 * Run: node --test tools/eslint/rules/__tests__/no-forbidden-typography.test.js
 *
 * Uses ESLint's RuleTester with @angular-eslint/template-parser to simulate
 * real Angular template linting. Each test case is a minimal HTML snippet.
 */

const { describe, it } = require('node:test');
const { RuleTester } = require('eslint');
const templateParser = require('@angular-eslint/template-parser');
const rule = require('../no-forbidden-typography');

const tester = new RuleTester({
  languageOptions: { parser: templateParser },
});

// ── Helpers ────────────────────────────────────────────────────────────
// RuleTester.run() throws on the first failure, which is all we need.
// We wrap each group in a describe/it for structured output with `--test`.

describe('no-forbidden-typography', () => {
  // ── TEXT SIZES ─────────────────────────────────────────────────────

  describe('text sizes', () => {
    it('allows all approved text sizes', () => {
      tester.run('text-size-allowed', rule, {
        valid: [
          { code: '<div class="text-xs"></div>' },
          { code: '<div class="text-sm"></div>' },
          { code: '<div class="text-base"></div>' },
          { code: '<div class="text-lg"></div>' },
          { code: '<div class="text-xl"></div>' },
          { code: '<div class="text-2xl"></div>' },
          { code: '<div class="text-3xl"></div>' },
        ],
        invalid: [],
      });
    });

    it('allows text-4xl exception (icons/stats)', () => {
      tester.run('text-4xl-exception', rule, {
        valid: [
          { code: '<div class="text-4xl"></div>' },
        ],
        invalid: [],
      });
    });

    it('blocks forbidden named text sizes (5xl–9xl)', () => {
      tester.run('text-size-forbidden-named', rule, {
        valid: [],
        invalid: [
          { code: '<div class="text-5xl"></div>', errors: [{ messageId: 'forbiddenTextSize' }] },
          { code: '<div class="text-6xl"></div>', errors: [{ messageId: 'forbiddenTextSize' }] },
          { code: '<div class="text-7xl"></div>', errors: [{ messageId: 'forbiddenTextSize' }] },
          { code: '<div class="text-8xl"></div>', errors: [{ messageId: 'forbiddenTextSize' }] },
          { code: '<div class="text-9xl"></div>', errors: [{ messageId: 'forbiddenTextSize' }] },
        ],
      });
    });

    it('blocks arbitrary text sizes with simple values', () => {
      tester.run('text-size-arbitrary-simple', rule, {
        valid: [],
        invalid: [
          { code: '<div class="text-[18px]"></div>', errors: [{ messageId: 'forbiddenTextSize' }] },
          { code: '<div class="text-[20px]"></div>', errors: [{ messageId: 'forbiddenTextSize' }] },
          { code: '<div class="text-[14pt]"></div>', errors: [{ messageId: 'forbiddenTextSize' }] },
        ],
      });
    });

    it('blocks arbitrary text sizes with dots (e.g. 1.5rem)', () => {
      tester.run('text-size-arbitrary-dots', rule, {
        valid: [],
        invalid: [
          { code: '<div class="text-[1.5rem]"></div>', errors: [{ messageId: 'forbiddenTextSize' }] },
          { code: '<div class="text-[0.875rem]"></div>', errors: [{ messageId: 'forbiddenTextSize' }] },
          { code: '<div class="text-[2.25em]"></div>', errors: [{ messageId: 'forbiddenTextSize' }] },
        ],
      });
    });

    it('blocks arbitrary text sizes with CSS functions', () => {
      tester.run('text-size-arbitrary-functions', rule, {
        valid: [],
        invalid: [
          { code: '<div class="text-[calc(1rem+2px)]"></div>', errors: [{ messageId: 'forbiddenTextSize' }] },
          { code: '<div class="text-[var(--custom-size)]"></div>', errors: [{ messageId: 'forbiddenTextSize' }] },
          { code: '<div class="text-[clamp(1rem,2vw,3rem)]"></div>', errors: [{ messageId: 'forbiddenTextSize' }] },
        ],
      });
    });

    it('does not match non-typography text- classes', () => {
      tester.run('text-non-typography', rule, {
        valid: [
          { code: '<div class="text-color"></div>' },
          { code: '<div class="text-muted-color"></div>' },
          { code: '<div class="text-primary"></div>' },
          { code: '<div class="text-primary-contrast"></div>' },
          { code: '<div class="text-left"></div>' },
          { code: '<div class="text-center"></div>' },
          { code: '<div class="text-right"></div>' },
          { code: '<div class="text-wrap"></div>' },
          { code: '<div class="text-ellipsis"></div>' },
          { code: '<div class="text-surface-0"></div>' },
        ],
        invalid: [],
      });
    });

    it('does not partially match text sizes inside longer words', () => {
      tester.run('text-size-no-partial', rule, {
        valid: [
          // text-xlarge should NOT match text-xl ((?!\w) prevents it)
          { code: '<div class="text-xlarge"></div>' },
        ],
        invalid: [],
      });
    });
  });

  // ── LINE HEIGHT (LEADING) ──────────────────────────────────────────

  describe('leading (line-height)', () => {
    it('allows all approved leading values', () => {
      tester.run('leading-allowed', rule, {
        valid: [
          { code: '<div class="leading-4"></div>' },
          { code: '<div class="leading-5"></div>' },
          { code: '<div class="leading-6"></div>' },
          { code: '<div class="leading-7"></div>' },
          { code: '<div class="leading-8"></div>' },
          { code: '<div class="leading-normal"></div>' },
          { code: '<div class="leading-none"></div>' },
          { code: '<div class="leading-tight"></div>' },
        ],
        invalid: [],
      });
    });

    it('blocks forbidden named leading values', () => {
      tester.run('leading-forbidden-named', rule, {
        valid: [],
        invalid: [
          { code: '<div class="leading-snug"></div>', errors: [{ messageId: 'forbiddenLeading' }] },
          { code: '<div class="leading-relaxed"></div>', errors: [{ messageId: 'forbiddenLeading' }] },
          { code: '<div class="leading-loose"></div>', errors: [{ messageId: 'forbiddenLeading' }] },
        ],
      });
    });

    it('blocks forbidden numeric leading values', () => {
      tester.run('leading-forbidden-numeric', rule, {
        valid: [],
        invalid: [
          { code: '<div class="leading-3"></div>', errors: [{ messageId: 'forbiddenLeading' }] },
          { code: '<div class="leading-9"></div>', errors: [{ messageId: 'forbiddenLeading' }] },
          { code: '<div class="leading-10"></div>', errors: [{ messageId: 'forbiddenLeading' }] },
        ],
      });
    });

    it('blocks arbitrary leading values', () => {
      tester.run('leading-arbitrary', rule, {
        valid: [],
        invalid: [
          { code: '<div class="leading-[1.5]"></div>', errors: [{ messageId: 'forbiddenLeading' }] },
          { code: '<div class="leading-[24px]"></div>', errors: [{ messageId: 'forbiddenLeading' }] },
          { code: '<div class="leading-[calc(1em+2px)]"></div>', errors: [{ messageId: 'forbiddenLeading' }] },
          { code: '<div class="leading-[var(--lh)]"></div>', errors: [{ messageId: 'forbiddenLeading' }] },
        ],
      });
    });
  });

  // ── FONT WEIGHT ────────────────────────────────────────────────────

  describe('font-weight', () => {
    it('allows all approved font weights', () => {
      tester.run('font-weight-allowed', rule, {
        valid: [
          { code: '<div class="font-normal"></div>' },
          { code: '<div class="font-medium"></div>' },
          { code: '<div class="font-semibold"></div>' },
        ],
        invalid: [],
      });
    });

    it('blocks forbidden named font weights', () => {
      tester.run('font-weight-forbidden-named', rule, {
        valid: [],
        invalid: [
          { code: '<div class="font-thin"></div>', errors: [{ messageId: 'forbiddenFontWeight' }] },
          { code: '<div class="font-extralight"></div>', errors: [{ messageId: 'forbiddenFontWeight' }] },
          { code: '<div class="font-light"></div>', errors: [{ messageId: 'forbiddenFontWeight' }] },
          { code: '<div class="font-bold"></div>', errors: [{ messageId: 'forbiddenFontWeight' }] },
          { code: '<div class="font-extrabold"></div>', errors: [{ messageId: 'forbiddenFontWeight' }] },
          { code: '<div class="font-black"></div>', errors: [{ messageId: 'forbiddenFontWeight' }] },
        ],
      });
    });

    it('blocks arbitrary font weights', () => {
      tester.run('font-weight-arbitrary', rule, {
        valid: [],
        invalid: [
          { code: '<div class="font-[800]"></div>', errors: [{ messageId: 'forbiddenFontWeight' }] },
          { code: '<div class="font-[900]"></div>', errors: [{ messageId: 'forbiddenFontWeight' }] },
          { code: '<div class="font-[var(--fw)]"></div>', errors: [{ messageId: 'forbiddenFontWeight' }] },
        ],
      });
    });

    it('does not match non-weight font- classes', () => {
      tester.run('font-non-weight', rule, {
        valid: [
          { code: '<div class="font-sans"></div>' },
          { code: '<div class="font-mono"></div>' },
          { code: '<div class="font-serif"></div>' },
        ],
        invalid: [],
      });
    });
  });

  // ── COMBINED CLASSES ───────────────────────────────────────────────

  describe('combined classes', () => {
    it('allows valid combinations', () => {
      tester.run('combined-valid', rule, {
        valid: [
          { code: '<div class="text-sm font-medium leading-5"></div>' },
          { code: '<div class="text-3xl font-semibold leading-normal"></div>' },
          { code: '<div class="text-xs font-medium leading-4"></div>' },
          { code: '<div class="text-color text-sm font-medium leading-5"></div>' },
        ],
        invalid: [],
      });
    });

    it('reports multiple violations in a single class string', () => {
      tester.run('combined-multiple-violations', rule, {
        valid: [],
        invalid: [
          {
            code: '<div class="text-5xl font-bold leading-relaxed"></div>',
            errors: [
              { messageId: 'forbiddenTextSize' },
              { messageId: 'forbiddenLeading' },
              { messageId: 'forbiddenFontWeight' },
            ],
          },
          {
            code: '<div class="text-[18px] leading-[1.5] font-[800]"></div>',
            errors: [
              { messageId: 'forbiddenTextSize' },
              { messageId: 'forbiddenLeading' },
              { messageId: 'forbiddenFontWeight' },
            ],
          },
        ],
      });
    });
  });

  // ── PRIMENG styleClass ATTRIBUTE ───────────────────────────────────

  describe('PrimeNG styleClass', () => {
    it('checks styleClass attribute', () => {
      tester.run('styleClass', rule, {
        valid: [
          { code: '<p-tag styleClass="font-medium"></p-tag>' },
        ],
        invalid: [
          {
            code: '<p-tag styleClass="font-bold"></p-tag>',
            errors: [{ messageId: 'forbiddenFontWeight' }],
          },
        ],
      });
    });
  });

  // ── ANGULAR BOUND ATTRIBUTES ───────────────────────────────────────

  describe('bound attributes ([ngClass], [class])', () => {
    it('checks string literals in [ngClass] object keys', () => {
      tester.run('ngClass-object', rule, {
        valid: [
          { code: `<div [ngClass]="{ 'text-sm font-medium': true }"></div>` },
        ],
        invalid: [
          {
            code: `<div [ngClass]="{ 'text-5xl': isLarge }"></div>`,
            errors: [{ messageId: 'forbiddenTextSize' }],
          },
          {
            code: `<div [ngClass]="{ 'font-bold': isBold }"></div>`,
            errors: [{ messageId: 'forbiddenFontWeight' }],
          },
        ],
      });
    });

    it('checks ternary branches in [ngClass]', () => {
      tester.run('ngClass-ternary', rule, {
        valid: [
          { code: `<div [ngClass]="active ? 'text-sm' : 'text-base'"></div>` },
        ],
        invalid: [
          {
            code: `<div [ngClass]="active ? 'text-5xl' : 'text-base'"></div>`,
            errors: [{ messageId: 'forbiddenTextSize' }],
          },
          {
            code: `<div [ngClass]="active ? 'text-sm' : 'font-bold'"></div>`,
            errors: [{ messageId: 'forbiddenFontWeight' }],
          },
        ],
      });
    });

    it('checks string literals in [class]', () => {
      tester.run('class-binding', rule, {
        valid: [
          { code: `<div [class]="'text-sm font-medium'"></div>` },
        ],
        invalid: [
          {
            code: `<div [class]="'text-[18px] font-bold'"></div>`,
            errors: [
              { messageId: 'forbiddenTextSize' },
              { messageId: 'forbiddenFontWeight' },
            ],
          },
        ],
      });
    });
  });

  // ── RESPONSIVE / DARK PREFIXES ─────────────────────────────────────

  describe('responsive and dark mode prefixes', () => {
    it('does not interfere with prefixed classes (regex boundary works)', () => {
      // The regex uses \b at the start which correctly matches after : in lg:text-sm
      // We verify that allowed values with prefixes don't cause false positives.
      // Note: the prefix (lg:, dark:, etc.) is part of the class token but not
      // part of the match — the regex only captures text-sm, which is allowed.
      tester.run('prefixed-classes', rule, {
        valid: [
          { code: '<div class="lg:text-sm"></div>' },
          { code: '<div class="xl:text-3xl"></div>' },
          { code: '<div class="dark:font-medium"></div>' },
          { code: '<div class="hover:font-semibold"></div>' },
        ],
        invalid: [
          // Prefixed forbidden values are still caught
          {
            code: '<div class="lg:text-5xl"></div>',
            errors: [{ messageId: 'forbiddenTextSize' }],
          },
          {
            code: '<div class="dark:font-bold"></div>',
            errors: [{ messageId: 'forbiddenFontWeight' }],
          },
        ],
      });
    });
  });
});
