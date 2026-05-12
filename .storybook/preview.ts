import type { Preview } from '@storybook/angular';
import { applicationConfig, moduleMetadata } from '@storybook/angular';
import { provideHttpClient, withFetch } from '@angular/common/http';
import {
  provideAnimationsAsync,
} from '@angular/platform-browser/animations/async';
import {
  provideZonelessChangeDetection,
} from '@angular/core';
import { providePrimeNG } from 'primeng/config';
import { withThemeByClassName } from '@storybook/addon-themes';

// Shared preset — single source of truth used by both the runtime app and
// Storybook. Defined in `src/app/app.preset.ts`; see that file for the
// extraction rationale (production-runtime providers are intentionally NOT
// imported here, only the design-token preset).
import { AppPreset, PRIMENG_OPTIONS } from '../src/app/app.preset';

// App global styles (Tailwind v4 + Inter + dark variant override) are
// injected by Storybook's Angular builder via `browserTarget` in
// angular.json `storybook` target — the same `styles` array that
// production uses. Importing them again here would double-load and run
// them through a second loader chain (webpack's css-loader vs Angular's
// PostCSS chain), causing the Tailwind `@charset`/`@layer` output to be
// reparsed as JS. Don't.

/**
 * Global decorators — applied to every story.
 *
 *   1. `applicationConfig` injects the same providers Angular bootstraps in
 *      production for the design system (PrimeNG + Aura preset + animations
 *      + HTTP client for stories that need to fetch). Router, SSR, auth and
 *      the error handler are intentionally NOT provided — stories are
 *      isolated component cases, not application slices.
 *
 *   2. `moduleMetadata` is empty here; individual stories declare their
 *      component imports via their own `decorators` block (see
 *      Button.stories.ts) keeping the global bundle small.
 *
 *   3. `withThemeByClassName` — wires the Storybook toolbar dark-mode
 *      toggle to the `.p-dark` class on the document root, matching
 *      production's `AppConfigService` behavior. One source of truth for
 *      "what dark mode is" in the project.
 */
const preview: Preview = {
  decorators: [
    applicationConfig({
      providers: [
        provideZonelessChangeDetection(),
        provideAnimationsAsync(),
        provideHttpClient(withFetch()),
        providePrimeNG({
          theme: { preset: AppPreset, options: PRIMENG_OPTIONS },
        }),
      ],
    }),
    moduleMetadata({}),
    withThemeByClassName({
      themes: {
        light: '',
        dark: 'p-dark',
      },
      defaultTheme: 'light',
      // Target `<html>` (documentElement) so the Aura `.p-dark` selector
      // matches in the same way it does in production. Targeting <body>
      // would silently break PrimeNG's dark-mode resolution.
      parentSelector: 'html',
    }),
  ],

  parameters: {
    // Disable the default backgrounds addon — we have our own light/dark
    // toggle via addon-themes and dual sources of truth would conflict.
    backgrounds: { disable: true },

    // Story-area background follows the theme. Matches what the user
    // sees in the running app at the body level.
    layout: 'padded',

    // Viewport presets aligned with our Tailwind breakpoints. Use these
    // from the toolbar to validate responsive recipes per design system.
    viewport: {
      viewports: {
        mobile: {
          name: 'Mobile (375)',
          styles: { width: '375px', height: '812px' },
        },
        tablet: {
          name: 'Tablet (768)',
          styles: { width: '768px', height: '1024px' },
        },
        desktop: {
          name: 'Desktop (1280)',
          styles: { width: '1280px', height: '900px' },
        },
        wide: {
          name: 'Wide (1440)',
          styles: { width: '1440px', height: '900px' },
        },
      },
    },

    // axe-core configuration. Matches the rules enabled in the CI a11y
    // workflow (tests/a11y/axe.spec.ts) so story-level scans and route-
    // level scans use the same gate.
    a11y: {
      config: {
        rules: [
          // Disable color-contrast for icon-only buttons where the
          // tooltip-on-hover covers the affordance. axe doesn't model
          // tooltip-on-hover; route-level scans already cover this.
          { id: 'aria-hidden-focus', enabled: true },
          { id: 'button-name', enabled: true },
          { id: 'color-contrast', enabled: true },
        ],
      },
      test: 'error',
    },

    // Docs page styling — tighter padding, design-system tone.
    docs: {
      toc: { title: 'On this page', headingSelector: 'h2, h3' },
    },

    options: {
      storySort: {
        order: [
          'Introduction',
          'Tokens',
          ['Colors', 'Typography', 'Spacing', 'Motion', 'Z-Index', 'Opacity'],
          'Primitives',
          'Recipes',
          'Patterns',
        ],
      },
    },
  },

  /**
   * Global toolbar args — every story puede leerlos via el segundo
   * argumento de `render(args, context)` para variar contenido demo
   * según el locale activo.
   *
   * **Locale**: cambia el idioma del **contenido interactivo** de las
   * stories (labels de botón, captions de demo, contenido de tabla).
   *
   * **No cambia** las descripciones de docs (`parameters.docs.
   * description.component`) — autodocs las evalúa estáticamente al
   * cargar el meta, no en cada render. La documentación es siempre
   * **español-primario** porque el equipo del proyecto trabaja en
   * español; ese también es el default del toolbar. La opción EN
   * existe para revisores externos o para validar copies localizados
   * en los demos. Migrar las descripciones a bilingüe completo requiere
   * MDX cards custom — fuera de scope para esta iteración.
   *
   * Pattern de uso en stories:
   *
   * ```ts
   * import { tr } from './i18n';
   * render: (args, ctx) => ({
   *   props: { label: tr({ es: 'Guardar', en: 'Save' }, ctx.globals['locale']) },
   *   template: `<p-button [label]="label" />`,
   * }),
   * ```
   */
  globalTypes: {
    locale: {
      name: 'Idioma',
      description:
        'Idioma del contenido interactivo (la documentación estática queda en español)',
      toolbar: {
        title: 'Idioma',
        icon: 'globe',
        items: [
          { value: 'es', title: 'Español', right: '🇪🇸' },
          { value: 'en', title: 'English', right: '🇬🇧' },
        ],
        dynamicTitle: true,
      },
    },
  },

  // Storybook 8+ deprecó `defaultValue` dentro de globalTypes en favor
  // de `initialGlobals` top-level — única forma soportada de fijar el
  // valor inicial del toolbar. Tener ambos era redundante y rompería
  // silenciosamente cuando Storybook remueva el path deprecado.
  initialGlobals: {
    locale: 'es',
  },

  tags: ['autodocs'],
};

export default preview;
