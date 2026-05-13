import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';

import {
  SkeletonListItemComponent,
  SkeletonListItemGroupComponent,
} from '../../app/shared/components/skeleton-list-item/skeleton-list-item.component';

/**
 * `<app-skeleton-list-item>` — placeholder de una fila de lista
 * (avatar + título + subtítulo). Mirror exacto del layout
 * documentado en DESIGN.md "Item de lista".
 *
 * Usar el group helper para repetir N filas con la misma geometría.
 */
const meta: Meta<SkeletonListItemComponent> = {
  title: 'Primitives/Skeleton List Item',
  component: SkeletonListItemComponent,
  tags: ['autodocs'],
  decorators: [
    moduleMetadata({
      imports: [SkeletonListItemComponent, SkeletonListItemGroupComponent],
    }),
  ],
  argTypes: {
    primaryWidth: { control: 'text' },
    secondaryWidth: { control: 'text' },
  },
};
export default meta;
type Story = StoryObj<SkeletonListItemComponent>;

export const Single: Story = {
  args: { primaryWidth: '60%', secondaryWidth: '40%' },
};

export const Group: StoryObj = {
  parameters: {
    docs: {
      description: {
        story: 'Helper `<app-skeleton-list-item-group>` repite N filas.',
      },
    },
  },
  render: () => ({
    template: `<app-skeleton-list-item-group [rows]="5" />`,
  }),
};
