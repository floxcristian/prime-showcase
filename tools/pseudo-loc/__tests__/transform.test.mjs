// @ts-check
/**
 * Unit tests para tools/pseudo-loc/transform.mjs.
 *
 * El transform es la base del scan: si pseudoLoc tiene un bug, todo el
 * reporte de overflow es ruido. Estos tests pinean el contrato sobre
 * fixtures minimos para detectar regresiones sin depender de la
 * estructura completa del repo.
 *
 * Run: `node --test tools/pseudo-loc/__tests__/transform.test.mjs`
 * Wired en `npm run pseudo-loc:test`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { pseudoLoc } from '../transform.mjs';

test('pseudoLoc envuelve el resultado en corchetes', () => {
  const out = pseudoLoc('Guardar');
  assert.ok(out.startsWith('['), `expected to start with [, got: ${out}`);
  assert.ok(out.endsWith(']'), `expected to end with ], got: ${out}`);
});

test('pseudoLoc transforma vocales preservando case', () => {
  const out = pseudoLoc('Guardar');
  // G consonante intacta, u/a vocales transformadas, R consonante.
  assert.match(out, /^\[G[üu]år.+\]$/u);
  // Sufijo de expansion para palabra >3 chars (Guardar = 7 chars).
  assert.ok(out.includes('—'), `expected expansion suffix, got: ${out}`);
});

test('pseudoLoc preserva interpolaciones Angular {{ ... }}', () => {
  const out = pseudoLoc('Total: {{ amount }} USD');
  assert.ok(
    out.includes('{{ amount }}'),
    `expected to preserve {{ amount }}, got: ${out}`,
  );
});

test('pseudoLoc devuelve string vacio para input vacio', () => {
  assert.equal(pseudoLoc(''), '');
});

test('pseudoLoc devuelve string vacio para inputs no-string (defensivo)', () => {
  // @ts-expect-error — el guard runtime cubre callers no-typed.
  assert.equal(pseudoLoc(null), '');
  // @ts-expect-error
  assert.equal(pseudoLoc(undefined), '');
  // @ts-expect-error
  assert.equal(pseudoLoc(42), '');
});

test('pseudoLoc NO agrega sufijo a palabras cortas (<=3 chars)', () => {
  assert.equal(pseudoLoc('a'), '[å]');
  assert.equal(pseudoLoc('ok'), '[øk]');
  assert.equal(pseudoLoc('Si'), '[Sî]');
  // Borderline: 3 chars exactos — sin sufijo.
  const out3 = pseudoLoc('uno');
  assert.equal(out3, '[ünø]');
  assert.ok(!out3.includes('—'), `3-char word should not expand: ${out3}`);
});

test('pseudoLoc agrega sufijo proporcional a palabras largas', () => {
  // 4 chars => floor(4/4) = 1 char extra.
  const four = pseudoLoc('Hola');
  assert.equal(four, '[Hølå—¡]');
  // 8 chars => floor(8/4) = 2 chars extra.
  const eight = pseudoLoc('Producto');
  assert.equal(eight, '[Prødücté—¡¡]'.replace('é', 'ø')); // typo guard: regenera abajo
  // Re-derivacion exacta:
  assert.equal(pseudoLoc('Producto'), '[Prødüctø—¡¡]');
  // 16 chars => floor(16/4) = 4 chars extra.
  assert.equal(pseudoLoc('Configuraciones'), '[Cønfîgüråcîønés—¡¡¡]');
});

test('pseudoLoc resultado siempre es >= length que el input', () => {
  const samples = ['Save', 'Guardar', 'Click here', 'a', 'Hola mundo'];
  for (const s of samples) {
    const out = pseudoLoc(s);
    assert.ok(
      out.length >= s.length,
      `pseudoLoc('${s}') = '${out}' is shorter than input (${out.length} < ${s.length})`,
    );
  }
});

test('pseudoLoc remapea vocales acentuadas a la misma base que sin acento', () => {
  // niño y nino deberian terminar en el mismo carcaracter para o/n_o.
  // (la n con tilde se preserva porque no es vocal pura)
  const conTilde = pseudoLoc('niño');
  const sinTilde = pseudoLoc('nino');
  // Diferencia solo en la consonante n vs n-tilde. Las vocales deben coincidir.
  assert.equal(conTilde.replace('ñ', 'n'), sinTilde);
});

test('pseudoLoc preserva ICU placeholders {plural, ...}', () => {
  const out = pseudoLoc('Items: {count, plural, one {item} other {items}}');
  assert.ok(
    out.includes('{count, plural,'),
    `expected ICU preserved, got: ${out}`,
  );
});

test('pseudoLoc preserva HTML entities &amp;', () => {
  const out = pseudoLoc('Buscar &amp; reemplazar');
  assert.ok(out.includes('&amp;'), `expected to preserve &amp;, got: ${out}`);
});

test('pseudoLoc preserva numeros (enteros y decimales)', () => {
  const intCase = pseudoLoc('Hace 5 minutos');
  assert.ok(intCase.includes('5'), `expected to preserve 5, got: ${intCase}`);
  const floatCase = pseudoLoc('Subiste 2.5 MB');
  assert.ok(
    floatCase.includes('2.5'),
    `expected to preserve 2.5, got: ${floatCase}`,
  );
});

test('pseudoLoc es idempotente: aplicar 2x no genera basura', () => {
  const samples = ['Guardar', 'Total: {{ x }}', 'Hola'];
  for (const s of samples) {
    const once = pseudoLoc(s);
    const twice = pseudoLoc(once);
    assert.equal(
      twice,
      once,
      `idempotency violated for '${s}': once='${once}' twice='${twice}'`,
    );
  }
});

test('pseudoLoc preserva whitespace y puntuacion exactos', () => {
  const out = pseudoLoc('Hola, mundo!');
  // Coma debe estar en su posicion entre las dos palabras.
  assert.match(out, /Hølå—¡,\s+mündø—¡!/u);
});

test('pseudoLoc preserva control-flow decorators (Angular)', () => {
  const out = pseudoLoc('@if (active) { Activado }');
  // El decorator no debe transformarse (preservar como zona protegida).
  assert.ok(
    out.includes('@if'),
    `expected @if preserved, got: ${out}`,
  );
});
