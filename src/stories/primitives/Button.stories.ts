import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { Button } from 'primeng/button';
import { Tooltip } from 'primeng/tooltip';

import { bilingualRender } from '../i18n';

/**
 * Story canónica para `<p-button>`. Todas las primitive stories del
 * catálogo deben mirror este shape:
 *   1. `moduleMetadata` importa los standalones de PrimeNG usados en
 *      el template (Button + Tooltip acá; Tooltip se necesita cuando
 *      la story ejercita icon-only + pTooltip).
 *   2. Un type alias para la surface de args — drivea Controls y la
 *      inferencia de argTypes.
 *   3. Una `render` function con template Angular literal, así la
 *      story compone el componente exactamente como un consumer lo
 *      haría. Importar Button y bindear inputs component-level (via
 *      `props: args`) es el patrón Angular Storybook más confiable.
 *   4. Stories cubren: acción default, cada severity/state usada en
 *      producción, disabled/loading, icon-only con atributos a11y
 *      obligatorios.
 *
 * Nota para reviewers: este catálogo es la fuente de verdad de cómo
 * el componente debe lucir. Si un módulo empieza a divergir de estas
 * stories, el módulo está mal, no el catálogo.
 *
 * **Idioma bilingüe en demos**: las stories interactivas (`Primary`,
 * `Secondary`, etc.) leen el locale activo del toolbar via
 * `ctx.globals.locale` y traducen labels con `tr({ es, en }, locale)`.
 * Cambiá el flag 🇪🇸/🇬🇧 del toolbar para verlo. Las descripciones de
 * docs son siempre español-primario (limitación de autodocs).
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
  /**
   * Variante "tonal" de Material 3 — mismo hue primary a menor
   * intensidad. Se aplica via `class="p-button-tonal"` (utility que
   * wrapea el mixin SCSS `tonal-variant` en `src/styles.scss`). Útil
   * para CTAs secundarias de peso similar al primary donde
   * outlined-secondary leería como plomo chrome en vez de acción.
   * Uso documentado: pares CTA (Cancelar+Subir, Deshacer+Aleatorio),
   * utility actions del toolbar (Refresh, Density), pares de
   * Aplicar/Limpiar en filtros de columna. Mutuamente exclusiva con
   * `outlined` / `text` — una sola variante a la vez. Combinar la
   * clase tonal con severity es no-op visual porque los tokens
   * primary del mixin ganan via `!important`.
   */
  tonal?: boolean;
}

const meta: Meta<ButtonArgs> = {
  title: 'Primitives/Button',
  tags: ['autodocs'],
  decorators: [moduleMetadata({ imports: [Button, Tooltip] })],
  parameters: {
    docs: {
      description: {
        component: [
          'Botón de acción estándar (`<p-button>`). `severity` controla',
          'la jerarquía visual — omitir para la acción primary de la',
          'página, `secondary` para la default secundaria, `danger` para',
          'destructiva, `contrast` cuando un icon-only necesita destacar',
          'sobre una surface ocupada.',
          '',
          'Para CTAs secundarias pareadas de peso similar al primary',
          '(Cancelar+Subir, Deshacer+Aleatorio) usar la variante `tonal`',
          '— estilo Material 3 filled-tinted. Outlined-secondary en esa',
          'posición lee como plomo chrome y rompe la jerarquía de',
          'call-to-action. Ver stories `Tonal` y `TonalPairWithPrimary`.',
          '',
          'Icon-only buttons DEBEN declarar `ariaLabel` y `pTooltip`',
          'juntos para que screen readers y usuarios de pointer puedan',
          'descubrir la acción. Enforced por',
          '`showcase/no-icon-button-without-tooltip`.',
        ].join(' '),
      },
    },
  },
  argTypes: {
    label: { control: 'text', description: 'Label visible. Omitir para icon-only.' },
    icon: {
      control: 'text',
      description: 'Font Awesome class string (ej: `fa-sharp fa-regular fa-bell`).',
    },
    iconPos: {
      control: 'select',
      options: ['left', 'right', 'top', 'bottom'],
      description: 'Dónde se ubica el icon respecto al label.',
    },
    severity: {
      control: 'select',
      options: [undefined, 'secondary', 'success', 'info', 'warn', 'help', 'danger', 'contrast'],
      description: 'Peso visual. Omitir para la acción primary de la página.',
    },
    text: { control: 'boolean', description: 'Sin borde / fondo mínimo.' },
    outlined: { control: 'boolean', description: 'Outline con stroke, sin fill.' },
    rounded: { control: 'boolean', description: 'Forma capsule completa.' },
    raised: { control: 'boolean', description: 'Agrega sombra sutil. Evitar en este DS.' },
    size: {
      control: 'select',
      options: [undefined, 'small', 'large'],
      description: 'Usar `large` solo para hero CTAs; default para todo lo demás.',
    },
    disabled: { control: 'boolean' },
    loading: {
      control: 'boolean',
      description: 'Spinner integrado. Nunca renderizar spinner externo — usar este.',
    },
    ariaLabel: { control: 'text', description: 'Obligatorio cuando `label` se omite.' },
    pTooltip: { control: 'text', description: 'Obligatorio cuando `label` se omite.' },
    tonal: {
      control: 'boolean',
      description:
        'Variante tonal de Material 3. Se aplica via `class="p-button-tonal"`. ' +
        'Para CTAs secundarias pareadas donde outlined leería como chrome.',
    },
  },
  render: (args) => ({
    props: args,
    // Nota: `[class.p-button-tonal]` es el binding canónico para la
    // variante tonal. La clase del host forwardea al inner button de
    // PrimeNG en v20+, y el mixin `tonal-variant` (`src/styles.scss`)
    // maneja states light/dark + hover/active. Mutuamente exclusiva
    // con `text`/`outlined`.
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
        [class.p-button-tonal]="tonal"
      />
    `,
  }),
};

export default meta;
type Story = StoryObj<ButtonArgs>;

/**
 * Default: acción primary de la página. Sin severity, solo label.
 *
 * Demo bilingüe — toggleá el flag 🇪🇸/🇬🇧 del toolbar para ver el
 * label cambiar entre "Guardar" y "Save". Pattern canónico para
 * stories nuevas con demo bilingüe: usar `bilingualRender(dict,
 * template)` desde `i18n.ts`. Si tu story es solo español (el caso
 * normal del 90%) usa `args: { label: 'Guardar' }` directo sin el
 * helper.
 */
export const Primary: Story = {
  render: bilingualRender(
    { label: { es: 'Guardar', en: 'Save' } },
    `<p-button [label]="label" />`,
  ),
};

/** Secondary: la variante más común en templates reales. */
export const Secondary: Story = {
  render: bilingualRender(
    { label: { es: 'Cancelar', en: 'Cancel' } },
    `<p-button [label]="label" severity="secondary" />`,
  ),
};

/** Outlined secondary: igualmente común, para form actions no primary. */
export const SecondaryOutlined: Story = {
  render: bilingualRender(
    { label: { es: 'Cancelar', en: 'Cancel' } },
    `<p-button [label]="label" severity="secondary" outlined />`,
  ),
};

/** Variante text: chrome mínimo. Default para icon-only buttons en toolbars. */
export const SecondaryText: Story = {
  render: bilingualRender(
    { label: { es: 'Detalles', en: 'Details' } },
    `<p-button [label]="label" severity="secondary" text />`,
  ),
};

/** Acción destructiva — siempre parear con confirm dialog en producción. */
export const Danger: Story = {
  render: bilingualRender(
    { label: { es: 'Eliminar', en: 'Delete' } },
    `<p-button [label]="label" severity="danger" />`,
  ),
};

/** Contrast: alto énfasis icon-only sobre surfaces ocupadas (bookmark de movie card). */
export const Contrast: Story = {
  render: bilingualRender(
    { label: { es: 'Quitar de favoritos', en: 'Remove from favorites' } },
    `
      <p-button
        icon="fa-sharp fa-solid fa-bookmark"
        severity="contrast"
        text
        rounded
        [ariaLabel]="label"
        [pTooltip]="label"
      />
    `,
  ),
};

/** Con icon — acción típica "Guardar / Descargar". */
export const WithIcon: Story = {
  render: bilingualRender(
    { label: { es: 'Descargar', en: 'Download' } },
    `<p-button [label]="label" icon="fa-sharp fa-regular fa-download" iconPos="left" />`,
  ),
};

/** Loading state — disabled + spinner. Nunca renderizar spinner externo. */
export const Loading: Story = {
  render: bilingualRender(
    { label: { es: 'Guardando…', en: 'Saving…' } },
    `<p-button [label]="label" [loading]="true" />`,
  ),
};

/** Disabled state — Aura aplica opacity 0.5 + cursor not-allowed. */
export const Disabled: Story = {
  render: bilingualRender(
    { label: { es: 'Guardar', en: 'Save' } },
    `<p-button [label]="label" disabled />`,
  ),
};

/** Icon-only — DEBE declarar ariaLabel + pTooltip juntos. */
export const IconOnly: Story = {
  render: bilingualRender(
    { label: { es: 'Notificaciones', en: 'Notifications' } },
    `
      <p-button
        icon="fa-sharp fa-regular fa-bell"
        severity="secondary"
        text
        [ariaLabel]="label"
        [pTooltip]="label"
      />
    `,
  ),
};

/**
 * Variante tonal — Material 3 filled-tinted, mismo hue primary a menor
 * intensidad. **Cuándo**: CTAs secundarias pareadas donde
 * outlined-secondary leería como plomo chrome y rompería la jerarquía
 * de acción. **Cuándo NO**: acción primary standalone (usar default);
 * destructiva (usar `danger`); utility button solo sobre una surface
 * ocupada (usar `text` + `severity` de la surface). Ver
 * `TonalPairWithPrimary` para el pareado canónico.
 *
 * Aplicada via `class="p-button-tonal"`. El mixin token
 * (`tonal-variant` en `src/styles.scss`) ya trae states hover/active
 * para temas light + dark — sin styling per-call.
 */
export const Tonal: Story = {
  render: bilingualRender(
    { label: { es: 'Deshacer', en: 'Undo' } },
    `<p-button [label]="label" class="p-button-tonal" />`,
  ),
};

/**
 * Pareo canónico: tonal + primary uno al lado del otro. Los dos
 * botones cargan peso visual similar — ambos call-to-action, ambos
 * filled, ambos primary-tinted — pero el primary es inequívocamente
 * el next step. Este es el patrón que customers/cards/inbox usan
 * para CTAs pareadas.
 *
 * Outlined-secondary en la posición tonal inclinaría la balanza
 * visual hacia primary y leería como Cancel+Submit en vez de dos
 * acciones válidas de peso equivalente.
 */
export const TonalPairWithPrimary: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Tonal pegado al primary — dos CTAs de peso similar sin que ' +
          'primary se vuelva visualmente avasallante. Usar cuando ambas ' +
          'acciones son igualmente válidas (Deshacer + Aleatorio en ' +
          'customers, Cancelar + Subir en cards upload).',
      },
    },
  },
  render: bilingualRender(
    {
      undoLabel: { es: 'Deshacer', en: 'Undo' },
      randomLabel: { es: 'Aleatorio', en: 'Randomize' },
    },
    `
      <div style="display: flex; gap: 0.5rem; align-items: center;">
        <p-button [label]="undoLabel" class="p-button-tonal" />
        <p-button [label]="randomLabel" />
      </div>
    `,
  ),
};

/**
 * Tonal icon-only — útil en toolbars donde múltiples utility actions
 * comparten real estate visual (Refresh + Density + …) y necesitan
 * leerse como "acciones" en vez de "chrome secundario".
 *
 * Per `showcase/no-icon-button-without-tooltip`, `ariaLabel` +
 * `pTooltip` son obligatorios. Per `showcase/no-color-on-pbutton-icon`,
 * el icon string no debe traer color classes (el mixin tonal posee
 * el color).
 */
export const TonalIconOnly: Story = {
  render: bilingualRender(
    { label: { es: 'Actualizar', en: 'Refresh' } },
    `
      <p-button
        icon="fa-sharp fa-regular fa-arrows-rotate"
        class="p-button-tonal"
        [ariaLabel]="label"
        [pTooltip]="label"
      />
    `,
  ),
};

/**
 * Grid de comparación: cada variante usada en producción.
 *
 * Los labels de la primera fila usan los **nombres canónicos de
 * PrimeNG severity** (`secondary`, `success`, `info`, `warn`, `help`,
 * `danger`, `contrast`) — son keywords de la API, no copy de UI, así
 * que se mantienen en inglés para que el reviewer pueda mapearlos
 * directo al valor del prop `severity`. La fila tonal usa labels
 * traducibles porque ahí no hay equivalente "severity API" — es una
 * branch paralela al sistema severity.
 */
export const SeverityGrid: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Vista de comparación de cada variante usada en producción. ' +
          'Nota que `tonal` es mutuamente exclusiva con `severity` — ' +
          'los tokens primary del mixin tonal ganan via `!important`, ' +
          'así que la fila se muestra como branch paralela, no como ' +
          'columna de severity. Los labels de la primera fila ' +
          '(`Default`, `Secondary`, etc.) son los nombres canónicos ' +
          'del prop `severity` de PrimeNG — keywords de API, no copy ' +
          'de UI — por eso se mantienen como literales en inglés.',
      },
    },
  },
  render: bilingualRender(
    {
      tonalLabel: { es: 'Tonal', en: 'Tonal' },
      tonalDisabledLabel: { es: 'Tonal deshabilitado', en: 'Tonal disabled' },
      refreshLabel: { es: 'Actualizar', en: 'Refresh' },
    },
    `
      <div style="display: flex; flex-direction: column; gap: 1rem;">
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
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center;">
          <p-button [label]="tonalLabel" class="p-button-tonal" />
          <p-button [label]="tonalDisabledLabel" class="p-button-tonal" disabled />
          <p-button
            icon="fa-sharp fa-regular fa-arrows-rotate"
            class="p-button-tonal"
            [ariaLabel]="refreshLabel"
            [pTooltip]="refreshLabel"
          />
        </div>
      </div>
    `,
  ),
};
