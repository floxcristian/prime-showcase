#!/usr/bin/env node
/**
 * Post-build: inyecta `<link rel="preload">` para Inter Variable (latin
 * subset) en los HTML templates del dist.
 *
 * **Problema resuelto:**
 * Inter está self-hosted en `dist/.../media/inter-latin-wght-normal-XXX.woff2`
 * con filename content-hashed. Angular 21 inlina los `@font-face` en un
 * `<style>` dentro del `<head>` (critical CSS), pero el browser NO empieza
 * la descarga del woff2 hasta que encuentra texto realmente usando esa
 * font-family. Con SSR, ese descubrimiento ocurre al parsear el `<body>`
 * renderizado → delay de 50-200ms antes de que arranque el fetch del font.
 *
 * **Solución:** emitir un `<link rel="preload" as="font">` en `<head>` que
 * el browser-preload-scanner detecta inmediatamente y dispara la descarga
 * en paralelo con el parse del CSS. Cuando `@font-face` se evalúa, el
 * archivo ya está en cache → FOUT invisible.
 *
 * **Por qué este enfoque (build-time post-process):**
 *   - Zero runtime cost (a diferencia de inyección por middleware SSR).
 *   - Funciona tanto para SSR (index.server.html) como para CSR fallback
 *     (index.csr.html). Un middleware Express sólo agarraría SSR.
 *   - Compatible con CDN enfrente (el HTML servido ya trae el link).
 *   - Mismo patrón que Next.js `next/font`, Remix, SvelteKit.
 *
 * **Por qué no preconnect:** Inter es same-origin con el HTML. Preconnect
 * a `self` es no-op. Ver `tools/fonts/README.md` para el deep-dive.
 *
 * **Por qué sólo latin (no latin-ext, cyrillic, etc.):** app en español usa
 * U+0000-00FF casi exclusivamente (ñ, á, é, í, ó, ú están en ese range).
 * Los otros subsets se bajan JIT si aparece un char raro. Pre-cargarlos
 * todos serían 300+ kB de traffic desperdiciado.
 *
 * Ref: https://web.dev/articles/preload-critical-assets
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildPreloadLinkTag,
  findLatinWoff2Url,
  injectPreloadLink,
  normalizeUrl,
} from './inject-preload.lib.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');

const BROWSER_DIST = resolve(REPO_ROOT, 'dist/prime-showcase/browser');
const SERVER_DIST = resolve(REPO_ROOT, 'dist/prime-showcase/server');

/**
 * Encuentra el único `styles-*.css` en el browser dist. Angular emite uno
 * por build con content hash. Si hubiera múltiples (edge case: builds
 * parciales sin clean), fallar explícito para evitar picks arbitrarios.
 */
function findStylesCss(distPath) {
  if (!existsSync(distPath)) {
    throw new Error(
      `Browser dist no existe en ${distPath}. ¿Corriste 'ng build' antes?`,
    );
  }
  const stylesFiles = readdirSync(distPath).filter((f) =>
    /^styles-.*\.css$/.test(f),
  );
  if (stylesFiles.length === 0) {
    throw new Error(
      `No se encontró styles-*.css en ${distPath}. ¿Build incompleto?`,
    );
  }
  if (stylesFiles.length > 1) {
    throw new Error(
      `Múltiples styles-*.css en ${distPath}: ${stylesFiles.join(', ')}. ` +
        `Probablemente un build previo no limpió. Correr 'npm run build' desde scratch.`,
    );
  }
  return join(distPath, stylesFiles[0]);
}

function patchHtmlFile(htmlPath, linkTag) {
  const original = readFileSync(htmlPath, 'utf8');
  const patched = injectPreloadLink(original, linkTag);
  if (original === patched) {
    return { path: htmlPath, status: 'unchanged' };
  }
  writeFileSync(htmlPath, patched);
  return { path: htmlPath, status: 'injected' };
}

function main() {
  console.log('Font preload injection (Inter latin subset)');

  const stylesCssPath = findStylesCss(BROWSER_DIST);
  const cssSource = readFileSync(stylesCssPath, 'utf8');
  const woff2Url = findLatinWoff2Url(cssSource);
  const normalizedUrl = normalizeUrl(woff2Url);

  // Sanity check: el archivo existe en disco. Si el matcher encontró un URL
  // pero el archivo no está, algo se rompió en el build (typical: rsync /
  // CDN upload parcial). Preferimos fallar acá que emitir un preload a 404.
  const woff2FullPath = resolve(BROWSER_DIST, normalizedUrl);
  if (!existsSync(woff2FullPath)) {
    throw new Error(
      `Latin woff2 URL detectada en CSS (${normalizedUrl}) pero el archivo ` +
        `NO existe en ${woff2FullPath}. Build corrupto o path mismatch.`,
    );
  }

  const linkTag = buildPreloadLinkTag(woff2Url);

  console.log(`  file:  ${normalizedUrl}`);
  console.log(`  tag:   ${linkTag}`);
  console.log('');

  // Dos targets:
  //   - browser/index.csr.html → fallback CSR + usado por Angular 21 SSR
  //     como shell base
  //   - server/index.server.html → template específico de SSR que se sirve
  //     cuando AngularNodeAppEngine hidrata
  // Parcheamos ambos para garantizar preload en TODOS los modos de serving.
  const targets = [
    join(BROWSER_DIST, 'index.csr.html'),
    join(SERVER_DIST, 'index.server.html'),
  ];

  let missingTargets = 0;
  for (const target of targets) {
    if (!existsSync(target)) {
      console.warn(`  skip       ${target} (not found)`);
      missingTargets++;
      continue;
    }
    const result = patchHtmlFile(target, linkTag);
    const icon = result.status === 'injected' ? '✔' : '↻';
    console.log(`  ${icon} ${result.status.padEnd(9)} ${target}`);
  }

  // Si LOS DOS targets faltan, el build probablemente falló y no hay que
  // decir "todo OK" silenciosamente. Warning vocal pero no error (podría
  // ser un build CSR-only legítimo en el futuro).
  if (missingTargets === targets.length) {
    console.warn('');
    console.warn(
      '⚠  Ningún target HTML encontrado. ¿Build incompleto? Preload NO aplicado.',
    );
    process.exit(1);
  }
}

main();
