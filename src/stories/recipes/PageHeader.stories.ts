import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { Button } from 'primeng/button';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputText } from 'primeng/inputtext';

/**
 * Recipe de page header — placement canónico de título + subtítulo + acciones.
 * Single source of truth de cómo debería verse la top bar de un módulo;
 * cualquier drift acá implica que los módulos también driftean.
 *
 * La spec vive en `DESIGN.md` § Layout → Header de página.
 */

const meta: Meta = {
  title: 'Recipes/Page Header',
  tags: ['autodocs'],
  decorators: [
    moduleMetadata({
      imports: [Button, IconField, InputIcon, InputText],
    }),
  ],
};
export default meta;
type Story = StoryObj;

export const Standard: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Título + subtítulo, campo de búsqueda a la derecha. El caso del 90%.',
      },
    },
  },
  render: () => ({
    template: `
      <div class="flex flex-wrap gap-4 items-start justify-between p-1">
        <div class="flex-1 min-w-0">
          <div class="text-muted-color font-medium leading-normal">CRM</div>
          <h1 class="text-color text-3xl font-bold leading-normal">Clientes</h1>
        </div>
        <div class="flex gap-2 whitespace-nowrap flex-nowrap">
          <p-iconfield iconPosition="left">
            <p-inputicon class="fa-sharp fa-regular fa-magnifying-glass" />
            <input type="text" pInputText placeholder="Buscar" aria-label="Buscar" />
          </p-iconfield>
          <p-button label="Nuevo cliente" icon="fa-sharp fa-regular fa-plus" />
        </div>
      </div>
    `,
  }),
};

export const TitleOnly: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Variante minimal — sin subtítulo, sin acción. Para páginas profundas.',
      },
    },
  },
  render: () => ({
    template: `
      <div class="p-1">
        <h1 class="text-color text-3xl font-bold leading-normal">Configuración</h1>
      </div>
    `,
  }),
};

export const WithCountPill: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Variante de `/customers`: el pill con conteo de activos reemplaza al subtítulo, ' +
          'visible solo en `sm+` (≥ 640) para que no compita con el título en mobile.',
      },
    },
  },
  render: () => ({
    template: `
      <div class="flex items-start gap-2 justify-between flex-wrap p-1">
        <div class="min-w-0">
          <h1 class="text-2xl leading-8 text-color font-medium">Clientes</h1>
          <div class="mt-1 leading-6 text-muted-color">Gestión de la base de clientes</div>
        </div>
        <p-button
          icon="fa-sharp fa-solid fa-circle text-green-500"
          label="950 clientes activos"
          outlined
          severity="secondary"
          ariaLabel="950 clientes con estado activo"
        />
      </div>
    `,
  }),
};
