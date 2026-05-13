import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';

import { SkeletonCardComponent } from '../../app/shared/components/skeleton-card/skeleton-card.component';

/**
 * `<app-skeleton-card>` — placeholder para cards. Tres variants
 * cubren los layouts canónicos:
 *
 *   - `'title-body'` (default): título + bloque principal. KPI
 *     cards, summary panels.
 *   - `'header-body'`: avatar + título + subtítulo + bloque. List
 *     entries que se renderean como cards.
 *   - `'media-body'`: media block + título + descripción. Movie /
 *     product cards.
 *
 * Mirror del layout canónico `border border-surface rounded-2xl
 * p-6` (DESIGN.md "Card estándar").
 */
const meta: Meta<SkeletonCardComponent> = {
  title: 'Primitives/Skeleton Card',
  component: SkeletonCardComponent,
  tags: ['autodocs'],
  decorators: [moduleMetadata({ imports: [SkeletonCardComponent] })],
  argTypes: {
    variant: {
      control: 'inline-radio',
      options: ['title-body', 'header-body', 'media-body'],
    },
    bodyHeight: { control: 'text' },
    mediaHeight: { control: 'text' },
  },
};
export default meta;
type Story = StoryObj<SkeletonCardComponent>;

export const TitleBody: Story = {
  args: { variant: 'title-body', bodyHeight: '8rem' },
};

export const HeaderBody: Story = {
  args: { variant: 'header-body', bodyHeight: '6rem' },
};

export const MediaBody: Story = {
  args: { variant: 'media-body', bodyHeight: '4rem', mediaHeight: '10rem' },
};
