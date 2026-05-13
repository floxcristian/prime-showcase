// @ts-check
/**
 * Integration tests para tools/pseudo-loc/scan.mjs.
 *
 * Cubre las primitivas testeables (extractTextNodes, findHtmlFiles,
 * scanRoots, renderReport, applyTransform) sobre fixtures en directorios
 * temporales — sin tocar `src/` real ni `dist/`.
 *
 * Run: `node --test tools/pseudo-loc/__tests__/scan.test.mjs`
 * Wired en `npm run pseudo-loc:test`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
  mkdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  extractTextNodes,
  findHtmlFiles,
  scanRoots,
  renderReport,
  applyTransform,
  parseArgs,
} from '../scan.mjs';

/**
 * Crea un directorio temporal con un set de archivos. Cleanup automatico
 * via test.after — node:test no garantiza orden, asi que cada test
 * gestiona su propio temp.
 *
 * @param {Record<string, string>} files  Map de path relativo -> contenido.
 * @returns {string} Path absoluto al temp dir.
 */
function makeFixture(files) {
  const dir = mkdtempSync(join(tmpdir(), 'pseudo-loc-'));
  for (const [rel, content] of Object.entries(files)) {
    const full = join(dir, rel);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, content);
  }
  return dir;
}

// ─── extractTextNodes ───────────────────────────────────────────────────

test('extractTextNodes extrae texto entre tags simples', () => {
  const nodes = extractTextNodes(
    '<button (click)="x()">Guardar</button>',
  );
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0].text, 'Guardar');
});

test('extractTextNodes NO extrae nada de elementos vacios (e.g. <i class="fa-...">)', () => {
  const nodes = extractTextNodes(
    '<i class="fa-sharp fa-regular fa-bell" aria-hidden="true"></i>',
  );
  // No text content entre el `>` del open y el `<` del close.
  assert.equal(nodes.length, 0);
});

test('extractTextNodes ignora contenido de <script> y <style>', () => {
  const html = `
    <div>Texto visible</div>
    <script>const txt = "no extraer este script";</script>
    <style>.cls { color: "no extraer"; }</style>
  `;
  const nodes = extractTextNodes(html);
  // Solo el div, no el script ni el style.
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0].text, 'Texto visible');
});

test('extractTextNodes ignora comentarios HTML', () => {
  const html = '<!-- Comentario no visible --><span>Si visible</span>';
  const nodes = extractTextNodes(html);
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0].text, 'Si visible');
});

test('extractTextNodes filtra control-flow Angular (@if, @for, @else)', () => {
  const html = `
    <div>
      @if (active()) {
        <span>Real text</span>
      } @else {
        <span>Otro texto</span>
      }
    </div>
  `;
  const nodes = extractTextNodes(html);
  // Solo los textos reales, no los @if/@else.
  const texts = nodes.map((n) => n.text);
  assert.ok(
    texts.includes('Real text'),
    `expected 'Real text', got: ${JSON.stringify(texts)}`,
  );
  assert.ok(
    texts.includes('Otro texto'),
    `expected 'Otro texto', got: ${JSON.stringify(texts)}`,
  );
  assert.ok(
    !texts.some((t) => t.includes('@if')),
    `should filter @if, got: ${JSON.stringify(texts)}`,
  );
});

test('extractTextNodes calcula numero de linea aproximado', () => {
  const html = '<a>\n  <b>linea 2</b>\n  <c>linea 3</c>\n</a>';
  const nodes = extractTextNodes(html);
  const found = nodes.find((n) => n.text === 'linea 2');
  assert.ok(found, 'expected to find linea 2');
  // El text node esta despues del primer <b> que vive en linea 2.
  assert.equal(found.line, 2);
});

// ─── findHtmlFiles ──────────────────────────────────────────────────────

test('findHtmlFiles devuelve solo .html, recursivo, skip node_modules', () => {
  const dir = makeFixture({
    'a.html': '<div/>',
    'sub/b.html': '<div/>',
    'sub/c.ts': '// no es html',
    'node_modules/x.html': '<div/>', // debe ser ignorado
    'dist/y.html': '<div/>', // debe ser ignorado
  });
  try {
    const files = findHtmlFiles(dir);
    assert.equal(files.length, 2);
    assert.ok(files.every((f) => f.endsWith('.html')));
    assert.ok(files.some((f) => f.endsWith('a.html')));
    assert.ok(files.some((f) => f.endsWith('b.html')));
    assert.ok(
      !files.some((f) => f.includes('node_modules')),
      `node_modules should be skipped: ${files.join(', ')}`,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('findHtmlFiles devuelve [] si el dir no existe', () => {
  const files = findHtmlFiles('/path/que/no/existe');
  assert.deepEqual(files, []);
});

// ─── scanRoots + renderReport ───────────────────────────────────────────

test('scanRoots arma StringEntry con delta y flag hasI18n', () => {
  const dir = makeFixture({
    'tpl.html': `
      <button>Guardar</button>
      <span i18n="@@hello">Hola</span>
    `,
  });
  try {
    const entries = scanRoots([dir]);
    // 2 strings detectados: Guardar y Hola.
    assert.equal(entries.length, 2);
    const guardar = entries.find((e) => e.original === 'Guardar');
    const hola = entries.find((e) => e.original === 'Hola');
    assert.ok(guardar);
    assert.ok(hola);
    // Delta positivo en ambos casos.
    assert.ok(guardar.delta > 0, `delta debe ser > 0: ${guardar.delta}`);
    // Solo "Hola" tiene marker i18n en la misma linea.
    assert.equal(guardar.hasI18n, false);
    assert.equal(hola.hasI18n, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('renderReport genera markdown con resumen y tabla por archivo', () => {
  const entries = [
    {
      file: 'a.html',
      line: 1,
      original: 'Guardar',
      pseudo: '[Güårdår—¡]',
      delta: 50,
      hasI18n: false,
    },
    {
      file: 'a.html',
      line: 2,
      original: 'Cancelar',
      pseudo: '[Cåncélår—¡¡]',
      delta: 62,
      hasI18n: true,
    },
  ];
  const md = renderReport(entries, 100);
  assert.match(md, /# Pseudo-localization report/);
  assert.match(md, /Strings detectados: \*\*2\*\*/);
  assert.match(md, /Strings sin marker `i18n=`: \*\*1\*\*/);
  // Tabla por archivo presente.
  assert.match(md, /### `a\.html`/);
  assert.match(md, /Guardar/);
  assert.match(md, /Cancelar/);
  // El ✓ aparece para hasI18n=true.
  assert.ok(md.includes('✓'), `expected ✓ marker, got: ${md}`);
});

test('renderReport escapa pipes que rompen tablas markdown', () => {
  const entries = [
    {
      file: 'a.html',
      line: 1,
      original: 'a | b',
      pseudo: '[å—¡ \\| b—¡]',
      delta: 10,
      hasI18n: false,
    },
  ];
  const md = renderReport(entries, 100);
  // El pipe del original debe estar escapado en la celda.
  assert.match(md, /a \\\| b/);
});

// ─── applyTransform ─────────────────────────────────────────────────────

test('applyTransform copia los .html aplicando pseudoLoc inline', () => {
  const src = makeFixture({
    'src/app/foo.html': '<button>Guardar</button>',
  });
  const dest = mkdtempSync(join(tmpdir(), 'pseudo-loc-apply-'));
  try {
    applyTransform([src], dest);
    // El path adentro de dest preserva el rel relative al REPO_ROOT.
    // Como el test corre desde un temp y REPO_ROOT no matchea, vamos
    // a buscar el archivo recursivamente.
    const files = findHtmlFiles(dest);
    assert.equal(files.length, 1);
    const content = readFileSync(files[0], 'utf8');
    assert.ok(
      content.includes('[Güårdår'),
      `expected transformed text, got: ${content}`,
    );
    assert.ok(
      !content.includes('>Guardar<'),
      `original Guardar should be replaced, got: ${content}`,
    );
  } finally {
    rmSync(src, { recursive: true, force: true });
    rmSync(dest, { recursive: true, force: true });
  }
});

// ─── parseArgs ──────────────────────────────────────────────────────────

test('parseArgs reconoce flags --ci, --threshold y --apply', () => {
  const opts = parseArgs(['--ci', '--threshold', '50', '--apply', './dest']);
  assert.equal(opts.ci, true);
  assert.equal(opts.threshold, 50);
  assert.ok(opts.applyDir?.endsWith('dest'));
});

test('parseArgs tira error en flag desconocida', () => {
  assert.throws(() => parseArgs(['--invented']), /Flag desconocida/);
});

test('parseArgs tira error en --threshold con valor invalido', () => {
  assert.throws(() => parseArgs(['--threshold', 'abc']), /--threshold espera/);
});
