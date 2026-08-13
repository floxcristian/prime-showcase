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
 *   3. **Docs pages are tag-driven** (Storybook 10 behavior — there is no
 *      `docs.autodocs` config key anymore): a story file gets a generated
 *      Docs page only when its meta declares `tags: ['autodocs']`. This
 *      config only sets the page's `defaultName`. Compodoc is DISABLED
 *      (`compodoc: false` in angular.json storybook/build-storybook
 *      targets), so argTypes come from Storybook's own inference, not from
 *      compodoc-extracted Angular metadata.
 */
const config: StorybookConfig = {
  framework: {
    name: '@storybook/angular',
    options: {},
  },

  stories: [
    '../src/stories/**/*.mdx',
    '../src/stories/**/*.stories.@(js|ts|mdx)',
  ],

  addons: [
    '@storybook/addon-docs',
    '@storybook/addon-a11y',
    '@storybook/addon-themes',
    '@chromatic-com/storybook',
  ],

  staticDirs: [
    // Maps public/ to the Storybook web root so FontAwesome CSS + assets
    // resolve at `/fontawesome/...` exactly like in the running Angular app.
    { from: '../public', to: '/' },
  ],

  docs: {
    // Name of the generated Docs page for stories that opt in via
    // `tags: ['autodocs']` in their meta. Docs generation itself is
    // tag-driven (see header note 3).
    defaultName: 'Docs',
  },

  typescript: {
    // Skip fork-ts-checker type checking during the Storybook build — the
    // repo's own `npm run lint` / `ng build` already typecheck. Compodoc is
    // disabled in angular.json, so there is no compodoc-based argTypes
    // extraction here.
    check: false,
    checkOptions: {},
  },

  core: {
    disableTelemetry: true,
  },
};

export default config;
