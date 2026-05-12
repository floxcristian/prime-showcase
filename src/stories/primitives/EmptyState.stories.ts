import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { Button } from 'primeng/button';

/**
 * Patrón de empty state (la receta vive en `.claude/rules/ux-patterns.md`).
 *
 * Forma: icono (sharp-duotone text-4xl) → título (`text-2xl font-medium`) →
 * descripción (`text-muted-color`) → CTA opcional (outlined secondary).
 *
 * Centrado vía el flex container padre. La misma forma se usa para
 * tiles de onboarding, drop zones de file upload, y zero-results post-filtrado.
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
    docs: { description: { story: 'Lista vacía inicial — todavía sin datos.' } },
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
        story: 'Cero resultados después de filtrar — copy distinto al empty inicial.',
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
        story: 'Error a nivel feature — misma forma, icono neutral, CTA "Reintentar".',
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
