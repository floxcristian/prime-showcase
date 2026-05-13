import { ChangeDetectionStrategy, Component, computed, input, signal, type Signal } from '@angular/core';
import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { Button } from 'primeng/button';
import { Tooltip } from 'primeng/tooltip';

import { getLocale, tr, type Locale } from '../i18n';

/**
 * **Density toggle** — botón binario en cycle para el modo de
 * densidad de filas de una data table (`compact` ↔ `comfortable`).
 *
 * **Por qué toggle y no popover / select**: con exactamente 2
 * opciones, un popover requiere 2-3 clicks (abrir, apuntar, elegir)
 * y choca con el race del popover de PrimeNG (un click en el trigger
 * durante open-state no cierra porque el outside-click dispara
 * primero). Un cycle directo es 1 click y se lee como toggle de un
 * vistazo. Linear, Notion y Vercel siguen el mismo patrón.
 *
 * **Convención del icon**: el icon muestra el *próximo* estado —
 * mismo patrón forward-affordance que el dark-mode toggle del
 * toolbar global (☀ cuando dark = "click para light"). Esta es la
 * convención del proyecto; flipear la convención por componente
 * crea ruido cognitivo.
 *
 * **Tooltip**: descripción state-aware + acción — "Densidad cómoda ·
 * clic para vista compacta". Lee el estado actual en voz alta para
 * que el usuario nunca esté adivinando, y framea el click como
 * navegación dirigida. Per `showcase/no-icon-button-without-tooltip`
 * un `<p-button>` icon-only requiere `ariaLabel` y `pTooltip` —
 * acá ambos bound al mismo string dinámico.
 *
 * **Background tonal**: el botón usa `class="p-button-tonal"` así la
 * affordance se lee como utility action en el toolbar, no como
 * chrome. Ver `Primitives/Button` → `Tonal`.
 *
 * **Persistencia (responsabilidad del consumer)**: el toggle no
 * posee storage. Los consumers persisten la densidad elegida en
 * `localStorage` para que sobreviva reloads — ver
 * `customers.component.ts → readDensityFromStorage` para el patrón
 * canónico.
 *
 * **Token wiring (responsabilidad del consumer)**: el padding /
 * font-size / scaling del row content vive en el override `[dt]`
 * del consumer + una clase wrapper (`.customers-table--compact` en
 * customers). El toggle solo flipea el signal; el consumer se
 * subscribe y re-aplica tokens. Ver `Recipes/Data Table` para la
 * integración completa.
 *
 * **Idioma bilingüe**: tooltips traducidos via `tr()` — toggleá el
 * flag 🇪🇸/🇬🇧 del toolbar para ver el contenido switchar.
 */

type Density = 'compact' | 'comfortable';

const COMPACT_ICON = 'fa-sharp fa-regular fa-bars';
const COMFORTABLE_ICON = 'fa-sharp fa-regular fa-table-rows';

/** Diccionarios de tooltip cuando la densidad ACTUAL es la indicada
 * — el texto describe la acción al click (forward affordance). */
const COMPACT_TOOLTIP = {
  es: 'Densidad compacta · clic para vista cómoda',
  en: 'Compact density · click for comfortable view',
};
const COMFORTABLE_TOOLTIP = {
  es: 'Densidad cómoda · clic para vista compacta',
  en: 'Comfortable density · click for compact view',
};

/** Lookup centralizado del tooltip según densidad + locale. Single
 * source of truth para que static render y el wrapper component
 * interactivo nunca divergen. */
function tooltipFor(density: Density, locale: Locale): string {
  const dict = density === 'compact' ? COMPACT_TOOLTIP : COMFORTABLE_TOOLTIP;
  return tr(dict, locale);
}

/** Icon que el botón muestra cuando la densidad ACTUAL es la
 * indicada — el icon previsualiza el *próximo* estado. */
function iconFor(density: Density): string {
  return density === 'compact' ? COMFORTABLE_ICON : COMPACT_ICON;
}

/**
 * Wrapper component que posee el signal de estado — necesario porque
 * `props: args` de Storybook es un snapshot one-way; los signals
 * dentro del render function no son re-evaluados por Angular al
 * click.
 *
 * Los consumers de producción NO necesitan este wrapper — ellos
 * poseen el signal `density` directamente en su feature component
 * (ej: `customers.component.ts:density`). El wrapper es affordance
 * story-only.
 */
@Component({
  selector: 'app-density-toggle-demo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button, Tooltip],
  template: `
    <p-button
      [icon]="icon()"
      class="p-button-tonal"
      [ariaLabel]="tooltip()"
      [pTooltip]="tooltip()"
      tooltipPosition="bottom"
      (onClick)="toggle()"
    />
  `,
})
class DensityToggleDemoComponent {
  /** Locale del toolbar — pasado desde el render function via
   * `[locale]="getLocale(ctx)"`. `input()` con default `'es'` y tipo
   * `Locale` estricto: cualquier valor inválido del toolbar es
   * narrowed por `getLocale()` antes de llegar acá, así nunca
   * recibimos `unknown`. SSR-safe / baseline-safe por el default. */
  readonly locale = input<Locale>('es');

  protected readonly density = signal<Density>('comfortable');
  protected readonly icon: Signal<string> = computed(() => iconFor(this.density()));
  protected readonly tooltip: Signal<string> = computed(() => tooltipFor(this.density(), this.locale()));

  protected toggle(): void {
    this.density.update((d) => (d === 'compact' ? 'comfortable' : 'compact'));
  }
}

interface DensityToggleArgs {
  density: Density;
}

const meta: Meta<DensityToggleArgs> = {
  title: 'Primitives/Density Toggle',
  tags: ['autodocs'],
  decorators: [moduleMetadata({ imports: [Button, Tooltip] })],
  parameters: {
    docs: {
      description: {
        component: [
          'Toggle binario para densidad de filas de table',
          '(compact ↔ comfortable). Un click cyclea estado; icon y',
          'tooltip se actualizan al *próximo* estado',
          '(forward-affordance), matcheando la convención del',
          'dark-mode toggle del proyecto. Background tonal se lee',
          'como utility action, no como chrome.',
          '',
          'Ver `customers.component.ts` (`toggleDensity`,',
          '`densityToggleIcon`, `densityToggleTooltip`) para la',
          'implementación canónica del consumer: estado en un',
          '`signal()`, icon/tooltip derivados como `computed()`,',
          'persistencia a `localStorage`, y wiring del `[dt]` token',
          'en el `<p-table>` consumidor.',
        ].join(' '),
      },
    },
  },
  argTypes: {
    density: {
      control: 'inline-radio',
      options: ['compact', 'comfortable'] satisfies Density[],
      description: 'Densidad actual — drivea el icon y tooltip del *próximo* estado.',
    },
  },
  render: (args, ctx) => {
    // Static render path — útil para baselines visuales que necesitan
    // el toggle fijado a un estado específico. El cycle interactivo
    // vive en la story `Interactive` más abajo.
    //
    // `getLocale(ctx)` narrowea el `unknown` del toolbar al tipo
    // `Locale` validado — usar este helper en vez de
    // `ctx.globals?.['locale']` directo es la única forma de evitar
    // typos silenciosos en el key del global.
    const locale = getLocale(ctx);
    return {
      props: {
        icon: iconFor(args.density),
        tooltip: tooltipFor(args.density, locale),
      },
      template: `
        <p-button
          [icon]="icon"
          class="p-button-tonal"
          [ariaLabel]="tooltip"
          [pTooltip]="tooltip"
          tooltipPosition="bottom"
        />
      `,
    };
  },
};

export default meta;
type Story = StoryObj<DensityToggleArgs>;

/**
 * Default = `comfortable`. El icon previsualiza el *próximo* estado
 * (compact: barras horizontales apiladas), así el usuario lee
 * "click va a compactar la tabla". El tooltip espeja esa intención.
 */
export const Comfortable: Story = {
  args: { density: 'comfortable' },
};

/**
 * Estado `compact`. Icon y tooltip flipean a "click para volver a
 * comfortable". Tratamiento de surface idéntico (tonal, icon-only,
 * mismo size) así el toggle nunca shifteea su bounding box al click
 * — solo cambia el glyph del icon.
 */
export const Compact: Story = {
  args: { density: 'compact' },
};

/**
 * Demo interactivo — click para cyclear. El signal vive en el
 * wrapper component (`DensityToggleDemoComponent`); consumers de
 * producción poseen el signal equivalente en su feature component.
 * El wrapper es story-only.
 */
export const Interactive: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Click cyclea `compact ↔ comfortable`. La geometría del ' +
          'botón nunca cambia — solo el glyph del icon y el texto ' +
          'del tooltip — así el bounding box es estable para fines ' +
          'de screen-reader / hit-test.',
      },
    },
  },
  decorators: [moduleMetadata({ imports: [DensityToggleDemoComponent] })],
  render: (_args, ctx) => ({
    props: {
      // `getLocale(ctx)` narrowea `unknown` → `Locale` antes del
      // property binding, así el `input<Locale>('es')` del wrapper
      // recibe siempre un valor del tipo correcto bajo strictTemplates.
      locale: getLocale(ctx),
    },
    // El wrapper component lee el locale via property binding y
    // re-evalúa los computed signals cuando el toolbar cambia.
    template: `<app-density-toggle-demo [locale]="locale" />`,
  }),
};

/**
 * Comparación side-by-side: ambos estados al mismo tiempo. Útil en
 * design review para verificar que el par de icons se lee como
 * "complementary set" (barras horizontales ↔ filas de tabla) y no
 * como dos glyphs arbitrarios.
 */
export const StateComparison: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Ambos estados uno al lado del otro para design review. El ' +
          'par debe leerse como complementario — barras-para-compacto, ' +
          'filas-para-cómodo — no como icons arbitrarios.',
      },
    },
  },
  render: (_args, ctx) => {
    const locale = getLocale(ctx);
    return {
      props: {
        comfortableIcon: COMFORTABLE_ICON,
        compactIcon: COMPACT_ICON,
        // Tooltips reusan el lookup centralizado (`tooltipFor`) que
        // también consume el wrapper component interactivo — single
        // source of truth para que static y interactive nunca divergen.
        compactTooltip: tooltipFor('compact', locale),
        comfortableTooltip: tooltipFor('comfortable', locale),
        comfortableCaption: tr(
          {
            es: 'Cómoda ahora → clic para compactar',
            en: 'Comfortable now → click for compact',
          },
          locale,
        ),
        compactCaption: tr(
          {
            es: 'Compacta ahora → clic para vista cómoda',
            en: 'Compact now → click for comfortable',
          },
          locale,
        ),
      },
      template: `
        <div style="display: flex; gap: 1.5rem; align-items: center;">
          <div style="display: flex; flex-direction: column; align-items: center; gap: 0.5rem;">
            <p-button
              [icon]="comfortableIcon"
              class="p-button-tonal"
              [ariaLabel]="compactTooltip"
              [pTooltip]="compactTooltip"
              tooltipPosition="bottom"
            />
            <span class="text-xs text-muted-color leading-4">{{ comfortableCaption }}</span>
          </div>
          <div style="display: flex; flex-direction: column; align-items: center; gap: 0.5rem;">
            <p-button
              [icon]="compactIcon"
              class="p-button-tonal"
              [ariaLabel]="comfortableTooltip"
              [pTooltip]="comfortableTooltip"
              tooltipPosition="bottom"
            />
            <span class="text-xs text-muted-color leading-4">{{ compactCaption }}</span>
          </div>
        </div>
      `,
    };
  },
};
