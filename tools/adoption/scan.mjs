#!/usr/bin/env node
/**
 * Adoption metrics scanner — mide consumo real del design system.
 *
 * **Misión**
 *
 * Polaris (Shopify), Carbon (IBM) y Spectrum (Adobe) publican métricas
 * de adopción de cada primitivo y receta para detectar dos patologías:
 *
 *   1. Componentes "huérfanos": viven en el catálogo pero nadie los
 *      consume. Síntoma de design system bloat — alguien los pidió,
 *      nadie los adoptó, y nadie los retira.
 *   2. Módulos que reinventan la rueda: features que ignoran las
 *      primitivas compartidas y reimplementan patrones inline.
 *      Síntoma de drift visual y mantenimiento duplicado.
 *
 * Este script aplica la misma idea, scoped al repo:
 *
 *   1. Escanea `src/stories/**\/*.stories.ts` y extrae el `title` del
 *      meta export default — esto da el namespace de cada story
 *      (`Primitives/Button`, `Recipes/Page Header`).
 *   2. Escanea `src/app/shared/components/**\/*.component.ts` y extrae
 *      el `selector` del decorator `@Component` — esto da los custom
 *      components compartidos (`app-empty-state`, `app-metric-card`).
 *   3. Escanea `src/app/modules/**\/*.html` y `src/app/layouts/**\/*.html`
 *      contando `<app-xxx` (custom) y `<p-xxx` (PrimeNG) — esto da el
 *      uso real. Los .html dentro de `src/stories/` NO cuentan, son
 *      demos del catálogo.
 *   4. Emite `dist/adoption/report.md` con cuatro secciones:
 *      a) Adoption de componentes compartidos (selector → ocurrencias).
 *      b) Adoption de PrimeNG primitives (componente → ocurrencias).
 *      c) Componentes con 0 uses (huérfanos).
 *      d) Módulos con menor adopción (reinventores).
 *      Opcionalmente `report.json` con el flag `--json`.
 *
 * **Por qué regex y no AST**
 *
 * El nivel de granularidad — "¿cuántas veces aparece `<app-empty-state` en
 * cada módulo?" — no requiere parsing. Regex sobre opening tags es
 * suficientemente preciso. AST parsing duplicaría runtime sin mover la
 * señal. Sí cuidamos comentarios HTML (skip lines con `<!--`) y los
 * self-closing tags (cuentan como 1, igual que opening+closing).
 *
 * **Exit codes**: 0 ok · 1 threshold de huérfanos violado · 2 error de IO.
 *
 * Uso:
 *   `node tools/adoption/scan.mjs`                          — report markdown
 *   `node tools/adoption/scan.mjs --json`                   — md + json
 *   `node tools/adoption/scan.mjs --threshold-orphans 3`    — gate CI
 */

import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { resolve, relative, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DEFAULT_REPO_ROOT = resolve(__dirname, '..', '..');

// ───────────────────────────────────────────────────────────────────────
// Lista hardcoded de los 30 primitivos PrimeNG más usados en el proyecto.
// Source: revisar imports en src/app/modules/**/*.component.ts y
// `.claude/rules/primeng-patterns.md`. Mantener ordenado alfabéticamente
// para que diffs sean legibles.
// ───────────────────────────────────────────────────────────────────────
export const PRIMENG_COMPONENTS = [
  'autoComplete',
  'avatar',
  'badge',
  'button',
  'carousel',
  'chart',
  'checkbox',
  'confirmdialog',
  'datepicker',
  'dialog',
  'divider',
  'fileupload',
  'iconfield',
  'inputicon',
  'inputnumber',
  'inputotp',
  'menu',
  'metergroup',
  'multiselect',
  'overlayBadge',
  'popover',
  'progressbar',
  'radiobutton',
  'select',
  'selectbutton',
  'skeleton',
  'slider',
  'table',
  'tag',
  'textarea',
  'toast',
  'toggleswitch',
  'tooltip',
];

// ───────────────────────────────────────────────────────────────────────
// Helpers de filesystem — walk recursivo simple sin glob deps.
// ───────────────────────────────────────────────────────────────────────

/**
 * Walk recursivo que retorna todos los archivos dentro de `dir` cuyo path
 * matchea el predicado `match`. Si `dir` no existe, retorna [] (no falla).
 */
export function walkFiles(dir, match) {
  if (!existsSync(dir)) return [];
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    const entries = readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        // Skip node_modules y dirs ocultos
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
        stack.push(full);
      } else if (entry.isFile() && match(full)) {
        out.push(full);
      }
    }
  }
  return out.sort();
}

// ───────────────────────────────────────────────────────────────────────
// Extractores: story title, selector de @Component.
// ───────────────────────────────────────────────────────────────────────

/**
 * Extrae el valor de `title:` del meta export default de una story.
 * Defensive: si el archivo no tiene title, retorna null.
 */
export function extractStoryTitle(source) {
  // Busca `title: 'foo'` o `title: "foo"`. Toma el primer match — el meta
  // siempre es lo primero declarado en Storybook.
  const match = source.match(/title\s*:\s*['"]([^'"]+)['"]/);
  return match ? match[1] : null;
}

/**
 * Extrae el selector del primer decorator `@Component({ selector: '...' })`
 * de un archivo de componente. Defensive: si no hay selector retorna null
 * (componentes shared sin selector rara vez existen, pero un wrapper
 * abstract podría no tenerlo).
 */
export function extractComponentSelector(source) {
  const match = source.match(/@Component\s*\(\s*\{[^}]*?selector\s*:\s*['"]([^'"]+)['"]/s);
  return match ? match[1] : null;
}

// ───────────────────────────────────────────────────────────────────────
// Contador de ocurrencias por opening tag.
// ───────────────────────────────────────────────────────────────────────

/**
 * Cuenta opening tags `<prefix-name` en un HTML string, ignorando
 * comentarios HTML. Estrategia en dos pasos:
 *
 *   1. Strip de comentarios bien-formados (`<!-- ... -->`) — incluso
 *      multi-línea — con regex DOTALL. Cubre el caso `<!-- <app-x> -->`
 *      donde el tag y el cierre del comentario viven en la misma línea.
 *   2. Para comentarios mal-cerrados o líneas sueltas que contienen
 *      `<!--` (e.g. comentado a mano sin `-->` en la misma línea),
 *      descartamos la línea entera como salvaguarda — heurística aceptada
 *      en el spec.
 *
 * El tag debe terminar en límite de palabra (siguiente char no es letra,
 * número ni guión) para evitar matches parciales (`<app-foo` NO matchea
 * `<app-foobar`).
 */
export function countOpeningTags(html, tagName) {
  // Paso 1: strip comentarios completos.
  const stripped = html.replace(/<!--[\s\S]*?-->/g, '');

  // Escapar caracteres especiales del nombre por si vienen con guiones.
  const escaped = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Lookahead que asegura word-boundary del tag (siguiente char no es
  // letra, número ni guión).
  const re = new RegExp(`<${escaped}(?![a-zA-Z0-9-])`, 'g');
  let count = 0;
  const lines = stripped.split('\n');
  for (const line of lines) {
    // Paso 2: salvaguarda contra comentario sin cerrar en la misma línea.
    if (line.includes('<!--')) continue;
    const matches = line.match(re);
    if (matches) count += matches.length;
  }
  return count;
}

// ───────────────────────────────────────────────────────────────────────
// Mapeo selector → story namespace (best-effort).
// ───────────────────────────────────────────────────────────────────────

/**
 * Heurística para asociar un selector compartido (`app-empty-state`) con
 * una story (`Primitives/Empty State`). Compara la parte después de
 * `app-` con la última parte del title normalizada. Si no hay match,
 * devuelve null y el report lo muestra como "(sin story)".
 */
export function findStoryForSelector(selector, stories) {
  const normalized = selector.replace(/^app-/, '').replace(/-/g, '').toLowerCase();
  for (const story of stories) {
    const tail = story.split('/').pop() ?? '';
    const tailNormalized = tail.replace(/[\s-]/g, '').toLowerCase();
    if (tailNormalized === normalized) return story;
  }
  return null;
}

// ───────────────────────────────────────────────────────────────────────
// Identificar el módulo de un path de template.
// ───────────────────────────────────────────────────────────────────────

/**
 * Dado un path de template (`src/app/modules/customers/customers.component.html`)
 * retorna el segmento del módulo (`customers`). Para layouts retorna
 * `layouts/<nombre>` para distinguirlos de features.
 */
export function moduleNameFromPath(filePath, repoRoot) {
  const rel = relative(repoRoot, filePath).split(sep).join('/');
  const modMatch = rel.match(/src\/app\/modules\/([^/]+)\//);
  if (modMatch) return modMatch[1];
  const layoutMatch = rel.match(/src\/app\/layouts\/([^/]+)\//);
  if (layoutMatch) return `layouts/${layoutMatch[1]}`;
  return rel;
}

// ───────────────────────────────────────────────────────────────────────
// Pipeline principal — colectar datos.
// ───────────────────────────────────────────────────────────────────────

/**
 * Ejecuta el scan completo y retorna la data estructurada. No escribe
 * archivos — eso es responsabilidad del CLI. Esta separación facilita
 * los tests unitarios.
 */
export function collectAdoption(repoRoot) {
  // 1. Stories
  const storiesDir = resolve(repoRoot, 'src/stories');
  const storyFiles = walkFiles(storiesDir, (p) => p.endsWith('.stories.ts'));
  // Multiple stories con mismo title se suman: usamos un Map para acumular.
  const storyCounts = new Map(); // title → count de archivos
  for (const file of storyFiles) {
    const src = readFileSync(file, 'utf8');
    const title = extractStoryTitle(src);
    if (title) {
      storyCounts.set(title, (storyCounts.get(title) ?? 0) + 1);
    }
  }
  const stories = Array.from(storyCounts.keys()).sort();

  // 2. Shared components
  const sharedDir = resolve(repoRoot, 'src/app/shared/components');
  const sharedFiles = walkFiles(sharedDir, (p) => p.endsWith('.component.ts'));
  const sharedSelectors = []; // [{ selector, file }]
  for (const file of sharedFiles) {
    const src = readFileSync(file, 'utf8');
    const selector = extractComponentSelector(src);
    if (selector) {
      sharedSelectors.push({ selector, file });
    }
  }
  sharedSelectors.sort((a, b) => a.selector.localeCompare(b.selector));

  // 3. Uso real en modules + layouts
  const modulesDir = resolve(repoRoot, 'src/app/modules');
  const layoutsDir = resolve(repoRoot, 'src/app/layouts');
  const templateFiles = [
    ...walkFiles(modulesDir, (p) => p.endsWith('.html')),
    ...walkFiles(layoutsDir, (p) => p.endsWith('.html')),
  ];

  // Map: selector → { total, byModule: Map<module, count> }
  const sharedUsage = new Map();
  for (const { selector } of sharedSelectors) {
    sharedUsage.set(selector, { total: 0, byModule: new Map() });
  }
  // Map: prime component → { total, byModule: Map<module, count> }
  const primeUsage = new Map();
  for (const comp of PRIMENG_COMPONENTS) {
    primeUsage.set(comp, { total: 0, byModule: new Map() });
  }
  // Para "módulos con menor adopción": cuántos shared+prime usa cada módulo.
  const moduleSharedCounts = new Map();

  for (const file of templateFiles) {
    const html = readFileSync(file, 'utf8');
    const mod = moduleNameFromPath(file, repoRoot);
    // Excluir layouts del scoring de "módulos" — son chrome, no features.
    const isLayout = mod.startsWith('layouts/');

    for (const { selector } of sharedSelectors) {
      const count = countOpeningTags(html, selector);
      if (count > 0) {
        const entry = sharedUsage.get(selector);
        entry.total += count;
        entry.byModule.set(mod, (entry.byModule.get(mod) ?? 0) + count);
        if (!isLayout) {
          moduleSharedCounts.set(mod, (moduleSharedCounts.get(mod) ?? 0) + count);
        }
      }
    }

    for (const comp of PRIMENG_COMPONENTS) {
      const count = countOpeningTags(html, `p-${comp}`);
      if (count > 0) {
        const entry = primeUsage.get(comp);
        entry.total += count;
        entry.byModule.set(mod, (entry.byModule.get(mod) ?? 0) + count);
      }
    }
  }

  // 4. Identificar todos los módulos (features) que tienen al menos un
  // template — para detectar los que tienen 0 uso de shared.
  const allModules = new Set();
  for (const file of templateFiles) {
    const mod = moduleNameFromPath(file, repoRoot);
    if (!mod.startsWith('layouts/')) allModules.add(mod);
  }
  for (const mod of allModules) {
    if (!moduleSharedCounts.has(mod)) moduleSharedCounts.set(mod, 0);
  }

  // 5. Total de ocurrencias (shared + prime) para el header del report.
  let totalOccurrences = 0;
  for (const { total } of sharedUsage.values()) totalOccurrences += total;
  for (const { total } of primeUsage.values()) totalOccurrences += total;

  // 6. Huérfanos: shared con total === 0.
  const orphans = sharedSelectors
    .filter(({ selector }) => sharedUsage.get(selector).total === 0)
    .map(({ selector, file }) => ({
      selector,
      file: relative(repoRoot, file).split(sep).join('/'),
    }));

  // 7. Módulos con menor adopción — bottom 3 ordenados ASC por count.
  const lowAdoptionModules = Array.from(moduleSharedCounts.entries())
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([module, count]) => ({ module, sharedUses: count }));

  return {
    stories,
    storyCounts: Object.fromEntries(storyCounts),
    sharedSelectors: sharedSelectors.map(({ selector, file }) => ({
      selector,
      file: relative(repoRoot, file).split(sep).join('/'),
    })),
    sharedUsage: Array.from(sharedUsage.entries()).map(([selector, data]) => {
      const story = findStoryForSelector(selector, stories);
      const topModules = Array.from(data.byModule.entries())
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 5)
        .map(([module, count]) => ({ module, count }));
      return { selector, story, total: data.total, topModules };
    }),
    primeUsage: Array.from(primeUsage.entries())
      .map(([component, data]) => {
        const topModules = Array.from(data.byModule.entries())
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
          .slice(0, 3)
          .map(([module, count]) => ({ module, count }));
        return { component, total: data.total, topModules };
      })
      .filter((e) => e.total > 0)
      .sort((a, b) => b.total - a.total || a.component.localeCompare(b.component)),
    orphans,
    lowAdoptionModules,
    totals: {
      stories: stories.length,
      sharedComponents: sharedSelectors.length,
      occurrences: totalOccurrences,
    },
  };
}

// ───────────────────────────────────────────────────────────────────────
// Renderers — markdown y JSON.
// ───────────────────────────────────────────────────────────────────────

/**
 * Convierte el data del scan en markdown listo para commit/PR comment.
 * Mantenido determinístico (sin timestamps, sin random) para que el
 * report sea diff-friendly entre runs.
 */
export function renderMarkdown(data) {
  const lines = [];
  lines.push('# Adoption metrics — PrimeNG Showcase');
  lines.push('');
  lines.push(
    'Reporte generado por `tools/adoption/scan.mjs`. Mide consumo real de primitivos del design system en `src/app/modules/` y `src/app/layouts/`.',
  );
  lines.push('');
  lines.push('## Totales');
  lines.push('');
  lines.push(`- **Stories en catálogo**: ${data.totals.stories}`);
  lines.push(`- **Componentes compartidos**: ${data.totals.sharedComponents}`);
  lines.push(`- **Ocurrencias totales (shared + PrimeNG)**: ${data.totals.occurrences}`);
  lines.push('');

  // Tabla 1 — shared
  lines.push('## Adopción de componentes compartidos');
  lines.push('');
  lines.push('| Selector | Story | Ocurrencias | Módulos donde aparece (top 5) |');
  lines.push('| --- | --- | ---: | --- |');
  for (const row of data.sharedUsage) {
    const story = row.story ?? '_(sin story)_';
    const mods = row.topModules.length
      ? row.topModules.map((m) => `${m.module} (${m.count})`).join(', ')
      : '—';
    lines.push(`| \`${row.selector}\` | ${story} | ${row.total} | ${mods} |`);
  }
  lines.push('');

  // Tabla 2 — PrimeNG
  lines.push('## Adopción de PrimeNG primitives');
  lines.push('');
  if (data.primeUsage.length === 0) {
    lines.push('_(ningún componente PrimeNG detectado)_');
  } else {
    lines.push('| Componente | Ocurrencias | Top 3 módulos |');
    lines.push('| --- | ---: | --- |');
    for (const row of data.primeUsage) {
      const mods = row.topModules.map((m) => `${m.module} (${m.count})`).join(', ');
      lines.push(`| \`<p-${row.component}>\` | ${row.total} | ${mods} |`);
    }
  }
  lines.push('');

  // Sección 3 — huérfanos
  lines.push('## Componentes con 0 uses (huérfanos)');
  lines.push('');
  if (data.orphans.length === 0) {
    lines.push('Ninguno. Todos los compartidos tienen al menos un consumer.');
  } else {
    lines.push(
      'Red flag: estos componentes existen en `src/app/shared/components/` pero ningún módulo los consume. Candidatos a deprecar o re-evangelizar.',
    );
    lines.push('');
    for (const o of data.orphans) {
      lines.push(`- \`${o.selector}\` — \`${o.file}\``);
    }
  }
  lines.push('');

  // Sección 4 — módulos con menor adopción
  lines.push('## Módulos con menor adopción');
  lines.push('');
  if (data.lowAdoptionModules.length === 0) {
    lines.push('_(sin datos suficientes)_');
  } else {
    lines.push(
      'Red flag: los 3 módulos con menos consumo de primitivos compartidos. Probable: están reimplementando patrones inline en vez de usar el catálogo.',
    );
    lines.push('');
    lines.push('| Módulo | Usos de shared components |');
    lines.push('| --- | ---: |');
    for (const m of data.lowAdoptionModules) {
      lines.push(`| ${m.module} | ${m.sharedUses} |`);
    }
  }
  lines.push('');
  return lines.join('\n');
}

// ───────────────────────────────────────────────────────────────────────
// CLI entry point.
// ───────────────────────────────────────────────────────────────────────

/**
 * Punto de entrada CLI. Aislado en función para que los tests puedan
 * ejercitarlo con repoRoot custom (fixtures temporales) sin tocar el
 * disco real ni process.exit.
 */
export function runCli({ repoRoot, args, log = console.log, error = console.error } = {}) {
  const root = repoRoot ?? DEFAULT_REPO_ROOT;
  const argv = args ?? process.argv.slice(2);
  const wantsJson = argv.includes('--json');
  const thresholdIdx = argv.indexOf('--threshold-orphans');
  const threshold =
    thresholdIdx >= 0 && argv[thresholdIdx + 1] !== undefined
      ? Number.parseInt(argv[thresholdIdx + 1], 10)
      : null;

  let data;
  try {
    data = collectAdoption(root);
  } catch (err) {
    error(`[adoption] error de IO: ${err.message}`);
    return 2;
  }

  const md = renderMarkdown(data);
  const outDir = resolve(root, 'dist/adoption');
  try {
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    writeFileSync(resolve(outDir, 'report.md'), md, 'utf8');
    if (wantsJson) {
      writeFileSync(
        resolve(outDir, 'report.json'),
        JSON.stringify(data, null, 2),
        'utf8',
      );
    }
  } catch (err) {
    error(`[adoption] no se pudo escribir report: ${err.message}`);
    return 2;
  }

  log(
    `[adoption] ${data.totals.stories} stories · ${data.totals.sharedComponents} shared · ${data.totals.occurrences} ocurrencias · ${data.orphans.length} huérfanos`,
  );
  log(`[adoption] report → ${relative(root, resolve(outDir, 'report.md'))}`);
  if (wantsJson) {
    log(`[adoption] json   → ${relative(root, resolve(outDir, 'report.json'))}`);
  }

  if (threshold !== null && Number.isFinite(threshold)) {
    if (data.orphans.length > threshold) {
      error(
        `[adoption] FAIL: ${data.orphans.length} huérfanos > umbral ${threshold}. Componentes: ${data.orphans
          .map((o) => o.selector)
          .join(', ')}`,
      );
      return 1;
    }
  }
  return 0;
}

// Solo ejecutar si fue invocado como CLI (no cuando los tests lo importan).
const invokedAsCli =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith('scan.mjs');

if (invokedAsCli) {
  process.exit(runCli());
}
