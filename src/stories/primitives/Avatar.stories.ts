import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { Avatar } from 'primeng/avatar';
import { OverlayBadge } from 'primeng/overlaybadge';

interface AvatarArgs {
  image?: string;
  label?: string;
  shape?: 'square' | 'circle';
  size?: 'normal' | 'large' | 'xlarge';
  styleClass?: string;
}

const meta: Meta<AvatarArgs> = {
  title: 'Primitives/Avatar',
  tags: ['autodocs'],
  decorators: [moduleMetadata({ imports: [Avatar, OverlayBadge] })],
  parameters: {
    docs: {
      description: {
        component: [
          '`<p-avatar>` para representar usuarios o entidades. Siempre preferir una imagen;',
          'usar iniciales como fallback solo cuando no hay imagen disponible. Los avatares con iniciales',
          'usan UN SOLO color en toda la app vía la utility class `app-avatar-initials`',
          '(que consume `--app-avatar-initials-*` desde `PROJECT_TOKENS.avatar` en `app.preset.ts`)',
          'para que el usuario los lea como "todavía sin foto" y no como una taxonomía de colores.',
        ].join(' '),
      },
    },
  },
  argTypes: {
    image: { control: 'text' },
    label: { control: 'text', description: 'Iniciales (usar cuando no hay imagen).' },
    shape: { control: 'inline-radio', options: ['square', 'circle'] },
    size: { control: 'select', options: ['normal', 'large', 'xlarge'] },
    styleClass: { control: 'text' },
  },
  render: (args) => ({
    props: args,
    template: `<p-avatar [image]="image" [label]="label" [shape]="shape" [size]="size" [styleClass]="styleClass" />`,
  }),
};

export default meta;
type Story = StoryObj<AvatarArgs>;

export const WithImage: Story = {
  args: {
    image: 'https://www.primefaces.org/cdn/primevue/images/landing/apps/avatar-primetek.png',
    shape: 'circle',
    size: 'large',
  },
};

export const Initials: Story = {
  args: {
    label: 'JD',
    shape: 'circle',
    size: 'large',
    styleClass: 'app-avatar-initials',
  },
};

export const Square: Story = {
  args: {
    image: 'https://www.primefaces.org/cdn/primevue/images/landing/apps/avatar-primetek.png',
    shape: 'square',
    size: 'large',
  },
};

export const StatusBadge: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Avatar envuelto en `<p-overlayBadge>` para dots de estado online/notificaciones.',
      },
    },
  },
  render: () => ({
    template: `
      <p-overlayBadge severity="success" styleClass="!min-w-0 !w-2.5 !h-2.5">
        <p-avatar
          image="https://www.primefaces.org/cdn/primevue/images/landing/apps/avatar-primetek.png"
          shape="circle"
          size="large"
        />
      </p-overlayBadge>
    `,
  }),
};

export const SizeScale: Story = {
  parameters: { docs: { description: { story: 'Escala normal / large / xlarge.' } } },
  render: () => ({
    template: `
      <div style="display: flex; align-items: center; gap: 1rem;">
        <p-avatar label="JD" shape="circle" size="normal" styleClass="app-avatar-initials" />
        <p-avatar label="JD" shape="circle" size="large" styleClass="app-avatar-initials" />
        <p-avatar label="JD" shape="circle" size="xlarge" styleClass="app-avatar-initials" />
      </div>
    `,
  }),
};
