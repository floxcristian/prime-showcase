// @ts-check
/**
 * Tests del adoption scanner.
 *
 * El scanner tiene tres responsabilidades testables aisladamente:
 *   1. Extractores (story title, component selector).
 *   2. Counter (countOpeningTags) — sensible a comentarios, self-closing,
 *      word boundaries.
 *   3. Pipeline end-to-end con fixtures en disco temporal.
 *
 * Las assertions cubren los edge cases listados en el spec:
 *   - múltiples stories con mismo title → se suman.
 *   - componente sin selector → no rompe.
 *   - comentarios HTML → no se cuentan.
 *   - self-closing + opening+closing → cuentan como 1 cada uno.
 *   - threshold de huérfanos → exit 1 cuando se viola.
 *
 * Run: `node --test tools/adoption/__tests__/scan.test.mjs`
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import {
  collectAdoption,
  countOpeningTags,
  extractComponentSelector,
  extractStoryTitle,
  findStoryForSelector,
  renderMarkdown,
  runCli,
} from '../scan.mjs';

// ───────────────────────────────────────────────────────────────────────
// Fixture builder — crea un mini-repo en /tmp con los paths que el scanner
// espera. Cada test pide solo los archivos que necesita.
// ───────────────────────────────────────────────────────────────────────

function makeRepo() {
  const root = mkdtempSync(join(tmpdir(), 'adoption-test-'));
  const write = (rel, content) => {
    const full = join(root, rel);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, content, 'utf8');
  };
  return { root, write, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

// ───────────────────────────────────────────────────────────────────────
// Extractores
// ───────────────────────────────────────────────────────────────────────

test('extractStoryTitle: lee title del meta default export', () => {
  const src = `
    const meta = {
      title: 'Primitives/Button',
      tags: ['autodocs'],
    };
    export default meta;
  `;
  assert.equal(extractStoryTitle(src), 'Primitives/Button');
});

test('extractStoryTitle: retorna null si no hay title (defensive)', () => {
  assert.equal(extractStoryTitle('export default {};'), null);
});

test('extractComponentSelector: lee selector del @Component decorator', () => {
  const src = `
    @Component({
      selector: 'app-empty-state',
      template: '<div></div>',
    })
    export class EmptyStateComponent {}
  `;
  assert.equal(extractComponentSelector(src), 'app-empty-state');
});

test('extractComponentSelector: retorna null si no hay selector (defensive)', () => {
  const src = `@Component({ template: '<div></div>' }) export class Foo {}`;
  assert.equal(extractComponentSelector(src), null);
});

// ───────────────────────────────────────────────────────────────────────
// Counter
// ───────────────────────────────────────────────────────────────────────

test('countOpeningTags: cuenta 1 por opening+closing y 1 por self-closing', () => {
  const html = `
    <app-foo></app-foo>
    <app-foo />
    <div><app-foo>nested</app-foo></div>
  `;
  assert.equal(countOpeningTags(html, 'app-foo'), 3);
});

test('countOpeningTags: ignora líneas con comentarios HTML', () => {
  const html = `
    <app-foo></app-foo>
    <!-- <app-foo></app-foo> -->
    <app-foo />
  `;
  assert.equal(countOpeningTags(html, 'app-foo'), 2);
});

test('countOpeningTags: word-boundary — no matchea <app-foobar como <app-foo', () => {
  const html = `<app-foo></app-foo><app-foobar></app-foobar>`;
  assert.equal(countOpeningTags(html, 'app-foo'), 1);
  assert.equal(countOpeningTags(html, 'app-foobar'), 1);
});

// ───────────────────────────────────────────────────────────────────────
// Story matching
// ───────────────────────────────────────────────────────────────────────

test('findStoryForSelector: matchea por última parte del title normalizada', () => {
  const stories = ['Primitives/Empty State', 'Primitives/Button', 'Recipes/Page Header'];
  assert.equal(findStoryForSelector('app-empty-state', stories), 'Primitives/Empty State');
  assert.equal(findStoryForSelector('app-button', stories), 'Primitives/Button');
  assert.equal(findStoryForSelector('app-unmatched', stories), null);
});

// ───────────────────────────────────────────────────────────────────────
// Pipeline end-to-end con fixtures
// ───────────────────────────────────────────────────────────────────────

test('collectAdoption: cuenta uso real de un shared component', () => {
  const repo = makeRepo();
  try {
    repo.write(
      'src/stories/primitives/Button.stories.ts',
      `const meta = { title: 'Primitives/Button' }; export default meta;`,
    );
    repo.write(
      'src/app/shared/components/empty-state/empty-state.component.ts',
      `@Component({ selector: 'app-empty-state', template: '' }) export class C {}`,
    );
    repo.write(
      'src/app/modules/customers/customers.component.html',
      `<app-empty-state></app-empty-state><app-empty-state />`,
    );
    repo.write(
      'src/app/modules/chat/chat.component.html',
      `<app-empty-state />`,
    );

    const data = collectAdoption(repo.root);
    const emptyState = data.sharedUsage.find((u) => u.selector === 'app-empty-state');
    assert.ok(emptyState, 'empty-state debe estar en sharedUsage');
    assert.equal(emptyState.total, 3);
    assert.equal(emptyState.topModules.length, 2);
    assert.deepEqual(
      emptyState.topModules.map((m) => m.module).sort(),
      ['chat', 'customers'],
    );
  } finally {
    repo.cleanup();
  }
});

test('collectAdoption: detecta huérfanos (shared con 0 uses)', () => {
  const repo = makeRepo();
  try {
    repo.write(
      'src/app/shared/components/unused-widget/unused-widget.component.ts',
      `@Component({ selector: 'app-unused-widget', template: '' }) export class C {}`,
    );
    repo.write(
      'src/app/shared/components/used-widget/used-widget.component.ts',
      `@Component({ selector: 'app-used-widget', template: '' }) export class C {}`,
    );
    repo.write(
      'src/app/modules/foo/foo.component.html',
      `<app-used-widget />`,
    );

    const data = collectAdoption(repo.root);
    assert.equal(data.orphans.length, 1);
    assert.equal(data.orphans[0].selector, 'app-unused-widget');
  } finally {
    repo.cleanup();
  }
});

test('collectAdoption: stories con mismo title se agrupan/suman', () => {
  const repo = makeRepo();
  try {
    repo.write(
      'src/stories/primitives/Button.stories.ts',
      `const meta = { title: 'Primitives/Button' }; export default meta;`,
    );
    repo.write(
      'src/stories/primitives/ButtonExtra.stories.ts',
      `const meta = { title: 'Primitives/Button' }; export default meta;`,
    );
    repo.write(
      'src/stories/recipes/PageHeader.stories.ts',
      `const meta = { title: 'Recipes/Page Header' }; export default meta;`,
    );

    const data = collectAdoption(repo.root);
    // Dos titles únicos a pesar de tres archivos.
    assert.equal(data.totals.stories, 2);
    assert.equal(data.storyCounts['Primitives/Button'], 2);
    assert.equal(data.storyCounts['Recipes/Page Header'], 1);
  } finally {
    repo.cleanup();
  }
});

test('collectAdoption: comentarios HTML no se cuentan como uso real', () => {
  const repo = makeRepo();
  try {
    repo.write(
      'src/app/shared/components/foo/foo.component.ts',
      `@Component({ selector: 'app-foo', template: '' }) export class C {}`,
    );
    repo.write(
      'src/app/modules/m1/m1.component.html',
      `<!-- <app-foo></app-foo> --><app-foo />`,
    );

    const data = collectAdoption(repo.root);
    const foo = data.sharedUsage.find((u) => u.selector === 'app-foo');
    assert.equal(foo.total, 1, 'el comentado no cuenta, solo el real');
  } finally {
    repo.cleanup();
  }
});

test('collectAdoption: stories dentro de src/stories no cuentan como uso real', () => {
  const repo = makeRepo();
  try {
    repo.write(
      'src/app/shared/components/foo/foo.component.ts',
      `@Component({ selector: 'app-foo', template: '' }) export class C {}`,
    );
    // Archivo .html dentro de stories — NO debería contarse.
    repo.write('src/stories/primitives/demo.html', `<app-foo />`);

    const data = collectAdoption(repo.root);
    const foo = data.sharedUsage.find((u) => u.selector === 'app-foo');
    assert.equal(foo.total, 0);
  } finally {
    repo.cleanup();
  }
});

test('collectAdoption: detecta PrimeNG primitives via <p-xxx', () => {
  const repo = makeRepo();
  try {
    repo.write(
      'src/app/modules/m1/m1.component.html',
      `<p-button label="X"></p-button><p-button /><p-table></p-table>`,
    );

    const data = collectAdoption(repo.root);
    const button = data.primeUsage.find((u) => u.component === 'button');
    const table = data.primeUsage.find((u) => u.component === 'table');
    assert.equal(button.total, 2);
    assert.equal(table.total, 1);
  } finally {
    repo.cleanup();
  }
});

// ───────────────────────────────────────────────────────────────────────
// CLI: threshold + exit codes
// ───────────────────────────────────────────────────────────────────────

test('runCli: exit 1 cuando --threshold-orphans se viola', () => {
  const repo = makeRepo();
  try {
    // Cuatro huérfanos, umbral 2 → fail.
    for (const name of ['a', 'b', 'c', 'd']) {
      repo.write(
        `src/app/shared/components/${name}/${name}.component.ts`,
        `@Component({ selector: 'app-${name}', template: '' }) export class C {}`,
      );
    }
    // Sin templates que los consuman.

    const logs = [];
    const errors = [];
    const code = runCli({
      repoRoot: repo.root,
      args: ['--threshold-orphans', '2'],
      log: (m) => logs.push(m),
      error: (m) => errors.push(m),
    });
    assert.equal(code, 1);
    assert.ok(
      errors.some((e) => e.includes('FAIL')),
      'debe emitir mensaje de FAIL',
    );
  } finally {
    repo.cleanup();
  }
});

test('runCli: exit 0 cuando huérfanos <= threshold', () => {
  const repo = makeRepo();
  try {
    repo.write(
      'src/app/shared/components/used/used.component.ts',
      `@Component({ selector: 'app-used', template: '' }) export class C {}`,
    );
    repo.write(
      'src/app/shared/components/orphan/orphan.component.ts',
      `@Component({ selector: 'app-orphan', template: '' }) export class C {}`,
    );
    repo.write('src/app/modules/m1/m1.component.html', `<app-used />`);

    const code = runCli({
      repoRoot: repo.root,
      args: ['--threshold-orphans', '5'],
      log: () => {},
      error: () => {},
    });
    assert.equal(code, 0);
  } finally {
    repo.cleanup();
  }
});

test('runCli: --json emite también report.json', () => {
  const repo = makeRepo();
  try {
    repo.write(
      'src/app/shared/components/x/x.component.ts',
      `@Component({ selector: 'app-x', template: '' }) export class C {}`,
    );
    repo.write('src/app/modules/m1/m1.component.html', `<app-x />`);

    const code = runCli({
      repoRoot: repo.root,
      args: ['--json'],
      log: () => {},
      error: () => {},
    });
    assert.equal(code, 0);
    const jsonPath = resolve(repo.root, 'dist/adoption/report.json');
    assert.ok(existsSync(jsonPath));
    const parsed = JSON.parse(readFileSync(jsonPath, 'utf8'));
    assert.equal(parsed.totals.sharedComponents, 1);
  } finally {
    repo.cleanup();
  }
});

test('renderMarkdown: incluye las cuatro secciones esperadas', () => {
  const data = {
    stories: ['Primitives/Button'],
    storyCounts: { 'Primitives/Button': 1 },
    sharedSelectors: [{ selector: 'app-foo', file: 'src/app/shared/components/foo/foo.component.ts' }],
    sharedUsage: [
      { selector: 'app-foo', story: null, total: 2, topModules: [{ module: 'm1', count: 2 }] },
    ],
    primeUsage: [
      { component: 'button', total: 5, topModules: [{ module: 'm1', count: 5 }] },
    ],
    orphans: [],
    lowAdoptionModules: [{ module: 'm1', sharedUses: 2 }],
    totals: { stories: 1, sharedComponents: 1, occurrences: 7 },
  };
  const md = renderMarkdown(data);
  assert.ok(md.includes('# Adoption metrics'));
  assert.ok(md.includes('## Adopción de componentes compartidos'));
  assert.ok(md.includes('## Adopción de PrimeNG primitives'));
  assert.ok(md.includes('## Componentes con 0 uses'));
  assert.ok(md.includes('## Módulos con menor adopción'));
  assert.ok(md.includes('`<p-button>`'));
});
