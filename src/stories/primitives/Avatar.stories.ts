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
          '`<p-avatar>` for user/entity representation. Always prefer an image;',
          'fall back to initials only when no image is available. Initials avatars',
          'use a SINGLE color across the app (`!bg-primary-100 !text-primary-950`)',
          'so users see them as "no photo yet" rather than as a colorful taxonomy.',
        ].join(' '),
      },
    },
  },
  argTypes: {
    image: { control: 'text' },
    label: { control: 'text', description: 'Initials (use when no image).' },
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
    styleClass: '!bg-primary-100 !text-primary-950',
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
        story: 'Avatar wrapped in `<p-overlayBadge>` for online/notification dots.',
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
  parameters: { docs: { description: { story: 'Normal / large / xlarge.' } } },
  render: () => ({
    template: `
      <div style="display: flex; align-items: center; gap: 1rem;">
        <p-avatar label="JD" shape="circle" size="normal" styleClass="!bg-primary-100 !text-primary-950" />
        <p-avatar label="JD" shape="circle" size="large" styleClass="!bg-primary-100 !text-primary-950" />
        <p-avatar label="JD" shape="circle" size="xlarge" styleClass="!bg-primary-100 !text-primary-950" />
      </div>
    `,
  }),
};
