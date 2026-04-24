#!/usr/bin/env node
/**
 * Per-PR bundle delta check.
 *
 * Filosofía: el budget absoluto en `angular.json` sólo dispara cuando se rompe
 * el techo. Este script es el enforcer REAL contra crecimiento silencioso —
 * dispara en CADA PR que crezca más de `GROWTH_THRESHOLD_PCT`, aunque esté
 * lejos del techo. Sin este gate, 50 PRs de +5 kB cada uno suben el bundle
 * 250 kB sin que nadie se entere hasta que toca renegociar el budget.
 *
 * Cómo funciona:
 *   1. Lee `dist/prime-showcase/browser/index.csr.html` (producido por el
 *      build). Extrae los archivos referenciados — esos SON el initial bundle
 *      real por definición (los hashes cambian cada build, no se pueden
 *      hardcodear).
 *   2. Suma `rawBytes` y calcula `gzipBytes` (gzip nivel 9) por archivo.
 *   3. Compara contra `tools/bundle/baseline.json`.
 *   4. Sale con exit code 1 si initial crece > `GROWTH_THRESHOLD_PCT` vs
 *      baseline.
 *
 * Flags:
 *   --update-baseline    Escribe el size actual al baseline.json.
 *                        Usar SOLO cuando hay justificación aprobada en PR.
 *   --dist-path=<path>   Override del path al dist (default:
 *                        dist/prime-showcase/browser).
 *
 * Output formato CI-friendly (GitHub Actions annotations + human table).
 */

import { gzipSync } from 'node:zlib';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');

const args = process.argv.slice(2);
const UPDATE_BASELINE = args.includes('--update-baseline');
const distPathArg = args.find((a) => a.startsWith('--dist-path='));
const DIST_PATH = distPathArg
  ? resolve(REPO_ROOT, distPathArg.split('=')[1])
  : resolve(REPO_ROOT, 'dist/prime-showcase/browser');

const BASELINE_PATH = join(__dirname, 'baseline.json');
const GROWTH_THRESHOLD_PCT = 3;

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Formato humano: bytes → "12.3 kB" o "1.2 MB". kB binario (1024), alineado
 * con angular-cli output para que los números se correspondan 1:1.
 */
function humanSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} kB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function humanDelta(delta) {
  const sign = delta >= 0 ? '+' : '';
  return `${sign}${humanSize(Math.abs(delta))}`.replace('+-', '-');
}

function pct(curr, prev) {
  if (prev === 0) return curr === 0 ? 0 : 100;
  return ((curr - prev) / prev) * 100;
}

/**
 * Extrae los archivos JS/CSS referenciados en `index.csr.html`. Esos SON el
 * initial bundle por definición — lo que el browser descarga antes de pintar
 * el primer frame. Los chunks lazy no aparecen ahí (se cargan on-demand via
 * import() dinámico).
 */
function parseInitialBundleFiles(distPath) {
  const htmlPath = join(distPath, 'index.csr.html');
  if (!existsSync(htmlPath)) {
    throw new Error(
      `index.csr.html no encontrado en ${htmlPath}. ¿Corriste 'npm run build'?`,
    );
  }
  const html = readFileSync(htmlPath, 'utf8');
  // Regex robusto: captura tanto src=" como href=" en una sola pasada, filtra
  // extensiones js/css. Ignora `rel="dns-prefetch"` y otros refs externos
  // porque esos no apuntan a archivos locales del dist.
  const refs = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)];
  const files = new Set();
  for (const [, ref] of refs) {
    // `ref` es relativo al HTML (mismo directorio). Rechazar URLs absolutas
    // (https://..., //...) — no son parte del bundle local.
    if (ref.startsWith('http') || ref.startsWith('//')) continue;
    files.add(ref);
  }
  return [...files].sort();
}

function measureFile(distPath, fileName) {
  const fullPath = join(distPath, fileName);
  if (!existsSync(fullPath)) {
    throw new Error(`archivo referenciado en index pero no existe: ${fullPath}`);
  }
  const buf = readFileSync(fullPath);
  const gz = gzipSync(buf, { level: 9 });
  return { fileName, raw: buf.length, gzip: gz.length };
}

function sumSizes(measurements) {
  return measurements.reduce(
    (acc, m) => ({ raw: acc.raw + m.raw, gzip: acc.gzip + m.gzip }),
    { raw: 0, gzip: 0 },
  );
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
  console.log('Bundle delta check');
  console.log(`  dist: ${DIST_PATH}`);
  console.log(`  threshold: +${GROWTH_THRESHOLD_PCT}% (raw initial)`);
  console.log('');

  const files = parseInitialBundleFiles(DIST_PATH);
  const measurements = files.map((f) => measureFile(DIST_PATH, f));
  const initial = sumSizes(measurements);

  const current = {
    generatedAt: new Date().toISOString(),
    initial: {
      raw: initial.raw,
      gzip: initial.gzip,
      files: measurements.map(({ fileName, raw, gzip }) => ({
        // Los nombres llevan hash — los reportamos por tipo genérico para que
        // el baseline sea comparable entre builds (sino cada build rompería
        // todos los nombres). El raw/gzip SÍ son comparables build-to-build.
        type: fileName.endsWith('.css')
          ? 'styles'
          : fileName.includes('main-')
            ? 'main'
            : 'chunk',
        raw,
        gzip,
      })),
    },
  };

  if (UPDATE_BASELINE) {
    writeFileSync(BASELINE_PATH, JSON.stringify(current, null, 2) + '\n');
    console.log(`✔ baseline.json actualizado:`);
    console.log(`  initial raw:  ${humanSize(initial.raw)}`);
    console.log(`  initial gzip: ${humanSize(initial.gzip)}`);
    return;
  }

  if (!existsSync(BASELINE_PATH)) {
    console.error('✘ baseline.json no existe.');
    console.error(
      '  Primera ejecución: corre `node tools/bundle/check-delta.mjs --update-baseline`',
    );
    process.exit(1);
  }

  const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  const baseInitial = baseline.initial;

  const rawDelta = initial.raw - baseInitial.raw;
  const gzipDelta = initial.gzip - baseInitial.gzip;
  const rawDeltaPct = pct(initial.raw, baseInitial.raw);
  const gzipDeltaPct = pct(initial.gzip, baseInitial.gzip);

  const pass = rawDeltaPct <= GROWTH_THRESHOLD_PCT;
  const statusIcon = pass ? '✔' : '✘';

  console.log('Initial bundle:');
  console.log(
    `  raw:  ${humanSize(baseInitial.raw).padStart(10)} → ${humanSize(initial.raw).padStart(10)}  (${humanDelta(rawDelta).padStart(8)} / ${rawDeltaPct >= 0 ? '+' : ''}${rawDeltaPct.toFixed(2)}%)  ${statusIcon}`,
  );
  console.log(
    `  gzip: ${humanSize(baseInitial.gzip).padStart(10)} → ${humanSize(initial.gzip).padStart(10)}  (${humanDelta(gzipDelta).padStart(8)} / ${gzipDeltaPct >= 0 ? '+' : ''}${gzipDeltaPct.toFixed(2)}%)`,
  );
  console.log('');

  if (!pass) {
    console.error(
      `✘ FAIL: initial bundle creció ${rawDeltaPct.toFixed(2)}% (> ${GROWTH_THRESHOLD_PCT}% threshold).`,
    );
    console.error('');
    console.error('  Opciones:');
    console.error('    1. Revisar si el cambio es necesario — medir qué lo causó.');
    console.error('       `npm run build` y buscar chunks nuevos o más grandes.');
    console.error('    2. Si es justificado, documentar en PR description y correr:');
    console.error(
      '       `node tools/bundle/check-delta.mjs --update-baseline`',
    );
    console.error('       (commit el nuevo baseline.json junto con el PR).');
    console.error('    3. Si no es justificado, optimizar antes de mergear.');
    console.error('');
    // GitHub Actions annotation — aparece como error en el PR file view.
    console.error(
      `::error file=tools/bundle/baseline.json::Bundle initial creció ${rawDeltaPct.toFixed(2)}% (${humanDelta(rawDelta)}) — excede threshold de ${GROWTH_THRESHOLD_PCT}%`,
    );
    process.exit(1);
  }

  console.log('✔ Bundle delta dentro del threshold.');
}

main();
