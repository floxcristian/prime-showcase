import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { ToggleSwitch } from 'primeng/toggleswitch';

/**
 * Canonical form-card recipe (profile, settings, file upload).
 * `rounded-3xl` distinguishes it from data cards (`rounded-2xl`).
 * Labels for inputs carry `font-semibold`; labels for checkbox/radio carry
 * `font-normal` — enforced by `showcase/label-requires-semibold`.
 *
 * Spec lives in `DESIGN.md` § Layout → Formularios dentro de cards.
 */

const meta: Meta = {
  title: 'Recipes/Form Card',
  tags: ['autodocs'],
  decorators: [moduleMetadata({ imports: [Button, InputText, ToggleSwitch] })],
};
export default meta;
type Story = StoryObj;

export const Profile: Story = {
  parameters: {
    docs: {
      description: { story: 'Profile form — input + toggle + paired action buttons.' },
    },
  },
  render: () => ({
    template: `
      <div class="border border-surface rounded-3xl p-6 flex flex-col gap-6 max-w-md">
        <div>
          <label class="text-color font-semibold leading-6" for="name-sb">Nombre completo</label>
          <input id="name-sb" pInputText class="mt-2 w-full" value="Juan Díaz" />
        </div>
        <div>
          <label class="text-color font-semibold leading-6" for="email-sb-2">Email</label>
          <input id="email-sb-2" type="email" pInputText class="mt-2 w-full" value="juan@empresa.cl" />
        </div>
        <div class="flex items-center gap-3">
          <i class="fa-sharp fa-regular fa-bell text-color text-xl" aria-hidden="true"></i>
          <div class="leading-6 text-color flex-1">Recibir notificaciones por email</div>
          <p-toggleswitch [ngModel]="true" aria-label="Notificaciones por email" />
        </div>
        <div class="flex items-center gap-2">
          <p-button label="Cancelar" severity="secondary" outlined styleClass="flex-1" />
          <p-button label="Guardar cambios" styleClass="flex-1" />
        </div>
      </div>
    `,
  }),
};

export const Minimal: Story = {
  parameters: {
    docs: { description: { story: 'Single-field form (search-as-a-form, OTP, etc.).' } },
  },
  render: () => ({
    template: `
      <div class="border border-surface rounded-3xl p-6 flex flex-col gap-4 max-w-md">
        <div>
          <label class="text-color font-semibold leading-6" for="code-sb">Código de acceso</label>
          <input id="code-sb" pInputText class="mt-2 w-full" placeholder="6 dígitos" />
          <small class="text-muted-color leading-5 mt-1 block">
            Te enviamos el código por SMS al número en tu perfil.
          </small>
        </div>
        <p-button label="Continuar" styleClass="w-full" />
      </div>
    `,
  }),
};
