import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { Avatar } from 'primeng/avatar';

/**
 * Multi-panel layout recipe — canonical 2-pane (inbox) and 3-pane (chat)
 * shells. Each panel:
 *   - has a fixed header with `p-4 border-b border-surface`,
 *   - scrolls independently (`overflow-hidden` parent + `flex-1
 *     overflow-auto` body),
 *   - declares width in fractions (`w-4/12 w-8/12 w-3/12`) on desktop
 *     and collapses the tertiary panel below `xl:` via `xl:block hidden`.
 *
 * The full spec lives in `DESIGN.md` § Layout → Layouts multi-panel.
 * Modules using the recipe today: `inbox`, `chat`.
 */

const meta: Meta = {
  title: 'Recipes/Multi-Panel Layout',
  tags: ['autodocs'],
  decorators: [moduleMetadata({ imports: [Avatar] })],
  parameters: {
    docs: {
      description: {
        component: [
          'Two canonical shells for app pages whose surface is a navigable',
          'list + one or two detail panels. Use TwoColumn for inbox-style',
          'features (folders + main list); use ThreeColumn when the detail',
          'view itself has secondary metadata (chat: list + conversation +',
          'profile).',
          '',
          'Reviewer note: a new module that needs a multi-panel shell must',
          'pick one of these two — do not invent a fourth panel or a new',
          'split ratio without explicit design approval.',
        ].join(' '),
      },
    },
  },
};
export default meta;
type Story = StoryObj;

/**
 * 2-panel shell (inbox). Fixed-width left panel + flex-1 main.
 */
export const TwoColumn: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Inbox-style layout: 256-pixel folder panel + flex-1 main. ' +
          'No collapse — the folder panel stays on every viewport.',
      },
    },
  },
  render: () => ({
    template: `
      <div class="flex gap-4 h-96 max-w-5xl">
        <!-- Folders panel -->
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

        <!-- Main panel -->
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
 * 3-panel shell (chat). List on the left + main conversation + profile.
 * Profile panel collapses below `xl:`.
 */
export const ThreeColumn: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Chat-style layout: list (3-4/12) + conversation (6-8/12) + ' +
          'profile (3/12). Profile column hidden below xl: via ' +
          '`xl:block hidden`. Each panel scrolls independently.',
      },
    },
  },
  render: () => ({
    template: `
      <div class="flex border border-surface rounded-2xl h-96 max-w-7xl overflow-hidden">
        <!-- List panel -->
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

        <!-- Conversation panel -->
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

        <!-- Profile panel (hidden < xl) -->
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
 * Mobile / narrow viewport (< xl). The tertiary panel collapses and the
 * first two stack into a single column flow. Reviewer should switch the
 * Storybook viewport to `mobile` to verify this story renders the
 * collapsed shape.
 */
export const MobileCollapse: Story = {
  parameters: {
    viewport: { defaultViewport: 'mobile' },
    docs: {
      description: {
        story:
          'Same ThreeColumn template at a 375px viewport: profile panel ' +
          '(`xl:block hidden`) disappears, primary two panels keep their ' +
          'fractions and remain horizontally split. Switch viewport in the ' +
          'toolbar to verify visually.',
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
          <p class="text-color">Profile (hidden &lt; xl)</p>
        </div>
      </div>
    `,
  }),
};
