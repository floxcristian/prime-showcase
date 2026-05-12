import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { Tag } from 'primeng/tag';

interface TagArgs {
  value?: string;
  severity?: 'secondary' | 'success' | 'info' | 'warn' | 'danger' | 'contrast';
  rounded?: boolean;
  icon?: string;
}

const meta: Meta<TagArgs> = {
  title: 'Primitives/Tag',
  tags: ['autodocs'],
  decorators: [moduleMetadata({ imports: [Tag] })],
  parameters: {
    docs: {
      description: {
        component: [
          '`<p-tag>` para badges de estado, categorías e indicadores inline pequeños.',
          'Usar `severity` para mapear el significado semántico: `success` para activo/online,',
          '`danger` para inactivo/error, `warn` para pendiente, `info` para informativo.',
          '',
          'Siempre acompañar con `value` (texto visible). Los tags icon-only están prohibidos —',
          'degradan la experiencia de screen readers y pierden significado en monocromo.',
        ].join(' '),
      },
    },
  },
  argTypes: {
    value: { control: 'text' },
    severity: {
      control: 'select',
      options: [undefined, 'secondary', 'success', 'info', 'warn', 'danger', 'contrast'],
    },
    rounded: { control: 'boolean', description: 'Forma de cápsula.' },
    icon: { control: 'text', description: 'String de clase FA opcional.' },
  },
  render: (args) => ({
    props: args,
    template: `<p-tag [value]="value" [severity]="severity" [rounded]="rounded" [icon]="icon" />`,
  }),
};

export default meta;
type Story = StoryObj<TagArgs>;

export const Success: Story = { args: { value: 'Activo', severity: 'success' } };
export const Danger: Story = { args: { value: 'Inactivo', severity: 'danger' } };
export const Warn: Story = { args: { value: 'Pendiente', severity: 'warn' } };
export const Info: Story = { args: { value: 'Información', severity: 'info' } };
export const Secondary: Story = { args: { value: 'Borrador', severity: 'secondary' } };

export const WithIcon: Story = {
  args: { value: 'Verificado', severity: 'success', icon: 'fa-sharp fa-solid fa-check' },
};

export const SeverityGrid: Story = {
  parameters: {
    docs: { description: { story: 'Todas las severities de un vistazo para revisión.' } },
  },
  render: () => ({
    template: `
      <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center;">
        <p-tag value="Activo" severity="success" />
        <p-tag value="Pendiente" severity="warn" />
        <p-tag value="Inactivo" severity="danger" />
        <p-tag value="Información" severity="info" />
        <p-tag value="Borrador" severity="secondary" />
        <p-tag value="Destacado" severity="contrast" />
      </div>
    `,
  }),
};
