import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';

import { NetworkChipComponent } from '../../app/shared/components/network-chip/network-chip.component';
import type { ChipNetwork } from '../../app/shared/components/network-chip/network-chip.tokens';

/**
 * Chip de red social (`<app-network-chip>`) — logo de marca real
 * (`fa-brands`) + nombre canónico de la red. Identificador NEUTRAL, sin
 * severidad semántica: por eso no wrappea `<p-tag>` (mismo criterio
 * documentado en `<app-pill>`) y usa la anatomía visual de la familia pill.
 *
 * El consumer pasa la red del dominio social (RFC-002 D2); label e icono
 * derivan del vocabulario compartido en `network-chip.tokens.ts` — un
 * cambio de copy o de icono se hace en un solo lugar.
 *
 * Consumido por toda la suite social (tablas de posts, cards de cuentas
 * conectadas, leyendas de charts, filtros por red) y potencialmente CRM.
 */

interface NetworkChipArgs {
  network: ChipNetwork;
}

const meta: Meta<NetworkChipArgs> = {
  title: 'Primitives/Network Chip',
  tags: ['autodocs'],
  decorators: [moduleMetadata({ imports: [NetworkChipComponent] })],
  parameters: {
    docs: {
      description: {
        component: [
          '`<app-network-chip>` — chip icono+label de red social (Instagram, Facebook, TikTok).',
          'Logo de marca real con `fa-brands` (único caso permitido por DESIGN.md) + nombre canónico.',
          'Es un identificador neutral, sin severidad semántica — para estados con significado',
          '(activo/error/pendiente) usar `<p-tag>` vía severity/status chips.',
          'Label e icono derivan del vocabulario compartido en `network-chip.tokens.ts`.',
        ].join(' '),
      },
    },
  },
  argTypes: {
    network: {
      control: 'inline-radio',
      options: ['instagram', 'facebook', 'tiktok'],
      description:
        'Red social del dominio — label e icono derivan del vocabulario de `network-chip.tokens.ts`.',
    },
  },
  render: (args) => ({
    props: args,
    template: `<app-network-chip [network]="network" />`,
  }),
};
export default meta;
type Story = StoryObj<NetworkChipArgs>;

export const Instagram: Story = { args: { network: 'instagram' } };
export const Facebook: Story = { args: { network: 'facebook' } };
// `name` explícito: el auto-título de Storybook partiría "TikTok" en "Tik Tok".
export const TikTok: Story = { name: 'TikTok', args: { network: 'tiktok' } };

export const TodasLasRedes: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Las tres redes juntas en el orden canónico del dominio (`CHIP_NETWORKS`) — para revisión visual del set completo.',
      },
    },
  },
  render: () => ({
    template: `
      <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center;">
        <app-network-chip network="instagram" />
        <app-network-chip network="facebook" />
        <app-network-chip network="tiktok" />
      </div>
    `,
  }),
};
