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
          '`<p-tag>` for status badges, categories, and small inline indicators.',
          'Use `severity` to map semantic meaning: `success` for active/online,',
          '`danger` for inactive/error, `warn` for pending, `info` for informational.',
          '',
          'Always pair with `value` (visible text). Icon-only tags are forbidden —',
          'they degrade screen-reader experience and lose meaning in monochrome.',
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
    rounded: { control: 'boolean', description: 'Capsule shape.' },
    icon: { control: 'text', description: 'Optional FA class string.' },
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
export const Info: Story = { args: { value: 'Info', severity: 'info' } };
export const Secondary: Story = { args: { value: 'Borrador', severity: 'secondary' } };

export const WithIcon: Story = {
  args: { value: 'Verificado', severity: 'success', icon: 'fa-sharp fa-solid fa-check' },
};

export const SeverityGrid: Story = {
  parameters: {
    docs: { description: { story: 'Every severity at a glance for review.' } },
  },
  render: () => ({
    template: `
      <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center;">
        <p-tag value="Activo" severity="success" />
        <p-tag value="Pendiente" severity="warn" />
        <p-tag value="Inactivo" severity="danger" />
        <p-tag value="Info" severity="info" />
        <p-tag value="Borrador" severity="secondary" />
        <p-tag value="Contrast" severity="contrast" />
      </div>
    `,
  }),
};
