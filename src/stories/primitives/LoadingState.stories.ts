import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';

import { LoadingStateComponent } from '../../app/shared/components/loading-state/loading-state.component';

/**
 * `<app-loading-state>` — placeholder genérico de bloque (título +
 * filas). Usar cuando la geometría del placeholder no necesita
 * mirrorear nada específico (cards, paneles resumen, dashboards).
 *
 * Para placeholders con geometría específica preferir:
 *   - `<app-skeleton-table-row>` dentro de un `<p-table>` placeholder
 *   - `<app-skeleton-list-item>` para listas chat/inbox/notificaciones
 *   - `<app-skeleton-card>` para layouts variant title/header/media
 *
 * Aplica `aria-busy="true"` para que screen readers anuncien
 * "ocupado" sin enumerar las barras individuales.
 *
 * Ref: `.claude/rules/ssr-and-runtime.md` — "Loading states".
 */
const meta: Meta<LoadingStateComponent> = {
  title: 'Primitives/Loading State',
  component: LoadingStateComponent,
  tags: ['autodocs'],
  decorators: [moduleMetadata({ imports: [LoadingStateComponent] })],
  argTypes: {
    rows: { control: { type: 'number', min: 1, max: 8 } },
    rowHeight: { control: 'text' },
    showTitle: { control: 'boolean' },
    bordered: { control: 'boolean' },
    ariaLabel: { control: 'text' },
  },
};
export default meta;
type Story = StoryObj<LoadingStateComponent>;

export const Default: Story = {
  args: {
    rows: 3,
    showTitle: true,
    bordered: true,
    ariaLabel: 'Cargando contenido',
  },
};

export const Dense: Story = {
  args: {
    rows: 6,
    rowHeight: '0.75rem',
    showTitle: false,
    bordered: true,
  },
};

export const InlineNoCard: Story = {
  args: {
    rows: 2,
    showTitle: false,
    bordered: false,
  },
};
