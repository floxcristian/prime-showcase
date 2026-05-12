import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { TableModule } from 'primeng/table';
import { Avatar } from 'primeng/avatar';
import { Tag } from 'primeng/tag';
import { Button } from 'primeng/button';

/**
 * Recipe canónico de data-table. Envuelve `<p-table>` con la configuración
 * de design tokens del proyecto: `[dt]=tableTokens`, scrollable / paginado,
 * paginator transparente. Se usa en `customers` y `overview`.
 *
 * Spec: `.claude/rules/primeng-patterns.md` § Tablas + DESIGN.md
 * § Layout (los headers multi-panel usan el mismo patrón
 * `p-4 border-b border-surface` en `<ng-template #caption>`).
 */

interface DataRow {
  id: number;
  name: string;
  initials: string;
  email: string;
  status: 'Activo' | 'Inactivo' | 'Pendiente';
}

const SAMPLE_ROWS: DataRow[] = [
  { id: 1001, name: 'Cody Fisher', initials: 'CF', email: 'cody@empresa.cl', status: 'Activo' },
  { id: 1002, name: 'Esther Howard', initials: 'EH', email: 'esther@empresa.cl', status: 'Pendiente' },
  { id: 1003, name: 'Jerome Bell', initials: 'JB', email: 'jerome@empresa.cl', status: 'Inactivo' },
  { id: 1004, name: 'Kristin Watson', initials: 'KW', email: 'kristin@empresa.cl', status: 'Activo' },
  { id: 1005, name: 'Ronald Richards', initials: 'RR', email: 'ronald@empresa.cl', status: 'Activo' },
];

// Mismos dt tokens que usa el módulo customers. Se mantienen inline acá
// para que la story sea self-contained — los reviewers pueden copiar este
// objeto como punto de partida para un módulo nuevo.
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
          '`<p-table>` con el wiring canónico de design tokens del proyecto.',
          'Cada lista de datos / tabla de dashboard en la app usa esta forma:',
          '',
          '  - `[dt]=tableTokens` sobrescribe el padding para que las celdas',
          '    se alineen con la escala de spacing de 16px del chrome.',
          '  - `scrollable` + `scrollHeight="flex"` para que la tabla crezca',
          '    hasta su contenedor y el paginator quede anclado abajo.',
          '  - `paginatorStyleClass="!bg-transparent"` elimina el fondo del',
          '    paginator para que herede la surface del padre.',
          '  - Los tags de estado usan mapeo de `severity` (success / warn /',
          '    danger) — sin strings hex.',
        ].join(' '),
      },
    },
  },
};
export default meta;
type Story = StoryObj;

/**
 * Data table simple. Paginación activa, 3 filas por página para que el
 * paginator esté siempre visible en el preview de la story.
 */
export const Basic: Story = {
  render: () => ({
    props: {
      rows: SAMPLE_ROWS,
      tableTokens,
      severityFor: (status: DataRow['status']) =>
        status === 'Activo' ? 'success' : status === 'Pendiente' ? 'warn' : 'danger',
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
 * Data table con toolbar `#caption` — acciones bulk + campo de búsqueda.
 * El patrón que usan customers / overview / inbox cuando una lista necesita filtrado.
 */
export const WithCaptionToolbar: Story = {
  parameters: {
    docs: {
      description: {
        story:
          '`<ng-template #caption>` reemplaza el header de la tabla con una ' +
          'barra toolbar: acciones bulk a la izquierda, búsqueda a la derecha. ' +
          'Layout: `flex xl:items-center justify-between gap-2 flex-col xl:flex-row` ' +
          '(stack en mobile, inline en desktop).',
      },
    },
  },
  render: () => ({
    props: {
      rows: SAMPLE_ROWS,
      tableTokens,
      severityFor: (status: DataRow['status']) =>
        status === 'Activo' ? 'success' : status === 'Pendiente' ? 'warn' : 'danger',
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
 * Empty state dentro del body de una tabla — slot `#emptymessage`.
 */
export const Empty: Story = {
  parameters: {
    docs: {
      description: {
        story:
          '`<ng-template #emptymessage>` se renderiza cuando `value` es un ' +
          'array vacío. La celda ocupa todas las columnas y usa el mismo ' +
          'recipe de EmptyState (ícono + título + descripción + CTA).',
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
