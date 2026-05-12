import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { ToggleSwitch } from 'primeng/toggleswitch';

/**
 * Recipe canónico de form-card (profile, settings, file upload).
 * `rounded-3xl` lo distingue de las data cards (`rounded-2xl`).
 * Los labels de input llevan `font-semibold`; los labels de checkbox/radio
 * llevan `font-normal` — enforced por `showcase/label-requires-semibold`.
 *
 * La spec vive en `DESIGN.md` § Layout → Formularios dentro de cards.
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
      description: { story: 'Form de perfil — input + toggle + botones de acción en par.' },
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
    docs: { description: { story: 'Form de un solo campo (búsqueda como form, OTP, etc.).' } },
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
