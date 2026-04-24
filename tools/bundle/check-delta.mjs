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
 * **Qué mide:**
 *   - `initial`: lo que el browser descarga antes del primer paint (JS+CSS
 *     referenciados en `index.csr.html`). Captura tiempo al primer render.
 *   - `totalJs`: sum de TODOS los `.js` en dist/browser. Captura bloat en
 *     lazy chunks — cambios que mueven kBs desde initial a lazy, o que
 *     empujan kBs nuevos a rutas lazy, se verían acá aunque initial no se
 *     mueva. Chart.js vive en lazy chunks, por ejemplo.
 *
 * **Cómo funciona:**
 *   1. Lee `dist/prime-showcase/browser/index.csr.html` (producido por el
 *      build). Extrae archivos referenciados — esos SON el initial bundle
 *      por definición (hashes cambian cada build, no se pueden hardcodear).
 *   2. Para `initial`: suma raw + gzip level-9 de esos archivos.
 *   3. Para `totalJs`: glob todos los `*.js` del dist y suma raw.
 *   4. Compara contra `baseline.json`.
 *   5. Sale con exit 1 si cualquiera de los dos creció > threshold.
 *
 * **Flags:**
 *   --update-baseline    Escribe sizes actuales al baseline.json.
 *                        Usar SOLO cuando hay justificación aprobada en PR.
 *   --dist-path=<path>   Override del path al dist (default:
 *                        dist/prime-showcase/browser).
 *
 * Output: formato CI-friendly (GitHub Actions annotations + human table).
 */

import { gzipSync } from 'node:zlib';
import { readdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
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

/**
 * Lista todos los `.js` del browser dist (initial + lazy). Excluye maps.
 * No gzippea (sería lento + el número relevante acá es el JS shipped total,
 * no el transfer exacto que varía por CDN).
 */
function listAllJsFiles(distPath) {
  return readdirSync(distPath)
    .filter((name) => name.endsWith('.js'))
    .sort();
}

function measureFile(distPath, fileName, { withGzip = false } = {}) {
  const fullPath = join(distPath, fileName);
  if (!existsSync(fullPath)) {
    throw new Error(`archivo referenciado en index pero no existe: ${fullPath}`);
  }
  const buf = readFileSync(fullPath);
  const result = { fileName, raw: buf.length };
  if (withGzip) result.gzip = gzipSync(buf, { level: 9 }).length;
  return result;
}

function sumSizes(measurements, { withGzip = false } = {}) {
  if (withGzip) {
    return measurements.reduce(
      (acc, m) => ({ raw: acc.raw + m.raw, gzip: acc.gzip + (m.gzip ?? 0) }),
      { raw: 0, gzip: 0 },
    );
  }
  return measurements.reduce(
    (acc, m) => ({ raw: acc.raw + m.raw }),
    { raw: 0 },
  );
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
  console.log('Bundle delta check');
  console.log(`  dist: ${DIST_PATH}`);
  console.log(
    `  threshold: +${GROWTH_THRESHOLD_PCT}% on each of {initial raw, totalJs raw}`,
  );
  console.log('');

  // Initial bundle (with gzip — it's the user-facing metric for first paint).
  const initialFiles = parseInitialBundleFiles(DIST_PATH);
  const initialMeasurements = initialFiles.map((f) =>
    measureFile(DIST_PATH, f, { withGzip: true }),
  );
  const initial = sumSizes(initialMeasurements, { withGzip: true });

  // Total JS shipped (raw only — gzip on every chunk is expensive and the
  // metric we care about is byte-weight discipline, not CDN transfer).
  const allJsFiles = listAllJsFiles(DIST_PATH);
  const allJsMeasurements = allJsFiles.map((f) => measureFile(DIST_PATH, f));
  const totalJs = sumSizes(allJsMeasurements);

  const current = {
    generatedAt: new Date().toISOString(),
    initial: {
      raw: initial.raw,
      gzip: initial.gzip,
      files: initialMeasurements.map(({ fileName, raw, gzip }) => ({
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
    totalJs: {
      raw: totalJs.raw,
      fileCount: allJsFiles.length,
    },
  };

  if (UPDATE_BASELINE) {
    writeFileSync(BASELINE_PATH, JSON.stringify(current, null, 2) + '\n');
    console.log(`✔ baseline.json actualizado:`);
    console.log(`  initial raw:  ${humanSize(initial.raw)}`);
    console.log(`  initial gzip: ${humanSize(initial.gzip)}`);
    console.log(
      `  totalJs raw:  ${humanSize(totalJs.raw)} (${allJsFiles.length} chunks)`,
    );
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
  const baseTotalJs = baseline.totalJs ?? { raw: 0, fileCount: 0 };

  const initialRawDelta = initial.raw - baseInitial.raw;
  const initialGzipDelta = initial.gzip - baseInitial.gzip;
  const initialRawPct = pct(initial.raw, baseInitial.raw);
  const initialGzipPct = pct(initial.gzip, baseInitial.gzip);
  const totalRawDelta = totalJs.raw - baseTotalJs.raw;
  const totalRawPct = pct(totalJs.raw, baseTotalJs.raw);

  const initialPass = initialRawPct <= GROWTH_THRESHOLD_PCT;
  const totalPass = totalRawPct <= GROWTH_THRESHOLD_PCT;
  const pass = initialPass && totalPass;

  console.log('Initial bundle (first paint):');
  console.log(
    `  raw:  ${humanSize(baseInitial.raw).padStart(10)} → ${humanSize(initial.raw).padStart(10)}  (${humanDelta(initialRawDelta).padStart(8)} / ${initialRawPct >= 0 ? '+' : ''}${initialRawPct.toFixed(2)}%)  ${initialPass ? '✔' : '✘'}`,
  );
  console.log(
    `  gzip: ${humanSize(baseInitial.gzip).padStart(10)} → ${humanSize(initial.gzip).padStart(10)}  (${humanDelta(initialGzipDelta).padStart(8)} / ${initialGzipPct >= 0 ? '+' : ''}${initialGzipPct.toFixed(2)}%)`,
  );
  console.log('');
  console.log('Total JS shipped (initial + lazy chunks):');
  console.log(
    `  raw:  ${humanSize(baseTotalJs.raw).padStart(10)} → ${humanSize(totalJs.raw).padStart(10)}  (${humanDelta(totalRawDelta).padStart(8)} / ${totalRawPct >= 0 ? '+' : ''}${totalRawPct.toFixed(2)}%)  ${totalPass ? '✔' : '✘'}`,
  );
  console.log(
    `  chunks: ${baseTotalJs.fileCount} → ${allJsFiles.length}`,
  );
  console.log('');

  if (!pass) {
    const failures = [];
    if (!initialPass) {
      failures.push(
        `initial raw +${initialRawPct.toFixed(2)}% (${humanDelta(initialRawDelta)})`,
      );
    }
    if (!totalPass) {
      failures.push(
        `totalJs raw +${totalRawPct.toFixed(2)}% (${humanDelta(totalRawDelta)})`,
      );
    }
    console.error(
      `✘ FAIL: bundle creció más allá del threshold — ${failures.join(', ')}.`,
    );
    console.error('');
    console.error('  Opciones:');
    console.error('    1. Revisar si el cambio es necesario — medir qué lo causó.');
    console.error('       `npm run build` y buscar chunks nuevos o más grandes.');
    console.error('    2. Si es justificado, documentar en PR description y correr:');
    console.error(
      '       `npm run bundle:baseline`',
    );
    console.error('       (commit el nuevo baseline.json junto con el PR).');
    console.error('    3. Si no es justificado, optimizar antes de mergear.');
    console.error('');
    // GitHub Actions annotation — aparece como error en el PR file view.
    console.error(
      `::error file=tools/bundle/baseline.json::Bundle delta excede threshold — ${failures.join(', ')}`,
    );
    process.exit(1);
  }

  console.log('✔ Bundle delta dentro del threshold (initial + totalJs).');
}

main();
