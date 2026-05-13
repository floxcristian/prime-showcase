import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';

import { SkeletonTableRowComponent } from '../../app/shared/components/skeleton-table-row/skeleton-table-row.component';

/**
 * `<app-skeleton-table-row>` — placeholder de una row de
 * `<p-table>`. Reemplaza el patrón previo de hand-tunear barras
 * por módulo (users tenía 9 hand-coded, customers 7, uptime 4 —
 * mismo placeholder, tres geometrías).
 */
const meta: Meta<SkeletonTableRowComponent> = {
  title: 'Primitives/Skeleton Table Row',
  component: SkeletonTableRowComponent,
  tags: ['autodocs'],
  decorators: [moduleMetadata({ imports: [SkeletonTableRowComponent] })],
  argTypes: {
    columns: { control: { type: 'number', min: 1, max: 12 } },
  },
};
export default meta;
type Story = StoryObj<SkeletonTableRowComponent>;

export const SixColumns: Story = { args: { columns: 6 } };
export const EightColumns: Story = { args: { columns: 8 } };
export const ThreeColumns: Story = { args: { columns: 3 } };
