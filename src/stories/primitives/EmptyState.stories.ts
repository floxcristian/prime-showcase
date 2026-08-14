import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { Button } from 'primeng/button';

import { EmptyStateComponent } from '../../app/shared/components/empty-state/empty-state.component';

/**
 * Patrón de empty state (la receta vive en `.claude/rules/ux-patterns.md`).
 *
 * Forma: icono (sharp-duotone text-4xl) → título (`text-2xl font-medium`) →
 * descripción (`text-muted-color`) → CTA opcional (outlined secondary).
 *
 * Centrado vía el flex container padre. La misma forma se usa para
 * tiles de onboarding, drop zones de file upload, y zero-results post-filtrado.
 *
 * El componente compartido `<app-empty-state>` implementa la receta con
 * dos escalas de título (`size`): `default` (hero, `text-2xl`) y
 * `compact` (16px, para contextos densos donde la escala hero
 * invertiría la jerarquía vs el `h1` de la página). Ver las stories
 * `ComponentDefault` / `ComponentCompact`.
 */

const meta: Meta = {
  title: 'Primitives/Empty State',
  tags: ['autodocs'],
  decorators: [moduleMetadata({ imports: [Button, EmptyStateComponent] })],
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

export const ComponentDefault: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'El componente real `<app-empty-state>` con `size="default"` — ' +
          'título hero `text-2xl font-medium leading-8`. Para listas ' +
          'vacías top-level y drop zones.',
      },
    },
  },
  render: () => ({
    template: `
      <app-empty-state
        icon="fa-inbox"
        title="Sin correos en tu bandeja"
        description="Cuando recibas un correo, aparecerá aquí."
        [bordered]="true"
      />
    `,
  }),
};

export const ComponentCompact: Story = {
  parameters: {
    docs: {
      description: {
        story:
          '`size="compact"` — título a 16px (`font-medium leading-6`) para ' +
          'contextos densos: celdas, contenedores `max-w-sm`, error states ' +
          'dentro de cards. A escala hero el título quedaría del mismo ' +
          'tamaño que el `h1` de la página (jerarquía invertida). ' +
          '`<app-load-error-state>` usa esta variante.',
      },
    },
  },
  render: () => ({
    template: `
      <app-empty-state
        icon="fa-triangle-exclamation"
        title="No pudimos cargar los datos"
        description="Hubo un problema al obtener los datos. Reintentalo en unos segundos."
        [bordered]="true"
        size="compact"
        actionLabel="Reintentar"
        actionIcon="fa-sharp fa-regular fa-arrows-rotate"
      />
    `,
  }),
};
