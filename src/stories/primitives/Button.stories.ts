import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { Button } from 'primeng/button';
import { Tooltip } from 'primeng/tooltip';

/**
 * Canonical story for <p-button>. All other primitive stories should
 * mirror this shape:
 *   1. `moduleMetadata` imports the PrimeNG standalone(s) used in the
 *      template (Button + Tooltip here; Tooltip is needed when the story
 *      exercises icon-only mode + pTooltip).
 *   2. A type alias for the args surface — drives both Controls and
 *      argTypes inference.
 *   3. A `render` function with a literal Angular template, so the story
 *      composes the component exactly like a consumer would. Importing
 *      Button and binding component-level inputs (via `props: args`) is
 *      the most reliable Angular Storybook pattern.
 *   4. Stories cover: default action, every severity/state used in
 *      production, disabled/loading, icon-only with mandatory a11y
 *      attributes.
 *
 * Reviewer note: this catalog is the source of truth for what the
 * component should look like. If a module starts diverging from these
 * stories, the module is wrong, not the catalog.
 */

interface ButtonArgs {
  label?: string;
  icon?: string;
  iconPos?: 'left' | 'right' | 'top' | 'bottom';
  severity?: 'secondary' | 'success' | 'info' | 'warn' | 'help' | 'danger' | 'contrast';
  text?: boolean;
  outlined?: boolean;
  rounded?: boolean;
  raised?: boolean;
  size?: 'small' | 'large';
  disabled?: boolean;
  loading?: boolean;
  ariaLabel?: string;
  pTooltip?: string;
}

const meta: Meta<ButtonArgs> = {
  title: 'Primitives/Button',
  tags: ['autodocs'],
  decorators: [moduleMetadata({ imports: [Button, Tooltip] })],
  parameters: {
    docs: {
      description: {
        component: [
          'Standard action button (`<p-button>`). Severity controls visual',
          'hierarchy — omit for the page-primary action, `secondary` for the',
          'default secondary, `danger` for destructive, `contrast` when an',
          'icon-only button needs to stand out on a busy surface.',
          '',
          'Icon-only buttons MUST declare both `ariaLabel` and `pTooltip` so',
          'screen reader and pointer users can discover the action. Enforced',
          'by `showcase/no-icon-button-without-tooltip`.',
        ].join(' '),
      },
    },
  },
  argTypes: {
    label: { control: 'text', description: 'Visible label. Omit for icon-only.' },
    icon: {
      control: 'text',
      description: 'Font Awesome class string (e.g. `fa-sharp fa-regular fa-bell`).',
    },
    iconPos: {
      control: 'select',
      options: ['left', 'right', 'top', 'bottom'],
      description: 'Where the icon sits relative to the label.',
    },
    severity: {
      control: 'select',
      options: [undefined, 'secondary', 'success', 'info', 'warn', 'help', 'danger', 'contrast'],
      description: 'Visual weight. Omit for the page-primary action.',
    },
    text: { control: 'boolean', description: 'Borderless / minimal background.' },
    outlined: { control: 'boolean', description: 'Stroked outline, no fill.' },
    rounded: { control: 'boolean', description: 'Fully rounded (capsule) shape.' },
    raised: { control: 'boolean', description: 'Adds a subtle shadow. Avoid in this DS.' },
    size: {
      control: 'select',
      options: [undefined, 'small', 'large'],
      description: 'Use `large` only for hero CTAs; default for everything else.',
    },
    disabled: { control: 'boolean' },
    loading: {
      control: 'boolean',
      description: 'Built-in spinner. Never render an external spinner — use this.',
    },
    ariaLabel: { control: 'text', description: 'Required when `label` is omitted.' },
    pTooltip: { control: 'text', description: 'Required when `label` is omitted.' },
  },
  render: (args) => ({
    props: args,
    template: `
      <p-button
        [label]="label"
        [icon]="icon"
        [iconPos]="iconPos"
        [severity]="severity"
        [text]="text"
        [outlined]="outlined"
        [rounded]="rounded"
        [raised]="raised"
        [size]="size"
        [disabled]="disabled"
        [loading]="loading"
        [ariaLabel]="ariaLabel"
        [pTooltip]="pTooltip"
      />
    `,
  }),
};

export default meta;
type Story = StoryObj<ButtonArgs>;

/** Default: page-primary action. No severity, label only. */
export const Primary: Story = {
  args: { label: 'Guardar' },
};

/** Secondary: the most common variant in real templates. */
export const Secondary: Story = {
  args: { label: 'Cancelar', severity: 'secondary' },
};

/** Outlined secondary: equally common, used for non-primary form actions. */
export const SecondaryOutlined: Story = {
  args: { label: 'Cancelar', severity: 'secondary', outlined: true },
};

/** Text variant: minimal chrome. Default for icon-only buttons in toolbars. */
export const SecondaryText: Story = {
  args: { label: 'Detalles', severity: 'secondary', text: true },
};

/** Destructive action — always pair with a confirm dialog in production. */
export const Danger: Story = {
  args: { label: 'Eliminar', severity: 'danger' },
};

/** Contrast: high emphasis icon-only on busy surfaces (movie card bookmark). */
export const Contrast: Story = {
  args: {
    icon: 'fa-sharp fa-solid fa-bookmark',
    severity: 'contrast',
    text: true,
    rounded: true,
    ariaLabel: 'Quitar de favoritos',
    pTooltip: 'Quitar de favoritos',
  },
};

/** With icon — typical "Save / Download" action. */
export const WithIcon: Story = {
  args: { label: 'Descargar', icon: 'fa-sharp fa-regular fa-download', iconPos: 'left' },
};

/** Loading state — disabled + spinner. Never render an external spinner. */
export const Loading: Story = {
  args: { label: 'Guardando…', loading: true },
};

/** Disabled state — Aura applies opacity 0.5 + cursor not-allowed. */
export const Disabled: Story = {
  args: { label: 'Guardar', disabled: true },
};

/** Icon-only — MUST declare ariaLabel + pTooltip together. */
export const IconOnly: Story = {
  args: {
    icon: 'fa-sharp fa-regular fa-bell',
    severity: 'secondary',
    text: true,
    ariaLabel: 'Notificaciones',
    pTooltip: 'Notificaciones',
  },
};

/** Comparison grid: every severity at a glance. Useful in design review. */
export const SeverityGrid: Story = {
  parameters: {
    docs: { description: { story: 'Comparison view of every severity used in production.' } },
  },
  render: () => ({
    template: `
      <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center;">
        <p-button label="Default" />
        <p-button label="Secondary" severity="secondary" />
        <p-button label="Success" severity="success" />
        <p-button label="Info" severity="info" />
        <p-button label="Warn" severity="warn" />
        <p-button label="Help" severity="help" />
        <p-button label="Danger" severity="danger" />
        <p-button label="Contrast" severity="contrast" />
      </div>
    `,
  }),
};
