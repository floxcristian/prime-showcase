import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { Button } from 'primeng/button';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputText } from 'primeng/inputtext';

/**
 * Page header recipe — canonical placement of title + subtitle + actions.
 * Single source of truth for what a module's top bar should look like;
 * any drift here means the modules drift too.
 *
 * Spec lives in `DESIGN.md` § Layout → Header de página.
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
        story: 'Title + subtitle, search field on the right. The 90% case.',
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
        story: 'Minimal variant — no subtitle, no action. For deep pages.',
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
          'Variant from `/customers`: active-count pill replaces subtitle, ' +
          'visible only on `sm+` (≥ 640) so it doesn\'t compete with the title on mobile.',
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
