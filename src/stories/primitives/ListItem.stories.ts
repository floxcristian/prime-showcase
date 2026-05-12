import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { Avatar } from 'primeng/avatar';

/**
 * The list-item recipe is the most-used pattern in the app (chat list,
 * inbox, customers panel, notifications). Five variants are canonical
 * and locked in DESIGN.md § Components → Recipes de nav/list items.
 *
 * Don't add a new list-item shape here without updating DESIGN.md AND
 * checking with reviewers — the recipe consistency is what makes the
 * app feel like one system.
 */

const meta: Meta = {
  title: 'Primitives/List Item',
  tags: ['autodocs'],
  decorators: [moduleMetadata({ imports: [Avatar] })],
};
export default meta;
type Story = StoryObj;

export const ChatRow: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Chat list row — avatar + name + preview + timestamp.',
      },
    },
  },
  render: () => ({
    template: `
      <div class="flex items-center gap-2 p-4 cursor-pointer hover:bg-emphasis transition-colors border border-surface rounded-lg max-w-md">
        <p-avatar
          image="https://www.primefaces.org/cdn/primevue/images/landing/apps/avatar-primetek.png"
          shape="circle"
          size="large"
        />
        <div class="flex-1 min-w-0">
          <div class="flex items-start gap-1 justify-between">
            <div class="text-color font-medium leading-6 truncate">PrimeTek</div>
            <div class="text-xs text-muted-color leading-4 whitespace-nowrap">14:32</div>
          </div>
          <div class="text-muted-color text-sm leading-5 line-clamp-1 mt-1">
            Cody Fisher, Esther Howard, Jerome Bell, Kristin Watson, Ronald Richards…
          </div>
        </div>
      </div>
    `,
  }),
};

export const InboxRow: Story = {
  parameters: {
    docs: {
      description: { story: 'Inbox/email row — unread state via font weight.' },
    },
  },
  render: () => ({
    template: `
      <div class="flex items-center gap-2 p-4 cursor-pointer hover:bg-emphasis transition-colors border border-surface rounded-lg max-w-md">
        <p-avatar label="JD" shape="circle" styleClass="!bg-primary-100 !text-primary-950" />
        <div class="flex-1 min-w-0">
          <div class="flex items-start gap-1 justify-between">
            <div class="text-color font-medium leading-6 truncate">Juan Díaz</div>
            <div class="text-xs text-muted-color leading-4 whitespace-nowrap">Hoy</div>
          </div>
          <div class="text-color leading-6 truncate mt-0.5">Re: Cierre mensual de cuentas</div>
          <div class="text-muted-color text-sm leading-5 line-clamp-1 mt-1">
            Adjunto las planillas con el detalle del último período…
          </div>
        </div>
      </div>
    `,
  }),
};

export const NavInPage: Story = {
  parameters: {
    docs: {
      description: { story: 'In-page navigation pill (active + inactive states).' },
    },
  },
  render: () => ({
    template: `
      <div class="flex gap-2 max-w-md flex-wrap">
        <button class="px-4 py-2 rounded-lg flex items-center gap-2 cursor-pointer transition-colors text-color bg-emphasis font-medium">
          <i class="fa-sharp fa-regular fa-inbox" aria-hidden="true"></i>
          <span>Bandeja</span>
        </button>
        <button class="px-4 py-2 rounded-lg flex items-center gap-2 cursor-pointer hover:bg-emphasis transition-colors text-muted-color bg-transparent font-medium">
          <i class="fa-sharp fa-regular fa-star" aria-hidden="true"></i>
          <span>Destacados</span>
        </button>
        <button class="px-4 py-2 rounded-lg flex items-center gap-2 cursor-pointer hover:bg-emphasis transition-colors text-muted-color bg-transparent font-medium">
          <i class="fa-sharp fa-regular fa-clock" aria-hidden="true"></i>
          <span>Programados</span>
        </button>
      </div>
    `,
  }),
};

export const SettingsRow: Story = {
  parameters: {
    docs: {
      description: { story: 'Settings row — icon + label + interactive control.' },
    },
  },
  render: () => ({
    template: `
      <div class="flex items-center gap-2 p-4 border border-surface rounded-lg max-w-md">
        <i class="fa-sharp fa-regular fa-bell text-color" aria-hidden="true"></i>
        <div class="leading-6 font-medium text-color flex-1">Notificaciones</div>
        <span class="text-muted-color text-sm leading-5">Activadas</span>
      </div>
    `,
  }),
};
