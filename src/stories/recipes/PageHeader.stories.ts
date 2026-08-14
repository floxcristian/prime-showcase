import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { Button } from 'primeng/button';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputText } from 'primeng/inputtext';

import { PageHeaderComponent } from '../../app/shared/components/page-header/page-header.component';

/**
 * Recipe de page header — placement canónico de título + subtítulo +
 * slots de meta/acciones. Renderiza el componente compartido real
 * `<app-page-header>` (`src/app/shared/components/page-header/`), que
 * es el que consumen los módulos users / roles / customers y todo
 * observability. Cualquier drift acá implica que los módulos también
 * driftean.
 *
 * Slots:
 *   - `[meta]` — línea informativa debajo del subtítulo ("N visibles").
 *   - `[actions]` — cluster derecho de botones.
 *   - default — también a la derecha; es el slot para contenido
 *     condicional (`@if` proyecta al wildcard, no a los selectors).
 *
 * Márgenes contextuales (`mb-6`, `p-1`) se agregan vía `class` en el
 * call site.
 */

interface PageHeaderArgs {
  title: string;
  description: string;
}

const meta: Meta<PageHeaderArgs> = {
  title: 'Recipes/Page Header',
  tags: ['autodocs'],
  decorators: [
    moduleMetadata({
      imports: [PageHeaderComponent, Button, IconField, InputIcon, InputText],
    }),
  ],
  argTypes: {
    title: { control: 'text', description: 'Título — renderizado como `h1`.' },
    description: {
      control: 'text',
      description: 'Subtítulo descriptivo (opcional).',
    },
  },
};
export default meta;
type Story = StoryObj<PageHeaderArgs>;

export const Standard: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Título + subtítulo. El caso del 90% (inbox, alertas, uptime).',
      },
    },
  },
  args: {
    title: 'Clientes',
    description: 'Gestión de la base de clientes de la compañía',
  },
  render: (args) => ({
    props: args,
    template: `
      <app-page-header [title]="title" [description]="description" />
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
  args: { title: 'Configuración', description: '' },
  render: (args) => ({
    props: args,
    template: `<app-page-header [title]="title" />`,
  }),
};

export const WithActions: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Cluster de acciones a la derecha vía el slot `[actions]` — ' +
          'variante de obs-preferences (Restablecer + Guardar).',
      },
    },
  },
  args: {
    title: 'Preferencias',
    description:
      'Configurá qué notificaciones recibís, por qué canal y cuándo.',
  },
  render: (args) => ({
    props: args,
    template: `
      <app-page-header [title]="title" [description]="description">
        <div actions class="flex gap-2 whitespace-nowrap">
          <p-button
            label="Restablecer"
            severity="secondary"
            [outlined]="true"
            icon="fa-sharp fa-regular fa-rotate-left"
          />
          <p-button label="Guardar" icon="fa-sharp fa-regular fa-check" />
        </div>
      </app-page-header>
    `,
  }),
};

export const WithCountPill: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Variante de `/customers` y `/users`: count pill informativo a la ' +
          'derecha (slot default — en los módulos va dentro de `@if`, que ' +
          'proyecta al wildcard). Elemento estático con `role="status"`, no ' +
          'un botón: no es clickeable. Oculto bajo `lg` para no competir ' +
          'con el título en mobile.',
      },
    },
  },
  args: {
    title: 'Clientes',
    description: 'Gestión de la base de clientes de la compañía',
  },
  render: (args) => ({
    props: args,
    template: `
      <app-page-header [title]="title" [description]="description">
        <div
          class="hidden lg:inline-flex items-center gap-2 px-4 py-1 rounded-lg border border-surface text-color font-medium leading-6"
          role="status"
          aria-label="950 de 1200 clientes activos"
        >
          <i class="fa-sharp fa-solid fa-circle text-green-500" aria-hidden="true"></i>
          <span>950 de 1200 activos</span>
        </div>
      </app-page-header>
    `,
  }),
};

export const WithMetaLine: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Slot `[meta]` — línea de resultado debajo del subtítulo, como en ' +
          'obs-services / obs-alerts ("N visibles" que reacciona a los filtros).',
      },
    },
  },
  args: {
    title: 'Servicios',
    description: 'Listado de los servicios que monitorea tu equipo.',
  },
  render: (args) => ({
    props: args,
    template: `
      <app-page-header class="mb-6" [title]="title" [description]="description">
        <div meta class="mt-2 text-sm text-muted-color leading-5">
          <span class="text-color font-semibold">12</span>
          servicios visibles
        </div>
        <div actions class="flex gap-2 whitespace-nowrap">
          <p-button
            label="Nuevo servicio"
            icon="fa-sharp fa-regular fa-plus"
            severity="secondary"
            [outlined]="true"
          />
        </div>
      </app-page-header>
    `,
  }),
};
