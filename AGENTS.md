# PrimeNG Showcase — Agent Guide

Guía tool-agnostic para cualquier agente (Claude Code, Codex, Cursor) o reviewer humano que trabaje en este repo. La identidad visual vive en [`DESIGN.md`](./DESIGN.md). Las recetas detalladas viven en `.claude/rules/*.md` (path-scoped: solo cargan cuando son relevantes).

## Stack

- **Angular 21** — standalone components, signals, new control flow (`@if`, `@for`)
- **PrimeNG 21** con tema **Aura** (`@primeuix/themes`)
- **Tailwind CSS 4** con plugin `tailwindcss-primeui`
- **Font Awesome Pro 7** (self-hosted; familias: sharp-regular, sharp-solid, sharp-duotone-regular, brands)
- **SCSS** vacío (solo por convención — todo el estilizado va en Tailwind sobre el template)
- **TypeScript strict mode** (`strictTemplates`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature`)
- **Zoneless change detection** (`provideZonelessChangeDetection()`, sin `zone.js`)
- **SSR** con `@angular/ssr` + Incremental Hydration

## Reglas críticas — leer SIEMPRE antes de generar código

1. **PrimeNG primero.** Usar componentes nativos de PrimeNG. No crear custom components si PrimeNG ya tiene uno.
2. **Solo design tokens.** Nunca `text-gray-500`, `bg-blue-100`, `#fff`. Solo `text-color`, `bg-surface-*`, `bg-primary`. Detalle en [`DESIGN.md`](./DESIGN.md).
3. **OnPush + standalone.** Todos los componentes. Sin excepciones.
4. **Tailwind en template, SCSS vacío.** Cero CSS en `.scss`. Todo con clases Tailwind en HTML.
5. **Consistencia con lo existente.** Antes de implementar cualquier feature, revisar componentes en `src/app/modules/` y replicar sus patrones exactos. Nunca inventar nuevos patrones.

## Componentes: PrimeNG primero

- **Siempre** usar componentes nativos de PrimeNG antes de crear custom.
- Botones de acción: `<p-button>` o `<button pButton>`.
- Inputs: `<input pInputText>`, `<p-inputnumber>`, `<p-textarea>`.
- Tablas: `<p-table>` — nunca tablas HTML custom.
- Selects: `<p-select>`, `<p-selectbutton>`, `<p-multiselect>`.
- Overlays: `<p-dialog>`, `<p-popover>`, `<p-menu>`, `<p-tooltip>`.
- Feedback: `p-toast`, `p-confirmdialog`, `p-progressbar`, `p-tag`.
- Si PrimeNG no tiene componente para el caso de uso: construir con Tailwind + design tokens (nunca CSS arbitrario).

Recetas detalladas (botones, tags, avatares, tablas, popover, menú, etc.) en `.claude/rules/primeng-patterns.md`.

## Templates HTML

- Usar `@if`, `@for`, `@switch` (Angular 17+ control flow). **Nunca** `*ngIf` o `*ngFor`.
- `@for` siempre requiere `track`.
- No usar `@else` — preferir bloques `@if` separados (patrón del proyecto).
- `[(ngModel)]` para two-way binding en formularios simples.

```html
@for (item of items; track item.id) {
  <div class="flex items-center gap-2">
    <span class="text-color font-medium">{{ item.name }}</span>
  </div>
}

@if (isVisible) {
  <p-dialog header="Title" [(visible)]="isVisible">...</p-dialog>
}
```

## Routing

Agregar nuevas rutas como children en `src/app/app.routes.ts`:

```typescript
{
  path: 'nueva-ruta',
  loadComponent: () =>
    import('./modules/feature/feature.component').then(
      (m) => m.FeatureComponent
    ),
}
```

## Storybook

El catálogo vive en `src/stories/` y se publica en GitHub Pages en cada push a `main` (workflow `.github/workflows/storybook.yml`). Tres trees:

```
src/stories/
  tokens/        ← Colors.mdx, Typography.mdx, …
  primitives/    ← Button, Card, Tag, Avatar, ListItem, EmptyState
  recipes/       ← PageHeader, FormCard, …
```

Al agregar un componente nuevo o una receta compuesta, **agregar story** en el tree correspondiente. Es el contrato visual que el equipo de 10+ devs consume para no divergir. Source of truth del preset: `src/app/app.preset.ts` (compartido entre runtime app y Storybook).

### Idioma del catálogo

**Default: español.** El equipo trabaja en español, así que toda la documentación de stories (JSDoc, `parameters.docs.description.*`, `argTypes[*].description`) se escribe en español primero. La opción de inglés del toolbar (🇪🇸/🇬🇧) cambia únicamente el **contenido interactivo** de las stories que opt-in (labels de botón, captions, table cells de demo) — no las descripciones de docs, que `autodocs` evalúa estáticamente al cargar el meta.

**Default ergonómico — solo español (90 % de las stories)**:

```ts
export const Primary: Story = {
  args: { label: 'Guardar' },
};
```

Sin imports, sin ceremonia. Si la story no necesita demo bilingüe (la mayoría) — no envolver con `tr()` ni `bilingualRender()`.

**Demo bilingüe** (cuando el demo sirve para validar copy localizado o para revisores externos):

```ts
import { bilingualRender } from '../i18n';

export const Primary: Story = {
  render: bilingualRender(
    { label: { es: 'Guardar', en: 'Save' } },
    `<p-button [label]="label" />`,
  ),
};
```

El helper `bilingualRender(dict, template, extraProps?)` toma:
1. Un dict de props bilingües (`Record<string, { es, en? }>`).
2. El template Angular.
3. Opcionalmente, props no-traducidos que se mergean tal cual.

Helpers expuestos en [`src/stories/i18n.ts`](src/stories/i18n.ts):
- `tr(str, locale)` — traducción puntual cuando `bilingualRender` es overkill.
- `getLocale(ctx)` — narrowing seguro de `ctx.globals.locale` (typed `unknown`) a `Locale`. Usar siempre este helper en vez de leer el global directo — un typo en el key falla silencioso de otro modo.

El campo `en` siempre es opcional — si se omite, el helper cae al `es`.

Patrones de referencia:
- [`src/stories/primitives/Button.stories.ts`](src/stories/primitives/Button.stories.ts) — 11 stories bilingües con `bilingualRender`.
- [`src/stories/primitives/DensityToggle.stories.ts`](src/stories/primitives/DensityToggle.stories.ts) — wrapper component con `input<Locale>()` reactivo a cambios del toolbar.

Configuración del toolbar: `.storybook/preview.ts → globalTypes.locale` + `initialGlobals.locale: 'es'`.

## Organización de archivos

```
src/app/modules/feature-name/
  feature-name.component.ts
  feature-name.component.html
  feature-name.component.scss      ← vacío, solo por convención
  constants/                       ← constantes y configuraciones
  mocks/                           ← datos mock
  models/                          ← interfaces y tipos
```

- Interfaces en archivos `.interface.ts`. PascalCase, propiedades camelCase.
- Constantes en UPPER_SNAKE_CASE, tipadas: `export const ITEMS: ItemType[] = [...]`.
- Mocks en archivos separados, tipados con interfaces, datos realistas (10-15 items).
- Un export por archivo de constante/mock.

Estructura de componente y patrones de host class detallados en `.claude/rules/component-architecture.md`.

## Servicios y estado

- Servicios con `providedIn: 'root'`.
- Estado con `signal()`, derivados con `computed()`.
- Side effects con `effect()`.
- `AppConfigService` para acceso al tema/dark mode.
- No usar librerías de state management externas.
- No usar RxJS para estado de UI local — preferir signals.

## Build budgets

- Initial bundle: **750kB** (warn) / **1MB** (error)
- Component styles: **4kB** (warn) / **8kB** (error)

## Comandos

| Comando | Qué hace | Cuándo correrlo |
|---|---|---|
| `npm run lint` | `ng lint` (HTML + TS) **+** `lint:rules:test` (RuleTester suites) **+** `design-tokens:test` (resolver unit tests) **+** `design-tokens:check` (drift vs `app.preset.ts` + `tokens.json`) | Antes de cada commit |
| `npm run lint:fix` | Igual que `lint` con autofix | Limpiar warnings mecánicas |
| `npm run lint:rules:test` | Solo tests del plugin local | Al modificar `tools/eslint/rules/*` |
| `npm run design-tokens:test` | Tests unitarios del resolver de tokens | Al modificar `tools/design-tokens/resolver.mjs` |
| `npm test` | `ng test` → vitest sobre `src/**/*.spec.ts` | Cambios en componentes/servicios |
| `npm run build` | Build de producción + valida budgets | Antes de PR |
| `npm run test:ssr:smoke` | 4 cookie cases del dark-mode SSR (necesita `serve:ssr:prime-showcase` en `:4000`) | Cambios en SSR/theme/cookie |
| `npm run verify` | `lint && build && bundle:check && smoke` end-to-end | **Antes de pushear** — paridad exacta con CI |
| `npm run storybook` | Dev server del catálogo en `:6006` | Construir/explorar primitivas y recipes |
| `npm run build-storybook` | Build estático del catálogo a `dist/storybook/` | Antes de PR si tocaste stories |
| `npm run visual` / `npm run visual:update` | Playwright golden-path baselines | Cambios visuales intencionales |
| `npm run visual:baseline` | Orquestador: build + serve + install + `--update-snapshots` end-to-end | Refrescar baselines locales (preferir el workflow `Visual baselines (manual)` para evitar el flag local) |
| `npm run a11y` | axe-core scan vía Playwright | Cualquier cambio que afecte semántica/contraste |
| `npm run design-tokens:check` / `:sync` | Drift detector (`DESIGN.md` + `design-tokens/tokens.json` vs preset) / regenerar ambos artefactos | Después de modificar `app.preset.ts` |

CI (`.github/workflows/ci.yml`) corre el equivalente de `verify` en cada push a main y cada PR.

## Lo que NO hacer

### Estilos
Ver [`DESIGN.md`](./DESIGN.md) sección "Do's and Don'ts" — todo lo relativo a tokens, spacing, typography, shadows, transitions, etc.

### Componentes
- No crear componentes custom si PrimeNG ya tiene uno equivalente.
- No crear abstracciones prematuras o wrappers innecesarios sobre componentes PrimeNG.
- No usar `<button>` sin `pButton` para **botones de acción** (submit, cancel, download). Excepción: nav items y list items interactivos usan clases Tailwind propias (ver DESIGN.md).
- No usar tablas HTML. Siempre `<p-table>`.
- No usar `*ngIf`, `*ngFor` u otras directivas estructurales legacy. Usar `@if`, `@for`.
- No usar `@else` — preferir bloques `@if` separados.

### Arquitectura
- No crear NgModules. Todo standalone.
- No usar `Default` change detection. Siempre `OnPush`.
- No agregar dependencias nuevas sin justificación (no Material, Bootstrap, Heroicons, etc.).
- No inicializar datos complejos en el constructor. Usar `ngOnInit()` o field initializers.
- No usar constructor para DI. Preferir `inject()`.
- No crear servicios con estado que deberían ser signals en el componente.
- No usar RxJS para estado de UI local. Preferir signals.
- No usar pipes en templates (`| date`, `| number`). Formatear datos en el componente (.ts).

### Charts
- No usar colores hex en datasets de charts. Siempre CSS variables del tema.
- No usar la legend built-in de Chart.js. Crear legend custom con HTML.
