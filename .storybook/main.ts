import type { StorybookConfig } from '@storybook/angular';

/**
 * @fileoverview Storybook 10 main config.
 *
 * Three intentional choices a contributor should know about:
 *
 *   1. **Stories live in a dedicated tree** (`src/stories/**`), not co-located
 *      with components. Co-location is fine for a tiny library; for a growing
 *      team (10+ devs) keeping stories in `src/stories/` makes the catalog
 *      reviewable end-to-end and lets us split primitives / recipes / tokens
 *      cleanly. Matches Polaris (`packages/polaris-react/src/components`
 *      stories) and Atlassian DS conventions.
 *
 *   2. **Static dir is `public/`** so FontAwesome CSS and any other static
 *      assets resolve at the same URLs as in the running app. Without this,
 *      icon glyphs render as squares in stories.
 *
 *   3. **`autodocs: 'tag'`** opts components into Storybook's Docs page
 *      generation only when they declare the `autodocs` tag in their meta.
 *      Avoids spurious docs pages on internal stories we don't want to
 *      surface in the catalog.
 */
const config: StorybookConfig = {
  framework: {
    name: '@storybook/angular',
    options: {},
  },

  stories: ['../src/stories/**/*.mdx', '../src/stories/**/*.stories.@(js|ts|mdx)'],

  addons: ['@storybook/addon-docs', '@storybook/addon-a11y', '@storybook/addon-themes', '@chromatic-com/storybook'],

  staticDirs: [
    // Maps public/ to the Storybook web root so FontAwesome CSS + assets
    // resolve at `/fontawesome/...` exactly like in the running Angular app.
    { from: '../public', to: '/' },
  ],

  docs: {
    // Generate docs only for components that opt in via the `autodocs` tag.
    // Avoids noise from internal-only stories. Storybook 8+ convention.
    defaultName: 'Docs',
  },

  typescript: {
    // Use the type-aware compodoc generator for argTypes inference. This
    // gives editors and Docs pages real type information from the Angular
    // component metadata, not stringly-typed guesses.
    check: false,
    checkOptions: {},
  },

  // Build-time config tweaks. Storybook's Angular builder routes through
  // `@angular/build`; we override only what's necessary for our project.
  webpackFinal: undefined,

  // Pre-bundle expensive deps for faster cold-start.
  core: {
    disableTelemetry: true,
  },
};

export default config;
