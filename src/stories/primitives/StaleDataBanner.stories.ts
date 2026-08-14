import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';

import { StaleDataBannerComponent } from '../../app/shared/components/stale-data-banner/stale-data-banner.component';

/**
 * Banner "no pudimos refrescar" (`<app-stale-data-banner>`) — aparece
 * encima de una tabla cuando el reload falla PERO hay data previa
 * visible (stale-while-revalidate UX). `role="alert"` para que screen
 * readers anuncien el fallo sin interacción.
 *
 * Distinto del error empty-state (`Primitives/Load Error State`), que
 * cubre el caso "falló el fetch y no hay nada que mostrar".
 *
 * Consumido por users / roles / customers / obs-uptime.
 */

interface StaleDataBannerArgs {
  message: string;
}

const meta: Meta<StaleDataBannerArgs> = {
  title: 'Primitives/Stale Data Banner',
  tags: ['autodocs'],
  decorators: [moduleMetadata({ imports: [StaleDataBannerComponent] })],
  argTypes: {
    message: {
      control: 'text',
      description:
        'Mensaje del banner — el default cubre el caso genérico de refresh fallido.',
    },
  },
};
export default meta;
type Story = StoryObj<StaleDataBannerArgs>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Copy default — "Estás viendo la última versión disponible" + CTA Reintentar.',
      },
    },
  },
  render: () => ({
    template: `<app-stale-data-banner />`,
  }),
};

export const CustomMessage: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Mensaje contextual vía el input `message`.',
      },
    },
  },
  args: {
    message:
      'La sincronización con el backend falló. Los montos pueden estar desactualizados.',
  },
  render: (args) => ({
    props: args,
    template: `<app-stale-data-banner [message]="message" />`,
  }),
};
