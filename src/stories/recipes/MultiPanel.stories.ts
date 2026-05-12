import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { Avatar } from 'primeng/avatar';

/**
 * Recipe de layout multi-panel — shells canónicos de 2 paneles (inbox) y
 * 3 paneles (chat). Cada panel:
 *   - tiene un header fijo con `p-4 border-b border-surface`,
 *   - scrollea independientemente (padre `overflow-hidden` + body
 *     `flex-1 overflow-auto`),
 *   - declara su ancho en fracciones (`w-4/12 w-8/12 w-3/12`) en desktop
 *     y colapsa el panel terciario bajo `xl:` vía `xl:block hidden`.
 *
 * La spec completa vive en `DESIGN.md` § Layout → Layouts multi-panel.
 * Módulos que usan el recipe hoy: `inbox`, `chat`.
 */

const meta: Meta = {
  title: 'Recipes/Multi-Panel Layout',
  tags: ['autodocs'],
  decorators: [moduleMetadata({ imports: [Avatar] })],
  parameters: {
    docs: {
      description: {
        component: [
          'Dos shells canónicos para páginas cuya superficie es una lista',
          'navegable + uno o dos paneles de detalle. Usar TwoColumn para',
          'features estilo inbox (carpetas + lista principal); usar ThreeColumn',
          'cuando la vista de detalle tiene metadata secundaria propia',
          '(chat: lista + conversación + perfil).',
          '',
          'Nota para reviewers: un módulo nuevo que necesite un shell',
          'multi-panel debe elegir uno de estos dos — no inventar un cuarto',
          'panel ni un nuevo split ratio sin aprobación explícita de diseño.',
        ].join(' '),
      },
    },
  },
};
export default meta;
type Story = StoryObj;

/**
 * Shell de 2 paneles (inbox). Panel izquierdo de ancho fijo + main flex-1.
 */
export const TwoColumn: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Layout estilo inbox: panel de carpetas de 256px + main flex-1. ' +
          'Sin colapso — el panel de carpetas se mantiene en todo viewport.',
      },
    },
  },
  render: () => ({
    template: `
      <div class="flex gap-4 h-96 max-w-5xl">
        <!-- Panel de carpetas -->
        <div class="w-64 h-full overflow-hidden border border-surface rounded-2xl flex flex-col">
          <div class="flex items-center justify-between gap-2 p-4 border-b border-surface">
            <h2 class="text-color font-semibold leading-6">Carpetas</h2>
          </div>
          <div class="flex-1 flex flex-col overflow-auto p-2 gap-1">
            <button class="px-4 py-2 rounded-lg flex items-center gap-2 cursor-pointer transition-colors text-color bg-emphasis font-medium">
              <i class="fa-sharp fa-regular fa-inbox" aria-hidden="true"></i>
              <span>Bandeja</span>
            </button>
            <button class="px-4 py-2 rounded-lg flex items-center gap-2 cursor-pointer hover:bg-emphasis transition-colors text-muted-color font-medium">
              <i class="fa-sharp fa-regular fa-star" aria-hidden="true"></i>
              <span>Destacados</span>
            </button>
            <button class="px-4 py-2 rounded-lg flex items-center gap-2 cursor-pointer hover:bg-emphasis transition-colors text-muted-color font-medium">
              <i class="fa-sharp fa-regular fa-clock" aria-hidden="true"></i>
              <span>Programados</span>
            </button>
          </div>
        </div>

        <!-- Panel principal -->
        <div class="flex-1 h-full border border-surface rounded-2xl overflow-hidden flex flex-col">
          <div class="flex items-center justify-between gap-2 p-4 border-b border-surface">
            <h2 class="text-color font-semibold leading-6">Bandeja</h2>
          </div>
          <div class="flex-1 overflow-auto p-4">
            <p class="text-muted-color leading-6">Contenido del panel principal.</p>
          </div>
        </div>
      </div>
    `,
  }),
};

/**
 * Shell de 3 paneles (chat). Lista a la izquierda + conversación principal +
 * perfil. El panel de perfil colapsa bajo `xl:`.
 */
export const ThreeColumn: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Layout estilo chat: lista (3-4/12) + conversación (6-8/12) + ' +
          'perfil (3/12). La columna de perfil queda oculta bajo xl: vía ' +
          '`xl:block hidden`. Cada panel scrollea independientemente.',
      },
    },
  },
  render: () => ({
    template: `
      <div class="flex border border-surface rounded-2xl h-96 max-w-7xl overflow-hidden">
        <!-- Panel de lista -->
        <div class="w-4/12 xl:w-3/12 min-w-40 h-full overflow-hidden flex flex-col">
          <div class="flex items-center justify-between gap-2 p-4 border-b border-surface">
            <h1 class="text-2xl font-medium leading-8 text-color">Chats</h1>
          </div>
          <div class="flex-1 flex flex-col overflow-auto">
            <div class="flex items-center gap-2 p-4 cursor-pointer hover:bg-emphasis transition-colors">
              <p-avatar label="PT" shape="circle" styleClass="!bg-primary-100 !text-primary-950" />
              <div class="flex-1 min-w-0">
                <div class="text-color font-medium leading-6 truncate">PrimeTek</div>
                <div class="text-muted-color text-sm leading-5 line-clamp-1 mt-1">
                  Cody, Esther, Jerome…
                </div>
              </div>
            </div>
            <div class="flex items-center gap-2 p-4 cursor-pointer bg-emphasis transition-colors">
              <p-avatar label="JD" shape="circle" styleClass="!bg-primary-100 !text-primary-950" />
              <div class="flex-1 min-w-0">
                <div class="text-color font-medium leading-6 truncate">Juan Díaz</div>
                <div class="text-muted-color text-sm leading-5 line-clamp-1 mt-1">
                  ¿Tenés el adjunto del cierre?
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Panel de conversación -->
        <div class="w-8/12 xl:w-6/12 border-x border-surface flex flex-col">
          <div class="flex items-center p-4 border-b border-surface gap-2">
            <p-avatar label="JD" shape="circle" styleClass="!bg-primary-100 !text-primary-950" />
            <div class="flex-1">
              <div class="text-color font-medium leading-6">Juan Díaz</div>
              <div class="text-muted-color text-sm leading-5">en línea</div>
            </div>
          </div>
          <div class="flex-1 overflow-auto p-6">
            <p class="text-muted-color leading-6">Conversación activa…</p>
          </div>
        </div>

        <!-- Panel de perfil (oculto < xl) -->
        <div class="w-3/12 xl:block hidden min-w-40 overflow-auto p-6">
          <div class="flex flex-col items-center text-center gap-2">
            <p-avatar label="JD" shape="circle" size="xlarge" styleClass="!bg-primary-100 !text-primary-950" />
            <div class="text-color font-medium leading-6 mt-2">Juan Díaz</div>
            <div class="text-muted-color text-sm leading-5">&#64;juandiaz</div>
          </div>
        </div>
      </div>
    `,
  }),
};

/**
 * Viewport mobile / angosto (< xl). El panel terciario colapsa y los
 * primeros dos se stackean en un solo flow de columna. El reviewer debe
 * cambiar el viewport de Storybook a `mobile` para verificar que esta
 * story renderiza la forma colapsada.
 */
export const MobileCollapse: Story = {
  parameters: {
    viewport: { defaultViewport: 'mobile' },
    docs: {
      description: {
        story:
          'El mismo template de ThreeColumn a 375px de viewport: el panel ' +
          'de perfil (`xl:block hidden`) desaparece, los dos paneles ' +
          'primarios mantienen sus fracciones y siguen split horizontalmente. ' +
          'Cambiar el viewport en la toolbar para verificarlo visualmente.',
      },
    },
  },
  render: () => ({
    template: `
      <div class="flex border border-surface rounded-2xl h-96 overflow-hidden">
        <div class="w-4/12 xl:w-3/12 min-w-40 h-full overflow-hidden flex flex-col">
          <div class="flex items-center justify-between gap-2 p-4 border-b border-surface">
            <h1 class="text-2xl font-medium leading-8 text-color">Chats</h1>
          </div>
          <div class="flex-1 flex flex-col overflow-auto">
            <div class="flex items-center gap-2 p-4 cursor-pointer hover:bg-emphasis transition-colors">
              <p-avatar label="PT" shape="circle" styleClass="!bg-primary-100 !text-primary-950" />
              <div class="flex-1 min-w-0">
                <div class="text-color font-medium leading-6 truncate">PrimeTek</div>
              </div>
            </div>
          </div>
        </div>
        <div class="w-8/12 xl:w-6/12 border-x border-surface flex flex-col">
          <div class="flex items-center p-4 border-b border-surface gap-2">
            <p-avatar label="JD" shape="circle" styleClass="!bg-primary-100 !text-primary-950" />
            <div class="text-color font-medium leading-6">Juan Díaz</div>
          </div>
          <div class="flex-1 overflow-auto p-4">
            <p class="text-muted-color leading-6">Conversación…</p>
          </div>
        </div>
        <div class="w-3/12 xl:block hidden min-w-40 overflow-auto p-6">
          <p class="text-color">Perfil (oculto &lt; xl)</p>
        </div>
      </div>
    `,
  }),
};
