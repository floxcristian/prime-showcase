import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { TableModule } from 'primeng/table';
import { Avatar } from 'primeng/avatar';
import { Tag } from 'primeng/tag';
import { Button } from 'primeng/button';

/**
 * Canonical data-table recipe. Wraps `<p-table>` with the project's
 * design-token configuration: `[dt]=tableTokens`, scrollable / paginated,
 * paginator transparent. Used in `customers` and `overview`.
 *
 * Spec: `.claude/rules/primeng-patterns.md` § Tablas + DESIGN.md
 * § Layout (multi-panel headers use the same `p-4 border-b border-surface`
 * pattern in `<ng-template #caption>`).
 */

interface DataRow {
  id: number;
  name: string;
  initials: string;
  email: string;
  status: 'Active' | 'Inactive' | 'Pending';
}

const SAMPLE_ROWS: DataRow[] = [
  { id: 1001, name: 'Cody Fisher', initials: 'CF', email: 'cody@empresa.cl', status: 'Active' },
  { id: 1002, name: 'Esther Howard', initials: 'EH', email: 'esther@empresa.cl', status: 'Pending' },
  { id: 1003, name: 'Jerome Bell', initials: 'JB', email: 'jerome@empresa.cl', status: 'Inactive' },
  { id: 1004, name: 'Kristin Watson', initials: 'KW', email: 'kristin@empresa.cl', status: 'Active' },
  { id: 1005, name: 'Ronald Richards', initials: 'RR', email: 'ronald@empresa.cl', status: 'Active' },
];

// Same dt tokens the customers module ships. Kept inline here so the
// story is self-contained — reviewers can copy-paste this object as the
// starting point for a new module.
const tableTokens = {
  bodyCell: { padding: '1rem' },
  headerCell: { padding: '1rem' },
  paginatorBottomBorderWidth: '0',
  paginatorTopBorderWidth: '0',
};

const meta: Meta = {
  title: 'Recipes/Data Table',
  tags: ['autodocs'],
  decorators: [moduleMetadata({ imports: [TableModule, Avatar, Tag, Button] })],
  parameters: {
    docs: {
      description: {
        component: [
          '`<p-table>` with the project\'s canonical design-token wiring.',
          'Every data list / dashboard table in the app uses this shape:',
          '',
          '  - `[dt]=tableTokens` overrides padding so cells align with the',
          '    16px chrome spacing scale.',
          '  - `scrollable` + `scrollHeight="flex"` so the table grows to its',
          '    container and the paginator stays anchored to the bottom.',
          '  - `paginatorStyleClass="!bg-transparent"` removes the paginator',
          '    background so it inherits the parent surface.',
          '  - Tags for status use `severity` mapping (success / warn /',
          '    danger) — no hex strings.',
        ].join(' '),
      },
    },
  },
};
export default meta;
type Story = StoryObj;

/**
 * Plain data table. Pagination on, 3 rows per page so the paginator is
 * always visible in the story preview.
 */
export const Basic: Story = {
  render: () => ({
    props: {
      rows: SAMPLE_ROWS,
      tableTokens,
      severityFor: (status: DataRow['status']) =>
        status === 'Active' ? 'success' : status === 'Pending' ? 'warn' : 'danger',
    },
    template: `
      <div class="border border-surface rounded-2xl overflow-hidden max-w-4xl">
        <p-table
          [value]="rows"
          [dt]="tableTokens"
          [paginator]="true"
          [rows]="3"
          [showCurrentPageReport]="true"
          currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords}"
          [tableStyle]="{ 'min-width': '40rem' }"
          paginatorStyleClass="!bg-transparent"
        >
          <ng-template #header>
            <tr>
              <th class="w-1/12">Id</th>
              <th class="w-5/12">Cliente</th>
              <th class="w-4/12">Email</th>
              <th class="w-2/12">Estado</th>
            </tr>
          </ng-template>
          <ng-template #body let-row>
            <tr>
              <td class="w-1/12">
                <div class="text-muted-color">{{ row.id }}</div>
              </td>
              <td class="w-5/12">
                <div class="flex items-center gap-2">
                  <p-avatar [label]="row.initials" shape="circle" styleClass="!bg-primary-100 !text-primary-950" />
                  <div class="text-color font-medium leading-6">{{ row.name }}</div>
                </div>
              </td>
              <td class="w-4/12">
                <div class="text-muted-color leading-6">{{ row.email }}</div>
              </td>
              <td class="w-2/12">
                <p-tag [value]="row.status" [severity]="severityFor(row.status)" styleClass="font-medium" />
              </td>
            </tr>
          </ng-template>
        </p-table>
      </div>
    `,
  }),
};

/**
 * Data table with `#caption` toolbar — bulk actions + search field.
 * The pattern customers / overview / inbox use when a list needs filtering.
 */
export const WithCaptionToolbar: Story = {
  parameters: {
    docs: {
      description: {
        story:
          '`<ng-template #caption>` replaces the table header with a ' +
          'toolbar bar: bulk actions on the left, search on the right. ' +
          'Layout: `flex xl:items-center justify-between gap-2 flex-col xl:flex-row` ' +
          '(stack on mobile, inline on desktop).',
      },
    },
  },
  render: () => ({
    props: {
      rows: SAMPLE_ROWS,
      tableTokens,
      severityFor: (status: DataRow['status']) =>
        status === 'Active' ? 'success' : status === 'Pending' ? 'warn' : 'danger',
    },
    template: `
      <div class="border border-surface rounded-2xl overflow-hidden max-w-4xl">
        <p-table
          [value]="rows"
          [dt]="tableTokens"
          [paginator]="true"
          [rows]="3"
          [tableStyle]="{ 'min-width': '40rem' }"
          paginatorStyleClass="!bg-transparent"
        >
          <ng-template #caption>
            <div class="flex xl:items-center justify-between gap-2 flex-col xl:flex-row">
              <div class="flex items-center gap-2">
                <p-button label="Exportar" icon="fa-sharp fa-regular fa-download" severity="secondary" outlined />
                <p-button label="Nuevo cliente" icon="fa-sharp fa-regular fa-plus" />
              </div>
              <div class="text-muted-color text-sm leading-5">
                {{ rows.length }} clientes
              </div>
            </div>
          </ng-template>
          <ng-template #header>
            <tr>
              <th class="w-1/12">Id</th>
              <th class="w-5/12">Cliente</th>
              <th class="w-4/12">Email</th>
              <th class="w-2/12">Estado</th>
            </tr>
          </ng-template>
          <ng-template #body let-row>
            <tr>
              <td class="w-1/12">
                <div class="text-muted-color">{{ row.id }}</div>
              </td>
              <td class="w-5/12">
                <div class="flex items-center gap-2">
                  <p-avatar [label]="row.initials" shape="circle" styleClass="!bg-primary-100 !text-primary-950" />
                  <div class="text-color font-medium leading-6">{{ row.name }}</div>
                </div>
              </td>
              <td class="w-4/12">
                <div class="text-muted-color leading-6">{{ row.email }}</div>
              </td>
              <td class="w-2/12">
                <p-tag [value]="row.status" [severity]="severityFor(row.status)" styleClass="font-medium" />
              </td>
            </tr>
          </ng-template>
        </p-table>
      </div>
    `,
  }),
};

/**
 * Empty state inside a table body — `#emptymessage` slot.
 */
export const Empty: Story = {
  parameters: {
    docs: {
      description: {
        story:
          '`<ng-template #emptymessage>` renders when `value` is an empty ' +
          'array. The cell spans all columns and uses the same EmptyState ' +
          'recipe (icon + title + description + CTA).',
      },
    },
  },
  render: () => ({
    props: { tableTokens },
    template: `
      <div class="border border-surface rounded-2xl overflow-hidden max-w-4xl">
        <p-table
          [value]="[]"
          [dt]="tableTokens"
          [tableStyle]="{ 'min-width': '40rem' }"
        >
          <ng-template #header>
            <tr>
              <th class="w-1/12">Id</th>
              <th class="w-5/12">Cliente</th>
              <th class="w-4/12">Email</th>
              <th class="w-2/12">Estado</th>
            </tr>
          </ng-template>
          <ng-template #emptymessage>
            <tr>
              <td colspan="4">
                <div class="flex flex-col items-center text-center gap-3 py-8">
                  <i class="fa-sharp-duotone fa-regular fa-table text-4xl text-muted-color" aria-hidden="true"></i>
                  <div class="text-color font-medium leading-6">Sin clientes para mostrar</div>
                  <div class="text-muted-color leading-6 max-w-sm">
                    Cuando agregues clientes, aparecerán acá.
                  </div>
                  <p-button label="Nuevo cliente" outlined />
                </div>
              </td>
            </tr>
          </ng-template>
        </p-table>
      </div>
    `,
  }),
};
