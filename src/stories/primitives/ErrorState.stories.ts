import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';

import { ErrorStateComponent } from '../../app/shared/components/error-state/error-state.component';

/**
 * `<app-error-state>` — bloque inline para regiones que no pudieron
 * cargar. Diferente de:
 *   - empty: "no hay datos, todo OK" → `<app-empty-state>`.
 *   - toast: feedback transitorio de una acción → `AppToastService`.
 *
 * Recetas:
 *   - Icono `fa-sharp-duotone fa-regular fa-triangle-exclamation`
 *     `text-4xl text-muted-color` (NO rojo — rojo se reserva para
 *     validación inline de formularios).
 *   - Título verb-past: "No se pudo cargar el gráfico".
 *   - Descripción 1–2 líneas accionable.
 *   - CTA "Reintentar" outlined secondary por default.
 *
 * Ref: `.claude/rules/ux-patterns.md` — "Bloque inline de error".
 */
const meta: Meta<ErrorStateComponent> = {
  title: 'Primitives/Error State',
  component: ErrorStateComponent,
  tags: ['autodocs'],
  decorators: [moduleMetadata({ imports: [ErrorStateComponent] })],
  argTypes: {
    title: { control: 'text' },
    description: { control: 'text' },
    bordered: { control: 'boolean' },
    showRetry: { control: 'boolean' },
    retryLabel: { control: 'text' },
    icon: { control: 'text' },
  },
};
export default meta;
type Story = StoryObj<ErrorStateComponent>;

export const Default: Story = {
  args: {
    title: 'No se pudo cargar el gráfico',
    description:
      'Verificá tu conexión. Si el problema persiste, contactá soporte.',
    bordered: true,
    showRetry: true,
  },
};

export const InlineNoCard: Story = {
  args: {
    title: 'Falló la sincronización',
    description: 'Reintentamos automáticamente en 30 segundos.',
    bordered: false,
    showRetry: false,
  },
};

export const NetworkError: Story = {
  args: {
    title: 'Sin conexión a la red',
    description: 'Revisá tu red y volvé a intentar.',
    icon: 'fa-wifi-slash',
    retryLabel: 'Volver a intentar',
  },
};
