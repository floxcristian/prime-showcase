import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { Button } from 'primeng/button';
import { Tooltip } from 'primeng/tooltip';

import { RefreshToolbarComponent } from '../../app/shared/components/refresh-toolbar/refresh-toolbar.component';

/**
 * Cluster derecho de toolbar (`<app-refresh-toolbar>`): freshness
 * ("Actualizado hace X") + botón refresh tonal. Consumido por users /
 * roles / customers / obs-uptime dentro del wrapper de toolbar
 * (`mt-6 lg:mt-10 mb-4 flex … flex-wrap`).
 *
 * Decisiones documentadas en el JSDoc del componente:
 *   - variante **tonal** del botón (unificación del drift
 *     outlined-vs-tonal a favor de la jerarquía de customers).
 *   - `animate-spin` sobre el mismo icon en vez de `[loading]` de
 *     PrimeNG (evita el overlap de spinner + arrows-rotate).
 *
 * El slot `<ng-content>` recibe controles extra del cluster (density
 * toggle, CTA crear) — ver la story `WithExtraControls`.
 */

const meta: Meta = {
  title: 'Recipes/Refresh Toolbar',
  tags: ['autodocs'],
  decorators: [
    moduleMetadata({ imports: [RefreshToolbarComponent, Button, Tooltip] }),
  ],
};
export default meta;
type Story = StoryObj;

/** Timestamp "hace 2 minutos" para que el label de freshness renderice. */
const twoMinutesAgo = (): string =>
  new Date(Date.now() - 2 * 60 * 1000).toISOString();

export const Idle: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Estado idle con freshness — el label "Actualizado hace X" solo es visible en `lg+`.',
      },
    },
  },
  render: () => ({
    props: { ts: twoMinutesAgo() },
    template: `
      <div class="flex items-center gap-2 lg:gap-3 flex-wrap">
        <app-refresh-toolbar [lastFetchedAt]="ts" [loading]="false" />
      </div>
    `,
  }),
};

export const Loading: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Fetch en curso: el mismo icon rota vía `animate-spin` y el botón queda disabled. ' +
          'Sin swap de spinner — evita el flicker de "2 iconos" del `[loading]` de PrimeNG.',
      },
    },
  },
  render: () => ({
    props: { ts: twoMinutesAgo() },
    template: `
      <div class="flex items-center gap-2 lg:gap-3 flex-wrap">
        <app-refresh-toolbar [lastFetchedAt]="ts" [loading]="true" />
      </div>
    `,
  }),
};

export const FirstLoad: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Antes del primer fetch exitoso `lastFetchedAt` es `null` — el label de freshness se omite.',
      },
    },
  },
  render: () => ({
    template: `
      <div class="flex items-center gap-2 lg:gap-3 flex-wrap">
        <app-refresh-toolbar [lastFetchedAt]="null" [loading]="true" />
      </div>
    `,
  }),
};

export const WithExtraControls: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Controles extra proyectados después del refresh (variante de `/customers`: ' +
          'utility buttons tonal + CTA primario al final del cluster).',
      },
    },
  },
  render: () => ({
    props: { ts: twoMinutesAgo() },
    template: `
      <div class="flex items-center gap-2 lg:gap-3 flex-wrap">
        <app-refresh-toolbar [lastFetchedAt]="ts" [loading]="false">
          <p-button
            icon="fa-sharp fa-regular fa-bars"
            styleClass="p-button-tonal"
            ariaLabel="Cambiar densidad"
            pTooltip="Cambiar densidad"
          />
          <p-button
            label="Crear cliente"
            icon="fa-sharp fa-regular fa-plus"
            iconPos="left"
            ariaLabel="Crear nuevo cliente"
          />
        </app-refresh-toolbar>
      </div>
    `,
  }),
};
