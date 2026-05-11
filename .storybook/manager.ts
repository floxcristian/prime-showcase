import { addons } from 'storybook/manager-api';
import { create } from 'storybook/theming/create';

/**
 * Storybook manager (UI shell) theming.
 *
 * Custom theme so the catalog reads as part of the project, not a generic
 * Storybook install. Uses our primary-500 (#0074c2) as the brand color so
 * selected items and links match the running app.
 *
 * Why a custom theme and not the default light/dark Storybook themes:
 *   - Reviewers from outside the team open the catalog URL; consistent
 *     branding tells them "this is Prime Showcase", not "this is
 *     Storybook for some Angular app".
 *   - The brand color in the chrome serves as a free design-system
 *     verification — if our primary palette ever drifts, the Storybook
 *     chrome looks wrong before any component does.
 */
const theme = create({
  base: 'light',
  brandTitle: 'PrimeNG Showcase — Design System',
  brandUrl: 'https://github.com/floxcristian/prime-showcase',
  brandTarget: '_self',

  // Brand color from src/app/app.preset.ts → AppPreset.semantic.primary.500
  // (verified by tools/design-tokens/sync.mjs against DESIGN.md). Hard-coded
  // here intentionally — the manager UI is outside the Angular cascade so
  // CSS variables aren't available; a one-line drift comment is enough.
  colorPrimary: '#0074c2',
  colorSecondary: '#0074c2',

  // App surfaces — neutral, matches the running app's surface ramp.
  appBg: '#fafafa',
  appContentBg: '#ffffff',
  appBorderColor: '#e4e4e7',
  appBorderRadius: 8,

  // Typography — Inter Variable, matches production.
  fontBase:
    '"Inter Variable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  fontCode:
    'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", monospace',

  // Text
  textColor: '#18181b',
  textInverseColor: '#fafafa',
  textMutedColor: '#52525b',

  // Toolbar default and active colors
  barTextColor: '#52525b',
  barSelectedColor: '#0074c2',
  barBg: '#ffffff',

  // Form colors
  inputBg: '#ffffff',
  inputBorder: '#e4e4e7',
  inputTextColor: '#18181b',
  inputBorderRadius: 8,
});

addons.setConfig({
  theme,
  // Sidebar — collapsed root showcase improves scannability when the
  // catalog grows past ~30 stories. Without this, sidebar overflows.
  sidebar: {
    showRoots: true,
  },
  // Toolbar — keep zoom, eyes, viewport, theme. Hide what we don't use.
  toolbar: {
    title: { hidden: false },
    zoom: { hidden: false },
    eject: { hidden: false },
    copy: { hidden: false },
    fullscreen: { hidden: false },
  },
});
