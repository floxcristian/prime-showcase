// @ts-check
'use strict';

/**
 * @fileoverview Tests for showcase/no-hardcoded-colors ESLint rule.
 *
 * Run: node --test tools/eslint/rules/__tests__/no-hardcoded-colors.test.js
 */

const { describe, it } = require('node:test');
const { RuleTester } = require('eslint');
const templateParser = require('@angular-eslint/template-parser');
const rule = require('../no-hardcoded-colors');

const tester = new RuleTester({
  languageOptions: { parser: templateParser },
});

describe('no-hardcoded-colors', () => {
  // ── DESIGN TOKENS (allowed) ────────────────────────────────────────

  describe('allows PrimeNG design tokens', () => {
    it('allows text-color and text-muted-color', () => {
      tester.run('text-tokens', rule, {
        valid: [
          { code: '<div class="text-color"></div>' },
          { code: '<div class="text-muted-color"></div>' },
          { code: '<div class="text-muted-color-emphasis"></div>' },
          { code: '<div class="text-primary"></div>' },
          { code: '<div class="text-primary-contrast"></div>' },
        ],
        invalid: [],
      });
    });

    it('allows bg-surface-* and bg-primary tokens', () => {
      tester.run('bg-tokens', rule, {
        valid: [
          { code: '<div class="bg-surface-0"></div>' },
          { code: '<div class="bg-surface-50"></div>' },
          { code: '<div class="bg-surface-100"></div>' },
          { code: '<div class="bg-surface-950"></div>' },
          { code: '<div class="bg-primary"></div>' },
          { code: '<div class="bg-emphasis"></div>' },
          { code: '<div class="bg-transparent"></div>' },
        ],
        invalid: [],
      });
    });

    it('allows border-surface token', () => {
      tester.run('border-tokens', rule, {
        valid: [{ code: '<div class="border-surface"></div>' }, { code: '<div class="border-primary"></div>' }],
        invalid: [],
      });
    });
  });

  // ── SEMANTIC EXCEPTIONS (allowed) ──────────────────────────────────

  describe('allows documented semantic exceptions', () => {
    it('allows avatar background colors', () => {
      tester.run('avatar-exceptions', rule, {
        valid: [
          { code: '<div class="bg-violet-100 text-violet-950"></div>' },
          { code: '<div class="bg-orange-100 text-orange-950"></div>' },
        ],
        invalid: [],
      });
    });

    it('allows crypto icon color', () => {
      tester.run('crypto-exception', rule, {
        valid: [{ code: '<i class="text-yellow-500"></i>' }],
        invalid: [],
      });
    });

    it('allows layout border exceptions', () => {
      tester.run('border-bw-exceptions', rule, {
        valid: [{ code: '<div class="border-black/10"></div>' }, { code: '<div class="border-white/20"></div>' }],
        invalid: [],
      });
    });
  });

  // ── GENERIC TAILWIND COLORS (forbidden) ────────────────────────────

  describe('blocks generic Tailwind color families', () => {
    it('blocks gray family', () => {
      tester.run('gray-family', rule, {
        valid: [],
        invalid: [
          { code: '<div class="text-gray-500"></div>', errors: [{ messageId: 'noHardcodedColor' }] },
          { code: '<div class="bg-gray-100"></div>', errors: [{ messageId: 'noHardcodedColor' }] },
          { code: '<div class="border-gray-200"></div>', errors: [{ messageId: 'noHardcodedColor' }] },
        ],
      });
    });

    it('blocks blue family', () => {
      tester.run('blue-family', rule, {
        valid: [],
        invalid: [
          { code: '<div class="text-blue-500"></div>', errors: [{ messageId: 'noHardcodedColor' }] },
          { code: '<div class="bg-blue-100"></div>', errors: [{ messageId: 'noHardcodedColor' }] },
        ],
      });
    });

    it('blocks red family', () => {
      tester.run('red-family', rule, {
        valid: [],
        invalid: [
          { code: '<div class="text-red-600"></div>', errors: [{ messageId: 'noHardcodedColor' }] },
          { code: '<div class="bg-red-50"></div>', errors: [{ messageId: 'noHardcodedColor' }] },
        ],
      });
    });

    it('blocks slate, zinc, neutral, stone families', () => {
      tester.run('neutral-families', rule, {
        valid: [],
        invalid: [
          { code: '<div class="text-slate-700"></div>', errors: [{ messageId: 'noHardcodedColor' }] },
          { code: '<div class="bg-zinc-100"></div>', errors: [{ messageId: 'noHardcodedColor' }] },
          { code: '<div class="text-neutral-500"></div>', errors: [{ messageId: 'noHardcodedColor' }] },
          { code: '<div class="bg-stone-200"></div>', errors: [{ messageId: 'noHardcodedColor' }] },
        ],
      });
    });

    it('blocks all color utility prefixes (from, to, ring, fill, etc.)', () => {
      tester.run('all-prefixes', rule, {
        valid: [],
        invalid: [
          { code: '<div class="from-blue-500"></div>', errors: [{ messageId: 'noHardcodedColor' }] },
          { code: '<div class="to-green-300"></div>', errors: [{ messageId: 'noHardcodedColor' }] },
          { code: '<div class="ring-red-500"></div>', errors: [{ messageId: 'noHardcodedColor' }] },
          { code: '<div class="fill-gray-600"></div>', errors: [{ messageId: 'noHardcodedColor' }] },
          { code: '<div class="stroke-blue-400"></div>', errors: [{ messageId: 'noHardcodedColor' }] },
          { code: '<div class="accent-pink-500"></div>', errors: [{ messageId: 'noHardcodedColor' }] },
          { code: '<div class="caret-indigo-500"></div>', errors: [{ messageId: 'noHardcodedColor' }] },
          { code: '<div class="divide-gray-200"></div>', errors: [{ messageId: 'noHardcodedColor' }] },
          { code: '<div class="placeholder-gray-400"></div>', errors: [{ messageId: 'noHardcodedColor' }] },
          { code: '<div class="decoration-red-500"></div>', errors: [{ messageId: 'noHardcodedColor' }] },
        ],
      });
    });

    it('blocks non-excepted violet/orange shades', () => {
      tester.run('non-excepted-shades', rule, {
        valid: [],
        invalid: [
          // bg-violet-100 is allowed but bg-violet-200 is not
          { code: '<div class="bg-violet-200"></div>', errors: [{ messageId: 'noHardcodedColor' }] },
          { code: '<div class="text-orange-500"></div>', errors: [{ messageId: 'noHardcodedColor' }] },
          { code: '<div class="text-yellow-300"></div>', errors: [{ messageId: 'noHardcodedColor' }] },
        ],
      });
    });
  });

  // ── BLACK / WHITE (forbidden) ──────────────────────────────────────

  describe('blocks black/white utilities', () => {
    it('blocks text-white, bg-black, etc.', () => {
      tester.run('black-white', rule, {
        valid: [],
        invalid: [
          { code: '<div class="text-white"></div>', errors: [{ messageId: 'noHardcodedColor' }] },
          { code: '<div class="bg-black"></div>', errors: [{ messageId: 'noHardcodedColor' }] },
          { code: '<div class="bg-white"></div>', errors: [{ messageId: 'noHardcodedColor' }] },
          { code: '<div class="text-black"></div>', errors: [{ messageId: 'noHardcodedColor' }] },
        ],
      });
    });

    it('blocks non-excepted opacity variants', () => {
      tester.run('bw-opacity', rule, {
        valid: [],
        invalid: [
          // border-black/10 is allowed but border-black/20 is not
          { code: '<div class="border-black/20"></div>', errors: [{ messageId: 'noHardcodedColor' }] },
          { code: '<div class="border-white/10"></div>', errors: [{ messageId: 'noHardcodedColor' }] },
          { code: '<div class="bg-black/50"></div>', errors: [{ messageId: 'noHardcodedColor' }] },
        ],
      });
    });
  });

  // ── HEX COLORS (forbidden) ────────────────────────────────────────

  describe('blocks arbitrary hex colors', () => {
    it('blocks hex in bg, text, border', () => {
      tester.run('hex-colors', rule, {
        valid: [],
        invalid: [
          { code: '<div class="bg-[#fff]"></div>', errors: [{ messageId: 'noHexColor' }] },
          { code: '<div class="text-[#1a1a1a]"></div>', errors: [{ messageId: 'noHexColor' }] },
          { code: '<div class="border-[#e5e7eb]"></div>', errors: [{ messageId: 'noHexColor' }] },
          { code: '<div class="bg-[#FF5733]"></div>', errors: [{ messageId: 'noHexColor' }] },
        ],
      });
    });
  });

  // ── CSS COLOR FUNCTIONS (forbidden) ────────────────────────────────

  describe('blocks arbitrary CSS color functions', () => {
    it('blocks rgb, hsl, oklch functions', () => {
      tester.run('css-color-fns', rule, {
        valid: [],
        invalid: [
          { code: '<div class="bg-[rgb(0,0,0)]"></div>', errors: [{ messageId: 'noArbitraryColor' }] },
          { code: '<div class="text-[rgba(255,0,0,0.5)]"></div>', errors: [{ messageId: 'noArbitraryColor' }] },
          { code: '<div class="bg-[hsl(0,50%,50%)]"></div>', errors: [{ messageId: 'noArbitraryColor' }] },
          { code: '<div class="text-[oklch(0.5,0.2,240)]"></div>', errors: [{ messageId: 'noArbitraryColor' }] },
        ],
      });
    });
  });

  // ── BOUND ATTRIBUTES ───────────────────────────────────────────────

  describe('bound attributes ([ngClass])', () => {
    it('checks ngClass object keys', () => {
      tester.run('ngClass', rule, {
        valid: [{ code: `<div [ngClass]="{ 'text-color bg-emphasis': true }"></div>` }],
        invalid: [
          {
            code: `<div [ngClass]="{ 'text-gray-500': isGray }"></div>`,
            errors: [{ messageId: 'noHardcodedColor' }],
          },
        ],
      });
    });

    it('checks ternary branches', () => {
      tester.run('ngClass-ternary', rule, {
        valid: [],
        invalid: [
          {
            code: `<div [ngClass]="active ? 'bg-blue-500' : 'bg-surface-0'"></div>`,
            errors: [{ messageId: 'noHardcodedColor' }],
          },
        ],
      });
    });
  });

  // ── MULTIPLE VIOLATIONS ────────────────────────────────────────────

  describe('multiple violations', () => {
    it('reports each violation separately', () => {
      tester.run('multi-violations', rule, {
        valid: [],
        invalid: [
          {
            code: '<div class="text-gray-500 bg-blue-100 border-red-300"></div>',
            errors: [
              { messageId: 'noHardcodedColor' },
              { messageId: 'noHardcodedColor' },
              { messageId: 'noHardcodedColor' },
            ],
          },
        ],
      });
    });
  });

  // ── PrimeNG styleClass ─────────────────────────────────────────────

  describe('PrimeNG styleClass', () => {
    it('checks styleClass attribute', () => {
      tester.run('styleClass', rule, {
        valid: [{ code: '<p-button styleClass="text-color"></p-button>' }],
        invalid: [
          {
            code: '<p-button styleClass="text-red-500"></p-button>',
            errors: [{ messageId: 'noHardcodedColor' }],
          },
        ],
      });
    });
  });
});
