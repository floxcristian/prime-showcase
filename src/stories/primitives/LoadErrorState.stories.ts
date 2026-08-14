import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';

import { LoadErrorStateComponent } from '../../app/shared/components/load-error-state/load-error-state.component';

/**
 * Error de carga (`<app-load-error-state>`) — compone
 * `<app-empty-state>` con el copy fijo del proyecto para "falló el
 * fetch y no hay data que mostrar": icono triangle-exclamation,
 * descripción "Hubo un problema al obtener los datos…" y CTA
 * "Reintentar". Solo varía el título por entidad.
 *
 * Para reload fallido con data stale visible usar
 * `Primitives/Stale Data Banner`.
 *
 * Usa la variante `size="compact"` del empty state (título a 16px):
 * vive en celdas y contenedores densos `max-w-sm` — con la escala hero
 * el título de error competía con el `h1` de la página.
 *
 * Consumido por las 9 vistas de lista/detalle con fetch (users, roles,
 * customers y todo observability).
 */

interface LoadErrorStateArgs {
  title: string;
}

const meta: Meta<LoadErrorStateArgs> = {
  title: 'Primitives/Load Error State',
  tags: ['autodocs'],
  decorators: [moduleMetadata({ imports: [LoadErrorStateComponent] })],
  argTypes: {
    title: {
      control: 'text',
      description:
        'Título completo del error — se pasa entero para no adivinar género/artículo.',
    },
  },
};
export default meta;
type Story = StoryObj<LoadErrorStateArgs>;

export const Usuarios: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Variante de `/users` — la forma es idéntica en todas las vistas.',
      },
    },
  },
  args: { title: 'No pudimos cargar los usuarios' },
  render: (args) => ({
    props: args,
    template: `<app-load-error-state [title]="title" />`,
  }),
};

export const Inbox: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Solo cambia el título por entidad ("tu inbox", "la alerta", "el servicio").',
      },
    },
  },
  args: { title: 'No pudimos cargar tu inbox' },
  render: (args) => ({
    props: args,
    template: `<app-load-error-state [title]="title" />`,
  }),
};
