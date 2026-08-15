import { addons } from 'storybook/manager-api';
import { create } from 'storybook/theming/create';

/**
 * Storybook manager (UI shell) theming.
 *
 * Custom theme so the catalog reads as part of the project, not a generic
 * Storybook install. Uses our primary-500 (#006db6 — PANTONE 300 U, the
 * Implementos base blue) as the brand color so selected items and links
 * match the running app.
 *
 * Why a custom theme and not the default light/dark Storybook themes:
 *   - Reviewers from outside the team open the catalog URL; consistent
 *     branding tells them "this is Prime Showcase", not "this is
 *     Storybook for some Angular app".
 *   - The brand color in the chrome serves as a free design-system
 *     verification — if our primary palette ever drifts, the Storybook
 *     chrome looks wrong before any component does.
 *
 * That eyeball check is also the ONLY thing watching this file, and it is
 * worth being blunt about it. The manager UI renders outside the Angular
 * cascade, so no `--p-*` variable reaches it: every value below is a
 * hand-kept copy of a token. Neither `design-tokens:check` (DESIGN.md vs
 * preset) nor `design-tokens:brand` (OKLCH derivation + contrast) parses
 * this file. When the palette moves, this file moves by hand, in the same
 * commit — otherwise the chrome keeps painting the previous brand and
 * nothing fails.
 */
const theme = create({
  base: 'light',
  brandTitle: 'PrimeNG Showcase — Design System',
  brandUrl: 'https://github.com/floxcristian/prime-showcase',
  brandTarget: '_self',

  // Brand color from src/app/app.preset.ts → AppPreset.semantic.primary.500,
  // which reproduces PANTONE 300 U byte for byte. The rest of the ramp is
  // derived in OKLCH at a constant 248.2° hue, so this hex is the anchor of
  // the ramp, not a shade picked out of it.
  //
  // `colorSecondary` repeats primary on purpose instead of reaching for the
  // brand green (accent.500, PANTONE 334 U). The manual lists "green as
  // dominant instead of accent" as an explicit error, and the manager chrome
  // is permanent surface — every pixel of it is dominant by definition. The
  // green belongs inside the stories, not in the frame around them.
  colorPrimary: '#006db6',
  colorSecondary: '#006db6',

  // App surfaces — the Implementos corporate neutral, anchored on PANTONE
  // Cool Gray 10 C (#636569 = surface.500). It replaces the ramps we used to
  // inherit from Aura without declaring them (slate in light, zinc in dark):
  // those were a default, not a decision, and they made the chrome grey a
  // framework leftover instead of the brand's grey. One single ramp now
  // serves both modes, so a surface never changes temperature on toggle.
  appBg: '#f9fafb', // surface.50
  appContentBg: '#ffffff', // surface.0
  appBorderColor: '#e2e4e7', // surface.200
  appBorderRadius: 8,

  // Typography — Inter Variable, matches production.
  fontBase:
    '"Inter Variable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  fontCode:
    'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", monospace',

  // Text — same neutral ramp. `textMutedColor` sits at surface.600, the same
  // step the app pins `text.muted.color` to (8.8:1 on surface.0): the muted
  // default one step lighter drops under AA on tinted rows.
  textColor: '#151619', // surface.900
  textInverseColor: '#f9fafb', // surface.50
  textMutedColor: '#484a4e', // surface.600

  // Toolbar default and active colors
  barTextColor: '#484a4e', // surface.600
  barSelectedColor: '#006db6', // primary.500
  barBg: '#ffffff', // surface.0

  // Form colors
  inputBg: '#ffffff', // surface.0
  inputBorder: '#e2e4e7', // surface.200
  inputTextColor: '#151619', // surface.900
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
