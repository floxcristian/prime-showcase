# Changelog

Todos los cambios notables a `prime-showcase` se documentan en este
archivo.

El formato sigue [Keep a Changelog 1.1.0](https://keepachangelog.com/es-ES/1.1.0/)
con una subsección extra: `### Tokens` para cambios en
`src/app/app.preset.ts` y `design-tokens/tokens.json`.

## Sobre el versionado

El `package.json` se mantiene en `version: 0.0.0` porque la app no se
publica a npm. Sin embargo, los **tokens del design system tienen
versionado semántico** trackeado en este archivo:

- **Major** — breaking: rename de token, cambio semántico de un primary
  sin alias de compat, remoción de un primitivo. Requiere ADR + RFC con
  "Migration path" + bump de major en este changelog.
- **Minor** — feature aditiva: nuevo token, nuevo primitivo, nueva regla
  ESLint, deprecación de algo (que sigue funcionando).
- **Patch** — bugfix, refinamiento sin cambio visual significativo,
  ajustes de docs.

El preset `src/app/app.preset.ts` versiona junto con la app. Cambios que
**rompen contratos de tokens** — renombres, semantic change de un
`primary.500` sin alias, retiro de un token público — requieren bump de
major + ADR en `docs/adr/`. Ver [`docs/DEPRECATION.md`](./docs/DEPRECATION.md)
para el lifecycle completo.

`[Unreleased]` se corta a release nombrado cuando un maintainer ejecuta
el workflow de release. Mientras tanto, cada PR mergeada agrega su entry
al `[Unreleased]` correspondiente.

## [Unreleased]

### Added
- **Governance**: `CONTRIBUTING.md`, `docs/RFC_TEMPLATE.md`,
  `docs/DEPRECATION.md`, `docs/GOVERNANCE.md`, `CHANGELOG.md`,
  ADR-002 (`docs/adr/002-semantic-token-layer.md`).
- **Servicios feedback root**: `AppToastService` y `AppConfirmService`
  (`src/app/core/services/{toast,confirm}/*`) — wrappers que congelan
  vocabulario (severity, copy, timing) sobre `MessageService` /
  `ConfirmationService`. `<p-toast position="bottom-right">` y
  `<p-confirmdialog>` montados como singletons en `MainComponent`.
- **Locale provider central**: `APP_LOCALE`, `APP_CURRENCY`,
  `APP_TIME_ZONE` (InjectionTokens) + `AppLocaleService` con cache
  por `(locale, options)` (`src/app/core/locale/*`). Reemplaza
  instancias hardcoded de `Intl.NumberFormat('es-CL', …)` y abre el
  camino a multi-tenant / language picker / pseudo-loc.
- **Primitivos UX shared**: `<app-error-state>`, `<app-loading-state>`,
  `<app-skeleton-list-item>` (+ `-group`), `<app-skeleton-table-row>`,
  `<app-skeleton-card>` con stories propias en `src/stories/primitives/`.
- **Regla ESLint** `showcase/no-arbitrary-duration` —
  forbids numeric `duration-<N>` outside the anchor recipe. Suite de
  tests en `tools/eslint/rules/__tests__/no-arbitrary-duration.test.js`.
- **Codegen design tokens**: `tools/design-tokens/codegen.mjs`
  genera `src/generated/tokens.css` (Tailwind `@theme` con
  `--app-motion-*`, `--app-z-*`, `--app-density-*`, `--app-avatar-initials-*`,
  `--app-elevation-*`) y `tools/eslint/rules/generated/scales.js`
  (escalas spacing/rounded/typography/motion consumidas por reglas
  ESLint). Drift gated en `npm run lint`.
- **Pseudo-localización**: `tools/pseudo-loc/{transform,scan}.mjs` +
  tests (30/30 pass). Detección preventiva de string overflow para
  futura traducción.
- **Adoption metrics**: `tools/adoption/scan.mjs` que mapea Storybook
  stories ↔ uso real en módulos. Reporta huérfanos y módulos con baja
  adopción. CI gate `npm run adoption:ci`.

### Changed
- `app.preset.ts` ahora exporta `PROJECT_TOKENS` (motion / zIndex /
  density / elevation / avatar) — capa semántica que vive paralela al
  preset Aura. Aura emite los colores; este export emite el resto vía
  el codegen.
- `tools/design-tokens/resolver.mjs` y `sync.mjs` consumen
  `PROJECT_TOKENS` y los serializan en `design-tokens/tokens.json`.
- `tools/eslint/rules/no-forbidden-spacing.js`, `-rounded`,
  `-typography` siguen sin cambios pero ahora hay un único shape
  fuente en `tools/eslint/rules/generated/scales.js` listo para que
  consuman.
- `MainComponent.@loading` del notifications overlay usa
  `<app-skeleton-list-item-group>` (antes `@for + <p-skeleton>` ad-hoc).

### Fixed
- `toolbar.component.html:43,50` y `toolbar.component.ts:60`: removidas
  ocurrencias de `duration-200` (ahora cubierto por
  `showcase/no-arbitrary-duration`).
- 8 templates + stories: `!bg-primary-100 !text-primary-950` →
  `app-avatar-initials` (utility en `styles.scss` que consume
  `--app-avatar-initials-{bg,color}` desde PROJECT_TOKENS).

### Tokens
- **Added** `semantic.motion.duration.{instant,fast,base,slow}` y
  `semantic.motion.easing.{standard,decelerate,accelerate}`.
- **Added** `semantic.zIndex.{base,sticky,dropdown,overlay,drawer,modal,toast,tooltip}`.
- **Added** `semantic.density.{productive,compact}.{rowHeight,inputHeight,fontSize}`.
- **Added** `semantic.elevation.{card,overlay,overlayDark}`.
- **Added** `semantic.avatar.initials.{light,dark}.{background,color}`.

---

[Unreleased]: https://github.com/OWNER/prime-showcase/compare/HEAD~...HEAD
