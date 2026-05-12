// @ts-check
/**
 * Unit tests for tools/design-tokens/resolver.mjs.
 *
 * The resolver is the foundation of the drift detector. If the resolver
 * mis-walks the preset, the drift detector reports false matches and
 * silent doc rot returns. These tests pin the contract on minimal
 * fixtures so a regression in the algorithm is caught instantly,
 * without depending on the real Aura preset shape.
 *
 * Run: `node --test tools/design-tokens/__tests__/resolver.test.mjs`
 * Wired into `npm run lint:rules:test`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveValue,
  resolveSurfacePalette,
  resolvePrimaryPalette,
  resolveColorByMode,
  exportTokens,
} from '../resolver.mjs';

const fixture = {
  primitive: {
    rose: { 500: '#f43f5e', 400: '#fb7185' },
    slate: { 0: '#ffffff', 100: '#f1f5f9', 600: '#52525b' },
    zinc: { 0: '#ffffff', 100: '#f4f4f5', 300: '#d4d4d8' },
  },
  semantic: {
    primary: {
      50: '#eff8ff',
      200: '#b2ddf9',
      500: '#0074c2',
      950: '#001829',
    },
    focusRing: { shadow: '0 0 0 0.2rem {primary.200}' },
    colorScheme: {
      light: {
        surface: {
          0: '#ffffff',
          100: '{slate.100}',
          600: '{slate.600}',
        },
        text: { muted: { color: '{surface.600}' } },
        formField: { invalidBorderColor: '{rose.500}' },
      },
      dark: {
        surface: {
          0: '#ffffff',
          100: '{zinc.100}',
          300: '{zinc.300}',
        },
        text: { muted: { color: '{surface.300}' } },
        formField: { invalidBorderColor: '{rose.400}' },
      },
    },
  },
};

test('resolveValue: literal hex returns unchanged', () => {
  assert.equal(resolveValue('#0074c2', fixture, 'light'), '#0074c2');
});

test('resolveValue: numeric returns unchanged', () => {
  assert.equal(resolveValue(42, fixture, 'light'), 42);
});

test('resolveValue: null/undefined return undefined', () => {
  assert.equal(resolveValue(null, fixture, 'light'), undefined);
  assert.equal(resolveValue(undefined, fixture, 'light'), undefined);
});

test('resolveValue: single reference to primitive', () => {
  assert.equal(resolveValue('{rose.500}', fixture, 'light'), '#f43f5e');
});

test('resolveValue: chained reference (semantic → primitive)', () => {
  // surface.600 (light) → {slate.600} → #52525b
  assert.equal(resolveValue('{surface.600}', fixture, 'light'), '#52525b');
});

test('resolveValue: same path resolves differently per mode', () => {
  assert.equal(resolveValue('{surface.100}', fixture, 'light'), '#f1f5f9');
  assert.equal(resolveValue('{surface.100}', fixture, 'dark'), '#f4f4f5');
});

test('resolveValue: composite (focus ring shadow)', () => {
  assert.equal(
    resolveValue('0 0 0 0.2rem {primary.200}', fixture, 'light'),
    '0 0 0 0.2rem #b2ddf9',
  );
});

test('resolveValue: unresolved reference returns original string', () => {
  assert.equal(resolveValue('{does.not.exist}', fixture, 'light'), '{does.not.exist}');
});

test('resolveValue: throws on circular reference (bounded depth)', () => {
  const circular = {
    primitive: { a: '{b.x}', b: { x: '{a}' } },
    semantic: {},
  };
  assert.throws(
    () => resolveValue('{a}', circular, 'light'),
    /max depth/,
  );
});

test('resolvePrimaryPalette: returns literal hex map', () => {
  assert.deepEqual(resolvePrimaryPalette(fixture), {
    50: '#eff8ff',
    200: '#b2ddf9',
    500: '#0074c2',
    950: '#001829',
  });
});

test('resolveSurfacePalette: light uses slate', () => {
  const light = resolveSurfacePalette(fixture, 'light');
  assert.equal(light['0'], '#ffffff');
  assert.equal(light['100'], '#f1f5f9');
  assert.equal(light['600'], '#52525b');
});

test('resolveSurfacePalette: dark uses zinc', () => {
  const dark = resolveSurfacePalette(fixture, 'dark');
  assert.equal(dark['0'], '#ffffff');
  assert.equal(dark['100'], '#f4f4f5');
  assert.equal(dark['300'], '#d4d4d8');
});

test('resolveColorByMode: surface-referenced muted text', () => {
  assert.equal(
    resolveColorByMode(fixture, ['text', 'muted', 'color'], 'light'),
    '#52525b',
  );
  assert.equal(
    resolveColorByMode(fixture, ['text', 'muted', 'color'], 'dark'),
    '#d4d4d8',
  );
});

test('resolveColorByMode: primitive-referenced invalid border', () => {
  assert.equal(
    resolveColorByMode(fixture, ['formField', 'invalidBorderColor'], 'light'),
    '#f43f5e',
  );
  assert.equal(
    resolveColorByMode(fixture, ['formField', 'invalidBorderColor'], 'dark'),
    '#fb7185',
  );
});

test('exportTokens: end-to-end shape', () => {
  const out = exportTokens(fixture);
  assert.equal(out.primary['500'], '#0074c2');
  assert.equal(out.surface.light['100'], '#f1f5f9');
  assert.equal(out.surface.dark['100'], '#f4f4f5');
  assert.equal(out.semantic.textMutedColor.light, '#52525b');
  assert.equal(out.semantic.textMutedColor.dark, '#d4d4d8');
  assert.equal(out.semantic.invalidBorderColor.light, '#f43f5e');
  assert.equal(out.semantic.invalidBorderColor.dark, '#fb7185');
  assert.equal(out.semantic.focusRingShadow, '0 0 0 0.2rem #b2ddf9');
});

test('exportTokens: missing override gracefully returns undefined', () => {
  const noFormField = {
    primitive: fixture.primitive,
    semantic: {
      ...fixture.semantic,
      colorScheme: {
        light: { surface: fixture.semantic.colorScheme.light.surface },
        dark: { surface: fixture.semantic.colorScheme.dark.surface },
      },
    },
  };
  const out = exportTokens(noFormField);
  assert.equal(out.semantic.invalidBorderColor.light, undefined);
  assert.equal(out.semantic.invalidBorderColor.dark, undefined);
});
