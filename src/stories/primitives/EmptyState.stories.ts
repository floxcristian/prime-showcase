import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { Button } from 'primeng/button';

/**
 * Empty state pattern (the recipe lives in `.claude/rules/ux-patterns.md`).
 *
 * Shape: icon (sharp-duotone text-4xl) → title (`text-2xl font-medium`) →
 * description (`text-muted-color`) → optional CTA (outlined secondary).
 *
 * Centered via the parent flex container. The same shape is used for
 * onboarding tiles, file upload drop zones, and post-filter zero-results.
 */

const meta: Meta = {
  title: 'Primitives/Empty State',
  tags: ['autodocs'],
  decorators: [moduleMetadata({ imports: [Button] })],
};
export default meta;
type Story = StoryObj;

export const NoData: Story = {
  parameters: {
    docs: { description: { story: 'Initial empty list — no data yet.' } },
  },
  render: () => ({
    template: `
      <div class="border border-surface rounded-2xl p-6 max-w-md">
        <div class="flex flex-col items-center text-center gap-3 py-8">
          <i class="fa-sharp-duotone fa-regular fa-inbox text-4xl text-muted-color" aria-hidden="true"></i>
          <div class="text-2xl font-medium leading-8 text-color">Sin correos en tu bandeja</div>
          <div class="text-muted-color leading-6 max-w-sm">
            Cuando recibas un correo, aparecerá aquí.
          </div>
          <p-button label="Redactar nuevo" outlined />
        </div>
      </div>
    `,
  }),
};

export const NoResults: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Zero results after filtering — distinct copy from initial empty.',
      },
    },
  },
  render: () => ({
    template: `
      <div class="border border-surface rounded-2xl p-6 max-w-md">
        <div class="flex flex-col items-center text-center gap-3 py-8">
          <i class="fa-sharp-duotone fa-regular fa-magnifying-glass text-4xl text-muted-color" aria-hidden="true"></i>
          <div class="text-2xl font-medium leading-8 text-color">Sin resultados</div>
          <div class="text-muted-color leading-6 max-w-sm">
            No encontramos coincidencias para tu búsqueda. Probá con otros términos.
          </div>
          <p-button label="Limpiar filtros" severity="secondary" outlined />
        </div>
      </div>
    `,
  }),
};

export const ErrorState: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Feature-level error — same shape, neutral icon, "Reintentar" CTA.',
      },
    },
  },
  render: () => ({
    template: `
      <div class="border border-surface rounded-2xl p-6 max-w-md">
        <div class="flex flex-col items-center text-center gap-3 py-8">
          <i class="fa-sharp-duotone fa-regular fa-triangle-exclamation text-4xl text-muted-color" aria-hidden="true"></i>
          <div class="text-color font-medium leading-6">No se pudo cargar el gráfico</div>
          <div class="text-muted-color leading-6 max-w-sm">
            Verificá tu conexión. Si el problema persiste, contactá soporte.
          </div>
          <p-button label="Reintentar" outlined />
        </div>
      </div>
    `,
  }),
};
