// @ts-check
const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');
const showcasePlugin = require('./tools/eslint/plugin');

module.exports = tseslint.config(
  // ─── Ignore patterns ───────────────────────────────────────────────
  {
    ignores: ['dist/', 'node_modules/', '.angular/', 'tools/'],
  },

  // ─── TypeScript files ──────────────────────────────────────────────
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...tseslint.configs.stylistic,
      ...angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      // ── Angular architecture ──────────────────────────────────────
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'app', style: 'kebab-case' },
      ],
      '@angular-eslint/prefer-on-push-component-change-detection': 'error',

      // ── TypeScript style (relaxed where needed) ───────────────────
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Allow empty functions in lifecycle hooks and callbacks
      '@typescript-eslint/no-empty-function': 'off',
    },
  },

  // ─── HTML templates ────────────────────────────────────────────────
  {
    files: ['**/*.html'],
    extends: [
      ...angular.configs.templateRecommended,
      ...angular.configs.templateAccessibility,
    ],
    plugins: {
      showcase: showcasePlugin,
    },
    rules: {
      // ── Design system enforcement ─────────────────────────────────
      'showcase/no-hardcoded-colors': 'error',
      'showcase/no-shadow-classes': 'error',
      'showcase/no-forbidden-rounded': 'error',
      'showcase/no-inline-styles': 'error',

      // ── Angular template best practices ───────────────────────────
      // Prefer @if/@for over *ngIf/*ngFor
      '@angular-eslint/template/prefer-control-flow': 'error',

      // Relax accessibility rules that conflict with PrimeNG components
      // pButton directive renders content internally, not as child text nodes
      '@angular-eslint/template/elements-content': 'off',
      '@angular-eslint/template/click-events-have-key-events': 'warn',
      '@angular-eslint/template/interactive-supports-focus': 'warn',
      '@angular-eslint/template/label-has-associated-control': 'warn',
    },
  },
);
