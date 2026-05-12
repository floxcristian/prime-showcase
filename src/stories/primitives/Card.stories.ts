import type { Meta, StoryObj } from '@storybook/angular';

/**
 * En este design system "Card" es una composición de Tailwind, no un componente
 * de PrimeNG. Dos variantes son canónicas:
 *   - Data card  → `rounded-2xl` (16px) para dashboards, paneles de listas, charts.
 *   - Form card  → `rounded-3xl` (24px) para perfil, settings, file upload.
 *
 * Ambos comparten `border border-surface p-6`. Los sub-contenedores internos bajan
 * a `rounded-lg` para que la jerarquía de radius se lea bien visualmente.
 *
 * Sin `shadow-*` — la elevación se comunica vía borde, no vía luz. Es una decisión
 * deliberada del design system; ver `DESIGN.md` § Elevation & Depth.
 */

const meta: Meta = {
  title: 'Primitives/Card',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const DataCard: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Card default para dashboards y paneles de datos. `rounded-2xl p-6`.',
      },
    },
  },
  render: () => ({
    template: `
      <div class="border border-surface rounded-2xl p-6 max-w-md">
        <div class="flex items-center gap-6 mb-6">
          <h3 class="flex-1 text-color font-semibold leading-6">Resumen del mes</h3>
        </div>
        <p class="text-color leading-6 mb-0">
          Contenido del card. Sin sombras: la elevación es el borde. Sub-contenedores
          internos usan <code>rounded-lg</code> para preservar la jerarquía visual.
        </p>
      </div>
    `,
  }),
};

export const FormCard: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Form card con radius más grande (`rounded-3xl`) para perfil / settings.',
      },
    },
  },
  render: () => ({
    template: `
      <div class="border border-surface rounded-3xl p-6 flex flex-col gap-6 max-w-md">
        <div>
          <label class="text-color font-semibold leading-6" for="email-sb">Email</label>
          <input
            id="email-sb"
            type="email"
            placeholder="tu@empresa.cl"
            class="mt-2 w-full border border-surface rounded-lg px-3 py-2 text-color bg-surface-0 dark:bg-surface-900"
          />
        </div>
        <button class="rounded-lg bg-primary text-primary-contrast font-medium px-4 py-2 cursor-pointer hover:bg-primary-emphasis transition-colors">
          Guardar cambios
        </button>
      </div>
    `,
  }),
};

export const ExpandedHeader: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Card con el header expandido documentado (`py-5 px-7`).',
      },
    },
  },
  render: () => ({
    template: `
      <div class="border border-surface rounded-2xl py-5 px-7 max-w-md">
        <div class="text-color font-semibold leading-6 mb-4">Transacciones</div>
        <p class="text-color leading-6 mb-0">
          Padding asimétrico (vertical 20 / horizontal 28) para data-heavy cards en desktop.
          Móviles usan <code>p-4</code> y suben a <code>py-5 px-7</code> en <code>lg:</code>.
        </p>
      </div>
    `,
  }),
};
