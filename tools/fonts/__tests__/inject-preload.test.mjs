// @ts-check
import { strict as assert } from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  LATIN_RANGE_MARKER,
  buildPreloadLinkTag,
  findLatinWoff2Url,
  injectPreloadLink,
  normalizeUrl,
} from '../inject-preload.lib.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const FONTSOURCE_INTER_PKG = resolve(
  REPO_ROOT,
  'node_modules',
  '@fontsource-variable',
  'inter',
);

/**
 * Fixtures — CSS minificado que imita exactamente lo que emite Angular 21
 * con @fontsource-variable/inter en producción. Cada @font-face rule
 * en una línea, sin whitespace interno. Si esto cambia y los tests
 * rompen, es señal de que el build output cambió y hay que reevaluar
 * el matcher (no "arreglar el test" — entender por qué cambió).
 */

const LATIN_ONLY_CSS = `@font-face{font-family:Inter Variable;font-style:normal;font-display:swap;font-weight:100 900;src:url("./media/inter-latin-wght-normal-NRMW37G5.woff2") format("woff2-variations");unicode-range:U+0000-00FF,U+0131,U+0152-0153}`;

const FULL_FONTSOURCE_CSS = `@font-face{font-family:Inter Variable;font-style:normal;font-display:swap;font-weight:100 900;src:url("./media/inter-cyrillic-ext-wght-normal-IYF56FF6.woff2") format("woff2-variations");unicode-range:U+0460-052F,U+1C80-1C8A,U+20B4,U+2DE0-2DFF,U+A640-A69F,U+FE2E-FE2F}@font-face{font-family:Inter Variable;font-style:normal;font-display:swap;font-weight:100 900;src:url("./media/inter-cyrillic-wght-normal-JEOLYBOO.woff2") format("woff2-variations");unicode-range:U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116}@font-face{font-family:Inter Variable;font-style:normal;font-display:swap;font-weight:100 900;src:url("./media/inter-greek-ext-wght-normal-EOVOK2B5.woff2") format("woff2-variations");unicode-range:U+1F00-1FFF}@font-face{font-family:Inter Variable;font-style:normal;font-display:swap;font-weight:100 900;src:url("./media/inter-greek-wght-normal-IRE366VL.woff2") format("woff2-variations");unicode-range:U+0370-0377,U+037A-037F,U+0384-038A,U+038C,U+038E-03A1,U+03A3-03FF}@font-face{font-family:Inter Variable;font-style:normal;font-display:swap;font-weight:100 900;src:url("./media/inter-vietnamese-wght-normal-CE5GGD3W.woff2") format("woff2-variations");unicode-range:U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB}@font-face{font-family:Inter Variable;font-style:normal;font-display:swap;font-weight:100 900;src:url("./media/inter-latin-ext-wght-normal-HA22NDSG.woff2") format("woff2-variations");unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF}@font-face{font-family:Inter Variable;font-style:normal;font-display:swap;font-weight:100 900;src:url("./media/inter-latin-wght-normal-NRMW37G5.woff2") format("woff2-variations");unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC}`;

const CSS_WITHOUT_LATIN = `@font-face{font-family:Inter Variable;src:url("./media/inter-cyrillic-wght-normal-ABC.woff2") format("woff2-variations");unicode-range:U+0400-045F}`;

const CSS_WITH_DUPLICATE_LATIN = `@font-face{src:url("./media/a.woff2") format("woff2");unicode-range:U+0000-00FF}@font-face{src:url("./media/b.woff2") format("woff2");unicode-range:U+0000-00FF,U+0131}`;

// ─── findLatinWoff2Url ──────────────────────────────────────────────────────

describe('findLatinWoff2Url', () => {
  it('extracts the latin subset URL from a single-rule CSS', () => {
    const url = findLatinWoff2Url(LATIN_ONLY_CSS);
    assert.equal(url, './media/inter-latin-wght-normal-NRMW37G5.woff2');
  });

  it('extracts the latin subset URL when mixed with other subsets', () => {
    const url = findLatinWoff2Url(FULL_FONTSOURCE_CSS);
    assert.equal(url, './media/inter-latin-wght-normal-NRMW37G5.woff2');
  });

  it('throws when no latin @font-face exists (regresión: fontsource changed structure)', () => {
    assert.throws(
      () => findLatinWoff2Url(CSS_WITHOUT_LATIN),
      /No se encontró ningún @font-face con unicode-range U\+0000-00FF/,
    );
  });

  it('throws on ambiguity — multiple latin matches (regresión: múltiples axes)', () => {
    assert.throws(
      () => findLatinWoff2Url(CSS_WITH_DUPLICATE_LATIN),
      /Se encontraron 2 matches/,
    );
  });

  it('throws on CSS sin ningún @font-face', () => {
    assert.throws(
      () => findLatinWoff2Url('body { color: red; }'),
      /No se encontró ningún @font-face/,
    );
  });

  it('acepta URLs entre single-quotes (CSS válido alternativo)', () => {
    const css = `@font-face{src:url('./media/inter-latin.woff2') format('woff2');unicode-range:U+0000-00FF}`;
    assert.equal(findLatinWoff2Url(css), './media/inter-latin.woff2');
  });

  it('acepta URLs sin quotes (CSS válido alternativo)', () => {
    const css = `@font-face{src:url(./media/inter-latin.woff2) format('woff2');unicode-range:U+0000-00FF}`;
    assert.equal(findLatinWoff2Url(css), './media/inter-latin.woff2');
  });

  it('LATIN_RANGE_MARKER es el ancla documentada — cambiarlo es breaking', () => {
    // Este test es un canario. Si alguien cambia el constant, falla con
    // mensaje claro obligando a reevaluar.
    assert.equal(LATIN_RANGE_MARKER, 'U+0000-00FF');
  });
});

// ─── normalizeUrl ───────────────────────────────────────────────────────────

describe('normalizeUrl', () => {
  it('strips leading ./', () => {
    assert.equal(
      normalizeUrl('./media/inter-latin.woff2'),
      'media/inter-latin.woff2',
    );
  });

  it('leaves absolute paths alone', () => {
    assert.equal(
      normalizeUrl('/media/inter-latin.woff2'),
      '/media/inter-latin.woff2',
    );
  });

  it('leaves already-normalized paths alone', () => {
    assert.equal(
      normalizeUrl('media/inter-latin.woff2'),
      'media/inter-latin.woff2',
    );
  });
});

// ─── buildPreloadLinkTag ────────────────────────────────────────────────────

describe('buildPreloadLinkTag', () => {
  it('produces the exact link tag format expected by browsers', () => {
    const tag = buildPreloadLinkTag('./media/inter-latin-X.woff2');
    assert.equal(
      tag,
      '<link rel="preload" as="font" type="font/woff2" href="media/inter-latin-X.woff2" crossorigin>',
    );
  });

  it('includes crossorigin (MANDATORY aun siendo same-origin)', () => {
    // Sin crossorigin, el browser descarta el preload al encontrar el
    // @font-face y lo baja de nuevo. Este test lockéa la presencia del attr.
    const tag = buildPreloadLinkTag('./media/font.woff2');
    assert.match(tag, /\bcrossorigin\b/);
  });

  it('includes as="font" + type="font/woff2" (MANDATORY para browsers)', () => {
    const tag = buildPreloadLinkTag('./media/font.woff2');
    assert.match(tag, /as="font"/);
    assert.match(tag, /type="font\/woff2"/);
  });
});

// ─── injectPreloadLink ──────────────────────────────────────────────────────

describe('injectPreloadLink', () => {
  const LINK =
    '<link rel="preload" as="font" type="font/woff2" href="media/x.woff2" crossorigin>';

  const HTML_WITH_THEME_COLOR = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>App</title>
  <meta name="theme-color" content="#0074c2">
  <link rel="icon" href="favicon.ico">
</head>
<body>
  <app-root></app-root>
</body>
</html>`;

  const HTML_WITHOUT_THEME_COLOR = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <link rel="icon" href="favicon.ico">
</head>
<body>
  <app-root></app-root>
</body>
</html>`;

  it('injects after <meta name="theme-color">', () => {
    const result = injectPreloadLink(HTML_WITH_THEME_COLOR, LINK);
    assert.ok(result.includes(LINK));
    const themeColorIdx = result.indexOf('theme-color');
    const linkIdx = result.indexOf(LINK);
    const iconIdx = result.indexOf('rel="icon"');
    assert.ok(
      themeColorIdx < linkIdx && linkIdx < iconIdx,
      `link debe estar entre theme-color (idx=${themeColorIdx}) y favicon (idx=${iconIdx}), está en idx=${linkIdx}`,
    );
  });

  it('is idempotent — second call is a no-op', () => {
    const once = injectPreloadLink(HTML_WITH_THEME_COLOR, LINK);
    const twice = injectPreloadLink(once, LINK);
    assert.equal(once, twice);
    // Garantiza que NO hay dos copias del link tag.
    const matches = once.match(new RegExp(LINK, 'g')) ?? [];
    assert.equal(matches.length, 1);
  });

  it('fallback: injects right after <head> when theme-color missing', () => {
    const result = injectPreloadLink(HTML_WITHOUT_THEME_COLOR, LINK);
    assert.ok(result.includes(LINK));
    const headIdx = result.indexOf('<head>');
    const linkIdx = result.indexOf(LINK);
    const iconIdx = result.indexOf('rel="icon"');
    assert.ok(headIdx < linkIdx && linkIdx < iconIdx);
  });

  it('throws when HTML lacks <head>', () => {
    assert.throws(
      () => injectPreloadLink('<html><body></body></html>', LINK),
      /<head>/,
    );
  });

  it('matches theme-color case-insensitively (robust vs. formatters)', () => {
    const upper = HTML_WITH_THEME_COLOR.replace(
      'meta name="theme-color"',
      'META NAME="theme-color"',
    );
    const result = injectPreloadLink(upper, LINK);
    assert.ok(result.includes(LINK));
  });
});

// ─── Canary: contra el @fontsource-variable/inter REAL instalado ────────────
//
// Los tests de arriba usan fixtures hand-written (strings que escribimos
// nosotros emulando el output observado). Si fontsource cambia formato en
// una futura major (v6, v7), los fixtures quedan stale — siguen pasando
// mientras el build real se rompe silenciosamente.
//
// Este bloque lee el CSS REAL instalado en node_modules y verifica la
// integración end-to-end. Si fontsource renombra archivos, cambia el
// naming convention de los subsets, o remueve el unicode-range latin,
// estos tests fallan con mensaje explícito ANTES del build que lo
// detectaría por accidente.
//
// Patrón: "source-stability canary" — complementa regex-based parsing.
// Los fixtures lockean el comportamiento esperado; el canary lockea el
// input real instalado. Ambos en conjunto = ningún dep bump silencioso.
describe('findLatinWoff2Url — canary contra @fontsource-variable/inter instalado', () => {
  const indexCssPath = resolve(FONTSOURCE_INTER_PKG, 'index.css');
  const packageInstalled = existsSync(indexCssPath);

  it('package @fontsource-variable/inter está instalado (pre-requisito)', () => {
    assert.ok(
      packageInstalled,
      `${indexCssPath} no existe. Correr 'npm ci' antes de los tests.`,
    );
  });

  it('extrae URL del CSS REAL instalado — detecta breaking changes de fontsource', (t) => {
    if (!packageInstalled) {
      t.skip('package no instalado (el test anterior ya falló)');
      return;
    }
    const cssSource = readFileSync(indexCssPath, 'utf8');
    const url = findLatinWoff2Url(cssSource);

    // Assertion #1: el URL sigue el naming convention de fontsource. Si
    // renombran a "inter-primary" o "inter-basic" en una major futura,
    // este test falla con el URL nuevo en el mensaje — señal clara de
    // "investigar el package y actualizar el matcher o el marker".
    assert.match(
      url,
      /inter-latin-wght-normal/,
      `URL "${url}" NO contiene 'inter-latin-wght-normal'. ` +
        `¿Fontsource cambió naming convention? Revisar @fontsource-variable/inter@${readFontsourceVersion()}.`,
    );

    // Assertion #2: sigue emitiendo woff2 (no woff, no otf). Si cambia
    // a otro formato, el preload mime-type "font/woff2" quedaría mal.
    assert.match(
      url,
      /\.woff2$/,
      `URL "${url}" no es un .woff2. El preload tag hardcodea font/woff2 — ` +
        `revisar buildPreloadLinkTag() si fontsource cambió a otro formato.`,
    );
  });

  it('el archivo woff2 referenciado existe físicamente en el package', (t) => {
    if (!packageInstalled) {
      t.skip('package no instalado');
      return;
    }
    const cssSource = readFileSync(indexCssPath, 'utf8');
    const url = findLatinWoff2Url(cssSource);

    // Fontsource's CSS usa URLs relativos al propio index.css
    // (p.ej. "./files/inter-latin-wght-normal.woff2"). Resolvemos contra
    // el dir del package y chequeamos que el archivo existe. Esta es la
    // única forma de detectar un package corrupto antes de que Angular
    // falle con error críptico al buildear.
    const resolvedPath = resolve(FONTSOURCE_INTER_PKG, url);
    assert.ok(
      existsSync(resolvedPath),
      `URL "${url}" apunta a ${resolvedPath} pero el archivo NO existe. ` +
        `Package corrupto — re-ejecutar 'npm ci'.`,
    );
  });
});

/**
 * Lee la versión del package para ayudar a diagnosticar fallos — ponerla en
 * el mensaje del assert hace obvio contra qué versión rompió el test.
 */
function readFontsourceVersion() {
  try {
    const pkg = JSON.parse(
      readFileSync(resolve(FONTSOURCE_INTER_PKG, 'package.json'), 'utf8'),
    );
    return pkg.version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}
