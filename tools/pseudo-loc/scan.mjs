#!/usr/bin/env node
// @ts-check
/**
 * Pseudo-localization scanner para templates Angular.
 *
 * **Mission**
 *
 * El 90% de los strings de UI de este repo viven hardcodeados en español
 * dentro de `.html` (solo dos marcadores `i18n=` en todo `src/app`).
 * Cuando llegue la traduccion a aleman/portugues, el +25-35% de
 * expansion de string-length va a romper containers fijos (botones con
 * `whitespace-nowrap`, columnas con `w-32`, etc.) que hoy lucen bien.
 *
 * Este script visibiliza el problema ANTES de pagar la traduccion real:
 *
 *   1. Recorre `src/app/**\/*.html` y `src/stories/**\/*.html` (skip
 *      node_modules, dist).
 *   2. Extrae nodos de texto visible (no atributos, no expresiones
 *      Angular, no markup decorativo como iconos).
 *   3. Aplica `pseudoLoc()` (transform.mjs) a cada string y mide la
 *      expansion en %.
 *   4. Emite `dist/pseudo-loc/report.md` con tabla: archivo | original |
 *      pseudo | delta %. El reporte va a `dist/` (gitignored) porque es
 *      artefacto de build, no source.
 *
 * **Por que parseo conservador con regex y no `@angular/compiler`**
 *
 * El parser de `@angular/compiler` resuelve perfectamente el AST de un
 * template (incluyendo decorators `@if`/`@for`, expresiones, ICU,
 * referencias). Es el parser correcto si esta disponible.
 *
 * Si NO esta (caso desarrollo con node_modules incompleto, o entorno
 * minimo de CI), se cae a un parseo basado en regex sobre nodos de
 * texto en formato `<elem>texto</elem>` y `</elem>texto<elem>`. Es
 * suficiente para v1: el goal es VISIBILIZAR, no extraer al 100%. Falsos
 * negativos (strings no detectados) se pueden enmendar con un i18n
 * extractor posterior; falsos positivos (extraer markup como si fuera
 * texto) se mitigan con un set de patrones de exclusion bien acotado.
 *
 * **Flags**
 *
 *   (sin flags)         genera reporte, exit 0 siempre.
 *   --ci                ademas, si hay >100 strings sin marker i18n,
 *                       exit 1 (umbral configurable via --threshold).
 *                       v1 preventivo, no bloqueante todavia.
 *   --threshold N       overrride del umbral (default 100).
 *   --apply <dir>       genera copia del directorio con strings
 *                       pseudo-localizadas (para pruebas manuales en
 *                       browser). No toca src/ real.
 *
 * **Exit codes**: 0 ok / 1 violacion de umbral (--ci) / 2 IO error.
 */

import {
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
  existsSync,
  mkdirSync,
} from 'node:fs';
import { resolve, relative, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { pseudoLoc } from './transform.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');

const DEFAULT_SCAN_ROOTS = [
  resolve(REPO_ROOT, 'src/app'),
  resolve(REPO_ROOT, 'src/stories'),
];
const REPORT_PATH = resolve(REPO_ROOT, 'dist/pseudo-loc/report.md');
const DEFAULT_THRESHOLD = 100;

// Carpetas que se saltean siempre — derivados de build o deps externas.
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', '.angular']);

// ───────────────────────────────────────────────────────────────────────
// CLI args
// ───────────────────────────────────────────────────────────────────────

/**
 * @param {string[]} argv
 * @returns {{ ci: boolean, threshold: number, applyDir: string | null, roots: string[] }}
 */
export function parseArgs(argv) {
  const opts = {
    ci: false,
    threshold: DEFAULT_THRESHOLD,
    /** @type {string | null} */
    applyDir: null,
    /** @type {string[]} */
    roots: [],
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--ci') opts.ci = true;
    else if (a === '--threshold') {
      const v = Number(argv[++i]);
      if (!Number.isFinite(v) || v < 0) {
        throw new Error(`--threshold espera un entero >= 0, recibido: ${argv[i]}`);
      }
      opts.threshold = Math.floor(v);
    } else if (a === '--apply') {
      const v = argv[++i];
      if (!v) throw new Error('--apply requiere un directorio destino');
      opts.applyDir = resolve(process.cwd(), v);
    } else if (a === '--root') {
      const v = argv[++i];
      if (!v) throw new Error('--root requiere un path');
      opts.roots.push(resolve(process.cwd(), v));
    } else if (a === '--help' || a === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Flag desconocida: ${a}`);
    }
  }
  if (opts.roots.length === 0) opts.roots = [...DEFAULT_SCAN_ROOTS];
  return opts;
}

function printHelp() {
  console.log(`pseudo-loc scan — genera reporte de strings hardcodeados.

Uso:
  node tools/pseudo-loc/scan.mjs [opciones]

Opciones:
  --ci                 Falla si hay > umbral strings sin marker i18n.
  --threshold N        Umbral de strings para --ci (default ${DEFAULT_THRESHOLD}).
  --apply <dir>        Genera copia pseudo-localizada en <dir>.
  --root <dir>         Override de roots a scanear (puede repetirse).
  -h, --help           Esta ayuda.

Reporte: dist/pseudo-loc/report.md`);
}

// ───────────────────────────────────────────────────────────────────────
// Filesystem walk
// ───────────────────────────────────────────────────────────────────────

/**
 * Walk recursivo que devuelve los `.html` bajo `dir`. Salta SKIP_DIRS.
 *
 * @param {string} dir
 * @returns {string[]}
 */
export function findHtmlFiles(dir) {
  /** @type {string[]} */
  const out = [];
  if (!existsSync(dir)) return out;
  const entries = readdirSync(dir);
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      out.push(...findHtmlFiles(full));
    } else if (st.isFile() && name.endsWith('.html')) {
      out.push(full);
    }
  }
  return out;
}

// ───────────────────────────────────────────────────────────────────────
// Template text extraction
// ───────────────────────────────────────────────────────────────────────

/**
 * Patrones de strings que se descartan despues de la extraccion porque
 * son ruido (no son strings de UI visibles para el usuario).
 */
const NOISE_FILTERS = [
  /^\s*$/, // solo whitespace
  /^[\s.,:;!?¿¡()\[\]{}\-—_]+$/, // solo puntuacion
  /^\s*\{\{[\s\S]*\}\}\s*$/, // solo interpolacion (sin texto literal)
  /^[\s\d]+$/, // solo numeros
  /^[\s&;#xA-Fa-f0-9]+;?$/, // solo entities sueltas
  // Control-flow Angular y bloques estructurales que aparecen entre tags:
  //   "@if (...)", "@for (...)", "} @else {", "@defer (...)", "@loading"
  // No son UI strings — son markup que el parser regex deja pasar.
  /^[\s}]*@(?:if|for|else|empty|switch|case|default|defer|placeholder|loading|error|let)\b/,
  /^[\s}]+$/, // solo cierres de bloque sueltos
];

/**
 * Extrae nodos de texto visible de un template. Estrategia conservadora
 * basada en regex que ignora:
 *
 *   - Contenido de `<script>`, `<style>`, comentarios `<!-- -->`
 *   - Atributos completos (no leemos contenido dentro de `<...>`)
 *   - Control-flow blocks de Angular (`@if`, `@for`, etc.) — el cuerpo
 *     `{ ... }` se descarta como markup; solo texto dentro de tags se
 *     extrae.
 *   - Tags self-closing y void elements (`<br/>`, `<input/>`)
 *
 * Devuelve cada texto con su numero de linea aproximado (1-based).
 *
 * @param {string} html
 * @returns {Array<{ text: string, line: number }>}
 */
export function extractTextNodes(html) {
  /** @type {Array<{ text: string, line: number }>} */
  const results = [];
  // Strip comentarios completos (no son visibles). Preservamos newlines
  // para que el conteo de lineas siga siendo razonable.
  const noComments = html.replace(/<!--[\s\S]*?-->/g, (m) =>
    m.replace(/[^\n]/g, ''),
  );
  // Strip <script> y <style> blocks (no son texto visible).
  const noScripts = noComments.replace(
    /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,
    (m) => m.replace(/[^\n]/g, ''),
  );

  // Match texto entre `>` y `<` (incluyendo el caso de inicio sin tag).
  // Esto es el "text node" basico. El primer tag del template se ignora
  // (no hay `>` antes de el).
  const textRe = />([^<]*)</g;
  let match;
  while ((match = textRe.exec(noScripts)) !== null) {
    const raw = match[1];
    if (!raw) continue;
    // Calcular linea aproximada (posicion del match en el source original).
    const upToMatch = noScripts.slice(0, match.index);
    const line = (upToMatch.match(/\n/g)?.length ?? 0) + 1;
    // Normalizar whitespace interno pero preservar el contenido.
    const text = raw.trim();
    if (text.length === 0) continue;
    if (NOISE_FILTERS.some((re) => re.test(text))) continue;
    results.push({ text, line });
  }
  return results;
}

// ───────────────────────────────────────────────────────────────────────
// Scan + report
// ───────────────────────────────────────────────────────────────────────

/**
 * Resultado por string analizado.
 *
 * @typedef {Object} StringEntry
 * @property {string} file       Path relativo al repo root.
 * @property {number} line       Linea aproximada (1-based).
 * @property {string} original   Texto original.
 * @property {string} pseudo     Texto pseudo-localizado.
 * @property {number} delta      Delta porcentual (pseudo vs original).
 * @property {boolean} hasI18n   True si el template tiene marker i18n=
 *                                en la linea (heuristica de proximidad).
 */

/**
 * Scanea cada root, aplica `pseudoLoc` por string, devuelve un array
 * plano de StringEntry. No emite IO de reporte aqui — la separacion deja
 * `scanRoots` testeable sin side effects.
 *
 * @param {string[]} roots
 * @returns {StringEntry[]}
 */
export function scanRoots(roots) {
  /** @type {StringEntry[]} */
  const out = [];
  for (const root of roots) {
    const files = findHtmlFiles(root);
    for (const file of files) {
      let source;
      try {
        source = readFileSync(file, 'utf8');
      } catch {
        continue;
      }
      const lines = source.split('\n');
      const nodes = extractTextNodes(source);
      for (const { text, line } of nodes) {
        const pseudo = pseudoLoc(text);
        const delta =
          text.length === 0
            ? 0
            : ((pseudo.length - text.length) / text.length) * 100;
        // Heuristica: hay marker `i18n=` en la misma linea o las dos
        // anteriores del template? Si si, el string esta opt-in al
        // pipeline de i18n.
        const start = Math.max(0, line - 3);
        const end = Math.min(lines.length, line);
        const window = lines.slice(start, end).join('\n');
        const hasI18n = /\bi18n(?:-[a-zA-Z]+)?(?:=|\b)/.test(window);
        out.push({
          file: relative(REPO_ROOT, file),
          line,
          original: text,
          pseudo,
          delta,
          hasI18n,
        });
      }
    }
  }
  return out;
}

/**
 * Compone el reporte markdown con el detalle por archivo.
 *
 * Formato: header de resumen, despues una tabla por archivo. Markdown
 * porque GitHub Pages lo renderiza nativo y los devs pueden ver el diff
 * de strings en una PR sin abrir el artefacto raw.
 *
 * @param {StringEntry[]} entries
 * @param {number} threshold
 * @returns {string}
 */
export function renderReport(entries, threshold) {
  const totalStrings = entries.length;
  const unmarked = entries.filter((e) => !e.hasI18n).length;
  const totalDelta =
    entries.reduce((acc, e) => acc + e.delta, 0) / Math.max(1, totalStrings);
  const maxEntry = entries.reduce(
    (best, e) => (e.delta > (best?.delta ?? -Infinity) ? e : best),
    /** @type {StringEntry | null} */ (null),
  );

  const lines = [];
  lines.push('# Pseudo-localization report');
  lines.push('');
  lines.push(`Generado: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('## Resumen');
  lines.push('');
  lines.push(`- Strings detectados: **${totalStrings}**`);
  lines.push(
    `- Strings sin marker \`i18n=\`: **${unmarked}** (umbral CI: ${threshold})`,
  );
  lines.push(`- Expansion promedio: **${totalDelta.toFixed(1)}%**`);
  if (maxEntry) {
    lines.push(
      `- Expansion maxima: **${maxEntry.delta.toFixed(1)}%** — \`${escapeMd(maxEntry.original)}\` en \`${maxEntry.file}:${maxEntry.line}\``,
    );
  }
  lines.push('');

  // Agrupar por archivo para legibilidad.
  /** @type {Map<string, StringEntry[]>} */
  const byFile = new Map();
  for (const e of entries) {
    const arr = byFile.get(e.file) ?? [];
    arr.push(e);
    byFile.set(e.file, arr);
  }
  const files = [...byFile.keys()].sort();

  lines.push('## Detalle por archivo');
  lines.push('');
  for (const file of files) {
    const fileEntries = /** @type {StringEntry[]} */ (byFile.get(file));
    lines.push(`### \`${file}\``);
    lines.push('');
    lines.push('| Linea | Original | Pseudo | Δ% | i18n |');
    lines.push('|------:|----------|--------|---:|:----:|');
    for (const e of fileEntries) {
      const tick = e.hasI18n ? '✓' : ' ';
      lines.push(
        `| ${e.line} | ${escapeMd(e.original)} | ${escapeMd(e.pseudo)} | ${e.delta.toFixed(0)}% | ${tick} |`,
      );
    }
    lines.push('');
  }
  return lines.join('\n');
}

/**
 * Escapa caracteres que rompen tablas markdown (`|`, newlines).
 *
 * @param {string} s
 * @returns {string}
 */
function escapeMd(s) {
  return s.replace(/\|/g, '\\|').replace(/\n/g, ' ').replace(/`/g, '\\`');
}

// ───────────────────────────────────────────────────────────────────────
// --apply: copia transformada
// ───────────────────────────────────────────────────────────────────────

/**
 * Genera una copia del/los root(s) con cada `.html` transformado por
 * pseudoLoc. Util para test manual en browser: `ng serve` apuntando al
 * dir generado, o copy-paste de un archivo a Storybook para ver
 * overflows.
 *
 * @param {string[]} roots
 * @param {string} destRoot
 */
export function applyTransform(roots, destRoot) {
  ensureDir(destRoot);
  for (const root of roots) {
    const files = findHtmlFiles(root);
    // El path dentro de dest replica la jerarquia RELATIVA AL ROOT scaneado,
    // no al repo. Asi un --apply funciona desde cualquier cwd y los temp
    // dirs de tests no terminan con paths `../../..` fuera del dest.
    const rootName = root.split(/[\\/]/).pop() ?? 'root';
    for (const file of files) {
      const relToRoot = relative(root, file);
      const dest = join(destRoot, rootName, relToRoot);
      ensureDir(dirname(dest));
      const source = readFileSync(file, 'utf8');
      // Reemplazo in-place de cada nodo de texto.
      const transformed = source.replace(/>([^<]+)</g, (full, raw) => {
        const text = raw;
        const trimmed = text.trim();
        if (trimmed.length === 0) return full;
        if (NOISE_FILTERS.some((re) => re.test(trimmed))) return full;
        // Preservar leading/trailing whitespace del nodo (no afecta
        // visualmente al render pero mantiene el diff legible).
        const leading = text.match(/^\s*/)?.[0] ?? '';
        const trailing = text.match(/\s*$/)?.[0] ?? '';
        return `>${leading}${pseudoLoc(trimmed)}${trailing}<`;
      });
      writeFileSync(dest, transformed);
    }
  }
}

/**
 * @param {string} path
 */
function ensureDir(path) {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

// ───────────────────────────────────────────────────────────────────────
// CLI entry
// ───────────────────────────────────────────────────────────────────────

/**
 * @param {string[]} argv
 */
export function main(argv) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (err) {
    console.error(`[pseudo-loc] ${/** @type {Error} */ (err).message}`);
    process.exit(2);
  }

  let entries;
  try {
    entries = scanRoots(opts.roots);
  } catch (err) {
    console.error(
      `[pseudo-loc] error leyendo templates: ${/** @type {Error} */ (err).message}`,
    );
    process.exit(2);
  }

  // Reporte siempre se escribe (artefacto de build).
  try {
    ensureDir(dirname(REPORT_PATH));
    writeFileSync(REPORT_PATH, renderReport(entries, opts.threshold));
  } catch (err) {
    console.error(
      `[pseudo-loc] error escribiendo reporte: ${/** @type {Error} */ (err).message}`,
    );
    process.exit(2);
  }

  console.log(
    `[pseudo-loc] ${entries.length} strings, reporte: ${relative(REPO_ROOT, REPORT_PATH)}`,
  );

  if (opts.applyDir) {
    try {
      applyTransform(opts.roots, opts.applyDir);
      console.log(
        `[pseudo-loc] copia pseudo-localizada en: ${relative(REPO_ROOT, opts.applyDir)}`,
      );
    } catch (err) {
      console.error(
        `[pseudo-loc] error en --apply: ${/** @type {Error} */ (err).message}`,
      );
      process.exit(2);
    }
  }

  if (opts.ci) {
    const unmarked = entries.filter((e) => !e.hasI18n).length;
    if (unmarked > opts.threshold) {
      console.error(
        `[pseudo-loc] ${unmarked} strings sin marker i18n (umbral: ${opts.threshold}).`,
      );
      console.error('  Revisar reporte y migrar a `i18n="..."` o subir umbral.');
      process.exit(1);
    }
  }

  process.exit(0);
}

// Run cuando se invoca directamente (no cuando se importa para tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2));
}
