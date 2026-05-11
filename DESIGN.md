---
name: PrimeNG Showcase
version: 1.0.0
description: >
  Design system del PrimeNG Showcase. Source of truth de runtime: preset Aura
  en src/app/app.config.ts. Source of truth de escala: este archivo + las 19
  reglas ESLint en tools/eslint/rules/*. Drift entre ambos detectado por
  tools/design-tokens/sync.mjs (parte de `npm run lint`). Tool-agnostic —
  leído por Claude Code, Codex, Cursor, reviewers humanos y contractors.

# ─── Atmosphere ─────────────────────────────────────────────────────────
# Calm density. ERP en español, sesiones de 8h, usuarios 25–60+.
# 16px base → legibilidad gana a densidad. Single-hue 204° primary
# (Pantone "Implementos blue") — lectura instantánea de marca sin pintar
# todo de azul. Sin sombras: la elevación se construye con borde +
# superficie. Motion casi ausente: animar solo color/opacidad/transform,
# nunca layout. Vocabulario alineado con SAP Fiori 3+, ServiceNow,
# Oracle Redwood — no con Linear/Stripe/Vercel (consumer-tech, target
# distinto).

colors:
  # Primary palette — literal hex, single-hue 204°, generated from
  # the brand logo (#006DB6). Synced from src/app/app.config.ts by
  # tools/design-tokens/sync.mjs; do not hand-edit.
  primary:
    "50": "#eff8ff"
    "100": "#daeffc"
    "200": "#b2ddf9"
    "300": "#74c3f3"
    "400": "#27a0f1"
    "500": "#0074c2"
    "600": "#005c99"
    "700": "#004a7a"
    "800": "#00375c"
    "900": "#002842"
    "950": "#001829"
  # Project-specific overrides on top of Aura defaults. Each entry
  # is checked for drift against app.config.ts.
  semantic:
    textMutedColor:
      light: "{surface.600}"   # AA-bumped from Aura default surface.500
      dark: "{surface.300}"    # AAA-bumped from Aura default surface.400
    focusRingShadow: "0 0 0 0.2rem {primary.200}"
  # Semantic exceptions: nominal colors with FIXED meaning. Never used
  # as general UI palette — only in indicators where the color carries
  # information (status, brand, alert family).
  exceptions:
    violet: { fg: violet-950, bg: violet-100 }   # tags, categorías
    orange: { fg: orange-950, bg: orange-100 }   # warnings, alertas
    yellow: yellow-500                            # BTC icon
    green: green-500                              # online / active dot

typography:
  fontFamily: "Inter, system-ui, sans-serif"
  scale:
    xs:    { fontSize: 12px, lineHeight: 16px }
    sm:    { fontSize: 14px, lineHeight: 20px }   # narrow containers only
    base:  { fontSize: 16px, lineHeight: 24px }   # default for body/nav/input/label
    xl:    { fontSize: 20px, lineHeight: 28px }
    "2xl": { fontSize: 24px, lineHeight: 32px }
    "3xl": { fontSize: 30px, lineHeight: 36px }
  weights:
    normal: 400      # ~5% of usage (checkbox/radio labels)
    medium: 500      # default — ~85% of usage
    semibold: 600    # input labels, nav active, last breadcrumb crumb
    bold: 700        # card titles, hero text-3xl

spacing:
  unit: 4px
  scale:
    "0":  0px
    "1":  4px
    "2":  8px       # default gap
    "3":  12px
    "4":  16px      # default padding, default mt/mb
    "5":  20px
    "6":  24px      # cards, sections
    "8":  32px      # chat-only exception

rounded:
  full: 9999px
  lg:    8px        # buttons, inputs, badges, internal sub-containers
  xl:    12px       # carousel items, media tiles, movie cards
  "2xl": 16px       # data cards (most common)
  "3xl": 24px       # form cards (profile, settings, file upload)

# ─── Motion ─────────────────────────────────────────────────────────────
# Aligned with Polaris (motion-fast, motion-base) and Carbon (productive
# easing). Reduced-motion is honored globally via styles.scss.
motion:
  duration:
    instant: 0ms      # color swap of PrimeNG components (preset override)
    fast: 150ms       # default for transition-colors / transition-opacity
    base: 250ms       # default for transition-transform on overlays
  easing:
    standard: "cubic-bezier(0.2, 0, 0, 1)"      # Aura default
    decelerate: "cubic-bezier(0, 0, 0.2, 1)"
    accelerate: "cubic-bezier(0.4, 0, 1, 1)"
  reducedMotion:
    strategy: "respect prefers-reduced-motion at all times; never animate layout."

# ─── Z-index ladder ─────────────────────────────────────────────────────
# Mirrors Primer's semantic ladder. Use named tokens, never raw numbers
# beyond `z-10` (sticky headers).
zIndex:
  base:     0
  sticky:   10        # in-page sticky headers (multi-panel scroll)
  dropdown: 1000      # Aura PrimeNG default
  overlay:  1100      # p-popover, p-menu (popup)
  drawer:   1200      # p-drawer
  modal:    1300      # p-dialog, p-confirmdialog
  toast:    1400      # p-toast (above modals so errors mid-flow are visible)
  tooltip:  1500      # always on top

# ─── Opacity scale ──────────────────────────────────────────────────────
opacity:
  "0":  0
  "20": 0.2          # disabled icons inside dark surfaces
  "50": 0.5          # disabled controls
  "70": 0.7          # hover on images and avatars (`hover:opacity-70`)
  "100": 1

# ─── Breakpoints ────────────────────────────────────────────────────────
# Tailwind defaults; documented here so DESIGN.md is self-contained.
breakpoints:
  sm: 640px           # not used — `sm:` is forbidden by code review
  md: 768px           # GRIDS ONLY (1col → 2col)
  lg: 1024px          # secondary breakpoint (page chrome)
  xl: 1280px          # PRIMARY breakpoint (panel layouts, navigation)
touchTarget:
  minSize: 44px       # WCAG 2.5.5 (and Apple HIG / Material) on coarse pointers
  rule: "icon-only buttons must reach 44×44 hit-area via padding, even when the visible icon is smaller."

# ─── Accessibility targets ──────────────────────────────────────────────
# Every contrast ratio in this section is verified manually against the
# resolved Aura preset. CI gate: `npm run a11y` (axe-core, see
# .github/workflows/a11y.yml).
accessibility:
  contrastTargets:
    bodyText: "WCAG 2.1 AA (4.5:1)"
    largeText: "WCAG 2.1 AA (3:1)"
    nonText: "WCAG 2.1 AA (3:1) — focus rings, icon buttons, dividers"
    aspirational: "WCAG 2.1 AAA where reachable without dimming UX"
  verifiedPairs:
    primary500_on_surface0: "4.9:1 AA"
    primary400_on_surface950: "7.0:1 AAA"
    primary700_on_surface0: "10.5:1 AAA"
    mutedText_light: "5.9:1 AA on surface.0; 5.0:1 AA on surface.200 hover"
    mutedText_dark: "6.5:1 AAA on surface.950"
  focusRing:
    style: halo
    width: 0.2rem
    color: "{primary.200}"
    enforcement: "global :focus-visible rule in styles.scss; never override per-component."

# ─── Density ────────────────────────────────────────────────────────────
# Single density today (productive). `compact` is reserved for future
# power-user mode. Adding it requires a token in app.config.ts plus a
# user toggle; do not attempt in components.
density:
  default: productive
  productive:
    bodyFontSize: 16px
    rowHeight: 56px       # list items, chat rows, table cells
    inputHeight: 40px
  compact:
    status: reserved      # not implemented; do not author components for it.

# ─── Localization ───────────────────────────────────────────────────────
localization:
  primaryLanguage: es-CL
  stringLengthBudget: "+25% vs English — every container must absorb this."
  rtl:
    status: "out of scope for v1; do not introduce ml-/mr-/pl-/pr- when ms-/me-/ps-/pe- exists."
  numericFormatting: "format in component (.ts), never with template pipes (`| number`, `| date`)."

components:
  button:
    rounded: "{rounded.lg}"
    padding: "0.25rem 1rem"
    height: 40px
  card:
    rounded: "{rounded.2xl}"
    padding: "1.5rem"
    border: "1px solid {surface-border-color}"
  formCard:
    rounded: "{rounded.3xl}"
    padding: "1.5rem"
  input:
    rounded: "{rounded.lg}"
    height: 40px
  navItem:
    rounded: "{rounded.lg}"
    padding: "0.25rem 1rem"
  formField:
    invalidBorderColor:
      light: "{rose.500}"   # softened from Aura red.500 → rose family (Apple HIG / Stripe / GitHub coral)
      dark: "{rose.400}"
---

# Overview

## Atmosphere

PrimeNG Showcase **se siente quieto**. Los usuarios entran a las 9 AM y salen a las 18 PM; el chrome desaparece después de la primera media hora y lo único que queda es la tarea. Eso pide tres elecciones que el resto del documento solo ejecuta:

- **Calm density.** 16px en todo el chrome, gap-2 default, padding-4 default. El whitespace no es decoración — es la ergonomía que evita micro-frustraciones acumuladas.
- **Low-saturation surfaces, single-hue accent.** Surfaces frías neutras; un solo hue (204°, "Implementos blue") en TODA la rampa primary. El acento es una señal, no una textura.
- **Quiet motion.** Solo color/opacity/transform. Cero animaciones de layout. Cero "delight" gratuito. El usuario nota cuando algo se mueve, no cuando algo es bonito.

Vocabulario alineado con SAP Fiori 3+, ServiceNow, Oracle Redwood. **No** con Linear/Stripe/Vercel — son consumer-tech, target distinto. Cuando dudes entre dos formas: la más quieta gana.

## Enforcement layers

Las reglas se enforcen en cuatro capas, de más fuerte a más débil:

1. **Tokens de runtime** — preset Aura en `src/app/app.config.ts` es source of truth. `tools/design-tokens/sync.mjs` falla CI si DESIGN.md drift contra el preset.
2. **ESLint plugin local** — 19 reglas en `tools/eslint/rules/*` bloquean violaciones de tokens, escala, tipografía, iconos, accesibilidad y patrones de PrimeNG. Detalle completo en `.claude/rules/eslint-plugin.md`.
3. **Visual regression** — Playwright `toHaveScreenshot()` por módulo (ver `tests/visual/`). Captura cualquier cambio percibible que escape al lint estático.
4. **Code review** — combinaciones tipográficas, jerarquía y receta-shopping que ningún linter atrapa. Si un reviewer humano no puede explicar por qué algo se ve "off", el system está bien.

# Colors

## Principio: solo design tokens

**Nunca** usar colores Tailwind genéricos (`text-gray-500`, `bg-blue-100`, `text-slate-700`) ni hex/rgb hardcodeados. Solo tokens semánticos del tema Aura:

```text
TEXTO
  text-color                          → Texto principal (body, títulos)
  text-color-emphasis                 → Texto principal hover (CTA cards)
  text-muted-color                    → Texto secundario (labels, ayuda)
  text-muted-color-emphasis           → Texto secundario hover
  text-primary                        → Texto con color de acento (links)
  text-primary-emphasis               → Hover de text-primary
  text-primary-contrast               → Texto sobre fondo primary
  text-surface-0 / text-surface-950   → Texto invertido (dark/light mode)

FONDO
  bg-surface-0                        → Fondo base claro
  bg-surface-50                       → Fondo ligeramente elevado
  bg-surface-100                      → Fondo de secciones alternadas
  bg-surface-200                      → Estado active (click)
  bg-surface-900 / bg-surface-950     → Fondos oscuros
  bg-emphasis                         → Hover de elementos interactivos
  bg-primary                          → Acento primario
  bg-primary-100                      → Fondo sutil (avatar iniciales)
  bg-transparent                      → Sin fondo

BORDES
  border-surface                      → Borde estándar (cards, divisores)
  border-primary                      → Borde de acento (raro)
  border-black/10 dark:border-white/20 → Solo layout principal (main.component)
```

⚠️ **`border-surface` vs `surface-200` no son iguales:**
- `border-surface` / `divide-surface` → borde **fuerte** (cards, panels) — usa `--p-surface-border-color`
- `border-surface-200 dark:border-surface-800` / `divide-surface-200/800` → borde **sutil** gris-azulado (dividers entre items, filas de tabla interna)

**Surface intermedios** (solo para detalles finos, no layout principal):
- `text-surface-400` / `text-surface-500` → ticks de charts, texto muy sutil
- `text-surface-600 dark:text-surface-400` → texto de empresas/logos
- `fill-surface-600 dark:fill-surface-400` → fill de SVGs inline

## Excepciones permitidas

Colores con nombre solo para **indicadores semánticos con significado fijo** (no UI general):

| Token | Uso |
|---|---|
| `bg-violet-100`, `text-violet-950` | Tags, badges, categorías |
| `bg-orange-100`, `text-orange-950` | Alertas, warnings, categorías |
| `text-yellow-500` | Ícono de criptomoneda BTC |
| `text-green-500` | Indicador activo/online (dot icons) |

## Dark mode

Siempre proporcionar variante `dark:` cuando se usan tokens de surface:

```html
class="bg-surface-0 dark:bg-surface-950"
class="bg-surface-100 dark:bg-surface-800"
class="bg-surface-200 dark:bg-surface-700"
```

Componentes PrimeNG manejan dark mode automáticamente vía el tema Aura.

Para CSS variables en JS (charts):
```ts
getComputedStyle(document.documentElement).getPropertyValue('--p-primary-400');
```

## Focus ring

Halo-only estilo Lara — `box-shadow: 0 0 0 0.2rem {primary.200}`. Definido por preset en `src/app/app.config.ts` → `definePreset(..., { semantic: { focusRing: {...} } })`. Se emite como CSS vars `--p-focus-ring-*` consumidas por la regla global `:focus-visible` en `styles.scss`.

| CSS var | Default |
|---|---|
| `--p-focus-ring-width` | 0 |
| `--p-focus-ring-style` | none |
| `--p-focus-ring-color` | transparent |
| `--p-focus-ring-offset` | 0 |
| `--p-focus-ring-shadow` | `0 0 0 0.2rem {primary.200}` |

**Nunca** hardcodear color/width del focus ring.

# Typography

## Regla base — 16px

**16px en todo el chrome de producto.** Body, nav, inputs, buttons, menús, labels, breadcrumb, list items: todos a 16px default (`text-base`, omitir `text-*`). El único texto más chico es metadata pura (badges, timestamps, counters, emails): `text-xs` (12px). **No usar `text-sm` (14px) para body/nav/label** — reservado para casos narrowly-scoped (avatar overlays, movie titles estrechos).

## Combinaciones aprobadas

```text
TÍTULOS:    text-3xl font-bold leading-normal     ← Hero (text-3xl SIEMPRE con font-bold, enforced)
            text-2xl font-medium leading-8         ← Sección
            text-xl font-medium leading-7          ← Subsección (inbox/movies headers)
SUBTÍTULOS: text-muted-color font-medium leading-normal  ← Subtítulo de página
            text-color font-bold leading-6         ← Título de card (font-bold por decisión 2026-04-21)
LABELS:     text-color font-semibold leading-6     ← Label de input (encima del control)
            text-color font-normal leading-6       ← Label de checkbox/radio (al lado del control)
LINKS:      font-medium text-primary hover:text-primary-emphasis underline cursor-pointer transition-colors duration-150
BODY:       text-color leading-6                   ← Default para body
            text-color font-medium leading-6       ← Énfasis
NAV:        font-medium leading-6                  ← Nav item (L1, L2, L3, breadcrumb)
            font-semibold leading-6                ← Nav item activo / trigger / último crumb
SECUNDARIO: text-muted-color leading-6             ← Metadata inline dentro de body
PEQUEÑO:    text-xs font-medium                    ← Badges, contadores, pills
            text-xs leading-4                      ← Emails, sub-labels, timestamps
ESPECIAL:   text-sm font-medium leading-tight      ← Movie titles (contenedores estrechos)
            text-sm font-medium leading-none       ← Avatar overlay labels
```

## Distribución de pesos

- `font-medium` — default (90% de los usos)
- `font-semibold` — solo label de input + nav activo + triggers + último crumb del breadcrumb
- `font-bold` — título de card + `text-3xl` (títulos hero)
- `font-normal` — casi nunca (solo labels de checkbox/radio)

**Rationale:** dominio ERP con usuarios 25-60+, sesiones de 8h, español (palabras más largas que inglés). Legibilidad > densidad. ESLint valida valores individuales; combinaciones por code review excepto `text-3xl` ↔ `font-bold` (enforced vía `showcase/text-3xl-requires-bold`).

# Layout

## Spacing — escala permitida

```text
GAP:     gap-1 | gap-2 ← DEFAULT | gap-3 | gap-4 | gap-5 | gap-6 ← CARDS/SECCIONES | gap-8
PADDING: p-1 | p-2 ← DEFAULT | p-3 | p-4 | p-6 ← CARDS | px-4 py-1 (botones) | px-7 py-5 (cabecera)
MARGIN:  mt-1 (sutil) | mt-2/mb-2 | mt-4/mb-4 | mt-6/mb-6 | mb-0
FLEX:    grow | shrink-0 (avatares) | flex-1
```

**No usar:** `gap-9,10,12` | `p-7,8` | `m-7,8,9` | valores arbitrarios `gap-[13px]`.

**Excepciones aceptadas** (pre-existentes, documentadas en `AUDIT_BASELINE.md` EX-005): `gap-7`, `gap-8`, `py-8` (chat) | `p-5` (side-menu) | `mt-3`, `mb-5`, `mt-5` (layouts) | `mt-10` (separadores).

## Patrones estructurales

### Card estándar

```html
<div class="border border-surface rounded-2xl p-6">...</div>
```

### Card con cabecera expandida

```html
<div class="border border-surface rounded-2xl py-5 px-7">
  <div class="text-color font-semibold leading-6">Título</div>
</div>
```

### Layout responsive

```html
<div class="flex flex-col xl:flex-row gap-6">...</div>
```

### Contenedor principal de página

```html
<div class="flex-1 h-full overflow-y-auto pb-0.5">...</div>
```

### Grid responsive

```html
<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-x-4 gap-y-6">...</div>
```

**Breakpoints:** `xl:` principal. `lg:` secundario. `md:` solo grids. `sm:` no se usa.

### Header de página

```html
<div class="flex flex-wrap gap-4 items-start justify-between p-1">
  <div class="flex-1">
    <div class="text-muted-color font-medium leading-normal">Subtítulo</div>
    <div class="text-color text-3xl font-bold leading-normal">Título</div>
  </div>
  <div class="flex gap-2 whitespace-nowrap flex-nowrap">
    <p-iconfield iconPosition="left">
      <p-inputicon class="fa-sharp fa-regular fa-magnifying-glass"></p-inputicon>
      <input type="text" pInputText placeholder="Search" />
    </p-iconfield>
  </div>
</div>
```

### Header de card

```html
<div class="flex items-center gap-6 mb-6">
  <div class="flex-1 text-color font-semibold leading-6">Título</div>
  <div class="flex items-center gap-5"><!-- leyenda o botones --></div>
</div>
```

### Item de lista (nav, chat, inbox)

```html
<div class="flex items-center gap-2 p-4 cursor-pointer hover:bg-emphasis transition-colors">
  <p-avatar ... />
  <div class="flex-1">
    <div class="flex items-start gap-1 justify-between">
      <div class="text-color font-medium leading-6">Nombre</div>
      <div class="text-sm text-muted-color leading-5">Hora</div>
    </div>
    <div class="text-muted-color text-sm leading-5 line-clamp-1 mt-1">Preview...</div>
  </div>
</div>
```

### Settings row (icon + label + toggle)

```html
<div class="flex items-center gap-2">
  <i class="fa-sharp fa-regular fa-bell text-color"></i>
  <div class="leading-6 font-medium text-color flex-1">Notification</div>
  <p-toggleswitch [(ngModel)]="value" />
</div>
```

### Scroll y sticky headers

```html
<div class="flex-1 overflow-y-auto flex flex-col gap-6">
  <div class="sticky top-0 z-10 bg-surface-0 dark:bg-surface-950">
    Header fijo
  </div>
</div>
```

Sticky headers siempre necesitan `bg-surface-0 dark:bg-surface-950` y `z-10`.

### Text overflow

```html
<div class="line-clamp-1">Una línea con ellipsis</div>
<div class="line-clamp-4">Múltiples líneas</div>
<div class="whitespace-nowrap">Sin wrap</div>
<span class="text-ellipsis whitespace-nowrap overflow-hidden">archivo.pdf</span>
```

### Imágenes y medios

```html
<!-- Imagen con aspect ratio -->
<div class="relative aspect-[195/118.5] rounded-lg overflow-hidden">
  <img [src]="url" class="w-full h-full object-cover" />
</div>

<!-- Imagen cuadrada -->
<div class="aspect-square rounded-lg overflow-hidden">
  <img [src]="url" class="w-full h-full object-cover block" />
</div>

<!-- Overlay sobre imagen -->
<div class="relative">
  <img />
  <div class="absolute z-10 top-2 right-2">Badge</div>
  <div class="absolute z-10 bottom-2 inset-x-2">Progress</div>
</div>
```

Siempre `object-cover` + contenedor `rounded-lg overflow-hidden`.

### Layouts multi-panel

```html
<!-- 3 paneles (chat) — host: flex border border-surface rounded-2xl -->
<div class="w-4/12 xl:w-3/12 min-w-40 h-full overflow-hidden flex flex-col">
  <div class="flex items-center justify-between gap-2 p-4 border-b border-surface">
    <h1 class="text-2xl font-medium leading-8 text-color">Título</h1>
  </div>
  <div class="flex-1 flex flex-col overflow-auto">...</div>
</div>
<div class="w-8/12 xl:w-6/12 border-x border-surface flex flex-col">
  <div class="flex items-center p-4 border-b border-surface">...</div>
  <div class="flex-1 overflow-auto">...</div>
</div>
<div class="w-3/12 xl:block hidden min-w-40 overflow-auto"><!-- panel oculto < xl --></div>

<!-- 2 paneles (inbox) — host: flex gap-4 -->
<div class="w-64 h-full overflow-hidden border border-surface rounded-2xl flex flex-col">
  <div class="flex items-center justify-between gap-2 p-4 border-b border-surface">...</div>
  <div class="flex-1 flex flex-col overflow-auto">...</div>
</div>
<div class="flex-1 h-full border border-surface rounded-2xl"><!-- principal --></div>
```

**Reglas multi-panel:**
- Headers consistentes: `p-4 border-b border-surface`. Garantiza alturas alineadas. Para tablas PrimeNG: `header.padding: '1rem'` en `[dt]` tokens.
- Estructura header/scroll: contenedor con `overflow-hidden`, header fijo arriba, contenido `flex-1 overflow-auto`. **Nunca** `sticky` como sustituto.
- Separación: `border-x border-surface` (adyacentes) o `gap-4` + bordes propios.
- Mobile: paneles secundarios usan `xl:block hidden`.
- Cada panel scrollea independientemente.
- Anchos fracciones: `w-4/12`, `w-8/12`, `w-3/12`. Fijos: `w-64`, `w-72`.

### Formularios dentro de cards

```html
<div class="border border-surface rounded-3xl p-6 flex flex-col gap-6">
  <div>
    <label class="text-color font-semibold leading-6" for="id">Label</label>
    <input pInputText id="id" class="mt-2 w-full" />
  </div>
  <div class="flex items-center gap-3">
    <i class="fa-sharp fa-regular fa-bell text-color text-xl"></i>
    <div class="leading-6 text-color flex-1">Label</div>
    <p-toggleswitch [(ngModel)]="value" />
  </div>
  <div class="flex items-center gap-2">
    <button pButton label="Cancel" outlined class="flex-1"></button>
    <button pButton label="Submit" class="flex-1"></button>
  </div>
</div>
```

Reglas: `rounded-3xl` para form cards (vs `rounded-2xl` para data cards) | label encima con `mt-2` | input labels llevan `font-semibold`; checkbox/radio labels llevan `font-normal` (enforced por `showcase/label-requires-semibold`) | botones `flex-1` al final.

# Elevation & Depth

## NO usar sombras

El proyecto usa `border border-surface` en vez de sombras para definir elevación. Si necesitás elevar un elemento: `border border-surface rounded-2xl`.

**Excepción documentada:**

1. **`shadow-[...]` sobre tooltip custom de Chart.js** (`src/app/modules/overview/overview.component.ts:191`, aplicado en runtime via `classList.add()`). Chart.js dibuja el tooltip fuera del árbol Angular, no hereda el vocabulario de design tokens y no se puede expresar con `border border-surface` (rompería el layout). ESLint no la detecta porque vive en string concatenada en TS.

2. **`!absolute` sobre `<i class="fa-sharp-duotone ...">`** (corner stat icons del login marketing panel). Font Awesome declara `position: relative` en `.fa-sharp-duotone` para anclar pseudo-elementos. El `!` de Tailwind v4 emite `!important` y restaura el posicionamiento. Solo cuando se combina `fa-sharp-duotone` con `absolute` en el mismo elemento — si se multiplican, extraer a utility semántica.

# Shapes

## Border-radius — escala permitida

```text
rounded-full  → Círculos (avatares, status dots, progress)
rounded-lg    → Elementos pequeños (botones, inputs, badges, avatares con imagen, tablas internas)
rounded-xl    → Contenedores medianos (carousel items, media grid, movie cards)
rounded-2xl   → Cards estándar ← MÁS USADO
rounded-3xl   → Form cards (profile, file upload, settings, price range)
```

**No usar:** `rounded`, `rounded-sm`, `rounded-md`, `rounded-none`, `rounded-[value]`.

**Regla de jerarquía:** si un elemento vive DENTRO de un contenedor con `rounded-2xl` (host), usar `rounded-lg` para sub-contenedores internos. NO usar `rounded-2xl` para ambos — el radio interior debe ser menor que el exterior.

# Motion

## Filosofía

**Animar el menor número posible de propiedades, durante el menor tiempo posible.** El usuario debe notar el cambio, no la animación. El proyecto desactiva las transiciones internas de PrimeNG (`transitionDuration: '0s'`) para evitar el flash de tema durante navegación client-side; las transiciones reales viven en clases Tailwind narrow.

## Tokens

```text
DURATION
  0ms     → cambios de tema PrimeNG (token de runtime, no propiedad CSS)
  150ms   → transition-colors / transition-opacity (default narrow)
  250ms   → transition-transform en overlays (sheets, panels)

EASING
  cubic-bezier(0.2, 0, 0, 1)   → standard (default Aura)
  cubic-bezier(0, 0, 0.2, 1)   → decelerate (entradas)
  cubic-bezier(0.4, 0, 1, 1)   → accelerate (salidas)
```

## Reglas

- Usar `duration-150` SOLO con `<a>` de texto (regla de la receta de links).
- Para todo lo demás: omitir `duration-*` y dejar que Aura aplique el default (que ya respeta el token de motion).
- **Nunca** animar `width`, `height`, `top/left/right/bottom`, `margin`, `padding`. Son layout y causan reflow → jank perceptible.
- Animar `transform: translate*` y `opacity` en su lugar.
- `transition-all` está prohibido y enforced por `showcase/no-forbidden-transitions`.

## `prefers-reduced-motion`

El proyecto respeta la media query del sistema operativo. Cualquier animación añadida debe vivir dentro de:

```scss
@media (prefers-reduced-motion: no-preference) {
  /* animations here */
}
```

Validación: en CI corre `prefers-reduced-motion: reduce` como uno de los emulados de Playwright. Capturas con motion forzado a 0 deben ser estables (no pixel-jitter).

# Z-Index

## Escala semántica

**Nunca** usar `z-[2000]` o números arbitrarios. Solo los tokens nombrados:

```text
0      base                                ← default, no z explícito
10     sticky          (Tailwind: z-10)    ← sticky headers en multi-panel scroll
1000   dropdown                            ← Aura default para overlays internos
1100   overlay         (p-popover, p-menu) ← popups disparados desde botones
1200   drawer          (p-drawer)          ← sheets laterales mobile
1300   modal           (p-dialog, confirm) ← bloquean interacción con la página
1400   toast           (p-toast)           ← arriba del modal: errores in-flow visibles
1500   tooltip                             ← siempre on top, nunca tapado
```

## Reglas

- Para sticky in-page: `class="sticky top-0 z-10"`.
- Para overlays PrimeNG: el componente maneja z-index internamente — no override con `styleClass`.
- Si necesitás un nuevo nivel: agregar al `zIndex` del front matter Y a `app.config.ts` como token semántico, nunca usar el número raw en el template.

# Opacity

## Escala

```text
opacity-0     → hidden (preferir `hidden` Tailwind o ngIf)
opacity-20    → iconos disabled sobre superficies oscuras
opacity-50    → controles disabled (default Aura aplica este via [disabled])
opacity-70    → hover sobre imágenes y avatares (`hover:opacity-70`)
opacity-100   → default
```

**No usar** valores arbitrarios (`opacity-[0.65]`) ni shades intermedios (`opacity-30`, `opacity-40`, `opacity-60`, `opacity-80`, `opacity-90`). La escala tiene exactamente cinco pasos.

# Responsive Behavior

## Breakpoints

Tailwind defaults; documentados acá para que DESIGN.md sea autocontenido:

```text
sm:  640px    ← NO USAR (forbidden by code review)
md:  768px    ← solo grids (1col → 2col)
lg:  1024px   ← secundario (page chrome, panel padding)
xl:  1280px   ← PRIMARY (panel layouts, navigation, side panels)
```

**Mobile-first:** sin prefijo es <md. Con `xl:` es ≥1280. Sin breakpoints intermedios — `sm:` está prohibido porque introduce un quinto nivel que confunde sin aportar.

## Patrones responsive

### Padding responsivo en cards data-heavy

Cards que contienen charts/tablas tienen MÁS breathing room en desktop, MENOS en mobile:

```html
<div class="border border-surface rounded-2xl p-4 lg:py-5 lg:px-7">
```

Justificación: en mobile el espacio horizontal es escaso → `p-4` da más área útil al chart. En desktop hay aire de sobra → `py-5 px-7` mejora la jerarquía visual del header.

### Colapso de panel secundario

Multi-panel layouts ocultan el panel terciario por debajo de `xl:`:

```html
<div class="w-3/12 xl:block hidden min-w-40 overflow-auto">
  <!-- panel oculto < 1280px -->
</div>
```

### Touch targets

Todo botón icon-only **debe** alcanzar 44×44px de hit-area en pointers gruesos (móvil/tablet). Si el ícono visible es más chico, expandir con padding:

```html
<button class="w-10 h-10 rounded-lg flex items-center justify-center ...">
  <i class="fa-sharp fa-regular fa-arrow-left" aria-hidden="true"></i>
</button>
```

`<p-button text>` ya respeta esto vía Aura. Validación: WCAG 2.5.5 (Target Size) y axe-core.

# Accessibility

## Contrast targets

Todos los pares texto/fondo del proyecto cumplen **WCAG 2.1 AA** como mínimo. Pares verificados (manual + axe-core):

| Par | Contraste | Nivel |
|---|---:|---|
| `primary.500` sobre `surface.0` | 4.9:1 | AA |
| `primary.400` sobre `surface.950` (dark) | 7.0:1 | AAA |
| `primary.700` sobre `surface.0` (active) | 10.5:1 | AAA |
| `text-muted-color` light sobre `surface.0` | 5.9:1 | AA+ |
| `text-muted-color` light sobre `surface.200` (hover) | 5.0:1 | AA |
| `text-muted-color` dark sobre `surface.950` | 6.5:1 | AAA |

**Para colores de excepción** (violet, orange, yellow, green): solo en indicadores con significado fijo, nunca como UI general. Cuando se usen sobre fondos custom, validar contraste en code review.

## Focus management

- **Halo único** definido por preset Aura: `box-shadow: 0 0 0 0.2rem {primary.200}`.
- Aplicado globalmente vía `:focus-visible` en `styles.scss` — nunca per-componente.
- Wrappers de PrimeNG (e.g. `p-autocomplete[multiple]`) usan `:focus-within` por sincronicidad CSS-nativa.
- **Nunca** `outline: none` sin un focus indicator de reemplazo.

## Keyboard navigation

- `Tab`/`Shift+Tab` debe atravesar TODA la UI sin trampas.
- Dialogs (`p-dialog`, `p-confirmdialog`) hacen focus trap automático — confirmar en review.
- Menús (`p-menu` popup) deben abrirse con `Enter`/`Space`, navegarse con flechas, cerrarse con `Esc`.
- Skip-links: para layouts multi-panel, agregar `<a href="#main" class="sr-only focus:not-sr-only">Saltar al contenido</a>`.

## Live regions

Contenido que cambia en runtime debe anunciarse a screen readers:

```html
<!-- Carousel pagination announcement -->
<div class="sr-only" aria-live="polite" aria-atomic="true">
  Página {{ page() + 1 }} de {{ maxPage() + 1 }}
</div>

<!-- Chat: nuevo mensaje recibido -->
<div class="sr-only" aria-live="polite" aria-relevant="additions">
  {{ lastIncomingMessage() }}
</div>

<!-- Toast / errores: ya manejado por p-toast con role=alert -->
```

`aria-live="polite"` no interrumpe; `assertive` solo para errores críticos.

## Iconos decorativos vs informativos

```html
<!-- Decorativo (junto a texto que ya describe la acción) -->
<i class="fa-sharp fa-regular fa-bell" aria-hidden="true"></i>

<!-- Standalone (solo icono → necesita label) -->
<button aria-label="Notificaciones">
  <i class="fa-sharp fa-regular fa-bell" aria-hidden="true"></i>
</button>

<!-- Botón PrimeNG icon-only — ariaLabel + pTooltip obligatorios -->
<p-button icon="fa-sharp fa-regular fa-bell" ariaLabel="Notificaciones" pTooltip="Notificaciones" />
```

Enforced: `showcase/no-decorative-icon-without-aria-hidden`, `showcase/no-icon-button-without-tooltip`.

## CI gate

`npm run a11y` corre **axe-core** contra rutas clave (overview, chat, inbox, cards, customers). Falla en cualquier violación de severidad `serious` o `critical`. Workflow: `.github/workflows/a11y.yml`.

# Density

## Productive (default)

Una única densidad: **productive**. Optimizada para sesiones de 8h en español.

```text
bodyFontSize:  16px
rowHeight:     56px    ← list items, chat rows, table cells
inputHeight:   40px
```

## Compact (futuro)

`compact` está reservado para una futura modalidad power-user (admins, ops, sesiones rápidas). **No implementar componentes específicos para compact** — cuando llegue, será un toggle global que ajusta tokens (`--p-form-field-padding`, etc.) sin tocar templates.

# Localization

## Lengua principal

**es-CL.** Spanish-first informa decisiones de tipografía (16px base) y de container sizing.

## String length budget

Toda etiqueta, botón, header debe absorber **+25%** de longitud vs el equivalente en inglés. "Save" → "Guardar" (×1.5). "Submit" → "Enviar" (×1.5). "Cancel" → "Cancelar" (×1.3). Containers fijos (`w-32`, `whitespace-nowrap`) son trampas — usar `min-w-*` + `flex-1` cuando sea posible.

## RTL

**Out of scope para v1.** No introducir markup right-to-left. Pero **sí** preferir logical properties (`ms-*`, `me-*`, `ps-*`, `pe-*`) cuando exista — facilita un eventual switch sin rewrite masivo.

```html
<!-- Preferido (LTR + RTL futuro) -->
<div class="ms-2 pe-4">

<!-- Aceptable (LTR-only) -->
<div class="ml-2 pr-4">
```

## Numeric formatting

Fechas, números y monedas se formatean en `.ts` (NO con pipes Angular `| date` `| number`). Usar `Intl.NumberFormat` y `Intl.DateTimeFormat` con locale `es-CL`. Razón: pipes invocan en CD; signals + computed + Intl es más eficiente y SSR-safe.

```typescript
private currencyFormatter = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
});

// En el template: {{ formattedAmount() }}
formattedAmount = computed(() => this.currencyFormatter.format(this.amount()));
```

# Components

## Estados interactivos

```html
<!-- Hover estándar para clickeables -->
class="hover:bg-emphasis cursor-pointer transition-colors"

<!-- Active (click/pressed) -->
class="active:bg-surface-200 dark:active:bg-surface-700"

<!-- Hover en texto -->
class="hover:text-muted-color-emphasis"

<!-- Hover con opacidad (links, iconos) -->
class="hover:opacity-70 transition-opacity"

<!-- Activo/seleccionado (nav, tabs) -->
class="text-color bg-emphasis"           → Activo
class="text-muted-color bg-transparent"  → Inactivo
```

**Regla:** todo elemento con `cursor-pointer` DEBE tener un `hover:*`. Sin hover feedback el usuario no sabe que puede interactuar.
- Contenedores/cards/rows → `hover:bg-emphasis`
- Imágenes/avatares → `hover:opacity-70`
- Texto/links → `hover:text-muted-color-emphasis`

**Exenciones de `showcase/hover-requires-cursor-pointer`:**
- `<p-*>` y elementos con `[pButton]` están exentos (PrimeNG aplica hover via tema Aura).
- `group-hover:*` y `peer-hover:*` no se flaggean (el cursor-pointer vive en el padre/sibling).

## Transiciones — narrow por default

`transition-all` está **prohibido sin excepciones** y bloqueado por `showcase/no-forbidden-transitions`. Solo se permiten:

| Efecto | Clase | Cuándo |
|---|---|---|
| Cambio color/fondo | `transition-colors` | Default para interactivos |
| Cambio opacidad | `transition-opacity` | Imágenes, avatares con hover por opacidad |
| Sin animación | (omitir) | Nav items con estado activo binario |
| Movement | `transition-transform` | Carousel, sheets, panels |
| Arbitrary narrow | `transition-[transform]` | Casos puntuales |

**No agregar animaciones** más allá (sin keyframes, sin delays).

## Elementos interactivos: acción vs navegación

No todo elemento clickeable es un botón de acción. Distinguir:

| Tipo | Elemento | Directiva | Estilo |
|---|---|---|---|
| **Botón de acción** (submit, cancel, download) | `<p-button>` o `<button pButton>` | `pButton` obligatorio | PrimeNG controla |
| **Nav item principal** (side-menu) | `<div>` con `[routerLink]` | Sin pButton | Tailwind + ngClass/routerLinkActive |
| **Nav item in-page** (sidebar tabs, filtros) | `<button>` o `<div>` | Sin pButton | Tailwind + ngClass |
| **List item clickeable** (chat, inbox) | `<div>` | Sin pButton | Tailwind + ngClass |
| **Card/item clickeable** (carousel, grid) | `<div>` | Sin pButton | Tailwind hover only |
| **Menu item en card** (acciones perfil) | `<button>` | Sin pButton | Tailwind + active state |
| **CTA card item** (postulantes, ver más) | `<button>` | Sin pButton | Tailwind, bg-emphasis default |

**¿Por qué no `pButton` en nav/list items?** `pButton` aplica estilos de botón PrimeNG (fondo primary, padding, tipografía) que sobreescriben las Tailwind de layout. Nav/list items necesitan control fino de estados con clases propias.

### Recetas de nav/list items

```html
<!-- 1. Nav principal (side-menu) — routerLinkActive para estado -->
<div
  [routerLink]="item.url"
  routerLinkActive="text-primary-contrast bg-primary hover:bg-primary-emphasis"
  #rla="routerLinkActive"
  [ngClass]="{
    'text-muted-color hover:bg-emphasis bg-transparent': !rla.isActive
  }"
  class="px-4 py-1 flex items-center gap-1 cursor-pointer text-base rounded-lg transition-colors select-none"
>
  <i [class]="item.icon"></i>
  <span>{{ item.title }}</span>
</div>

<!-- 2. Nav in-page (inbox sidebar, filtros) -->
<button
  (click)="activeNav.set(nav.name)"
  [ngClass]="{
    'text-color bg-emphasis': activeNav() === nav.name,
    'text-muted-color bg-transparent': activeNav() !== nav.name
  }"
  class="px-4 py-2 rounded-lg flex items-center gap-2 cursor-pointer hover:bg-emphasis transition-colors"
>
  <i [class]="nav.icon"></i>
  <span class="font-medium">{{ nav.name }}</span>
</button>

<!-- 3. List item clickeable (chat list) -->
<div
  (click)="select(item)"
  [ngClass]="{ 'bg-emphasis': item.id === activeId() }"
  class="flex items-center gap-2 p-4 cursor-pointer hover:bg-emphasis transition-colors"
>
</div>

<!-- 4. Card/item clickeable (carousel, grid) — solo hover -->
<div class="p-2 rounded-xl hover:bg-emphasis transition-colors cursor-pointer"></div>

<!-- 5. Menu item en card (sin pButton) -->
<button
  class="w-full flex items-center gap-2 text-color p-2 bg-transparent hover:bg-emphasis active:bg-surface-200 dark:active:bg-surface-700 cursor-pointer rounded-lg transition-colors select-none"
>
  <i class="fa-sharp fa-regular fa-arrows-rotate"></i>
  <span>Refresh</span>
</button>

<!-- 6. CTA card item (botón llamativo en card, sin pButton) -->
<button
  class="p-4 rounded-3xl w-full bg-emphasis transition-colors text-color hover:text-color-emphasis flex items-center gap-2 justify-between cursor-pointer"
>
  <div class="flex items-center"></div>
  <div class="flex items-center gap-2">
    <span class="font-medium leading-6">12 Postulantes</span>
    <i class="fa-sharp fa-regular fa-arrow-right"></i>
  </div>
</button>
```

**Estados:**
- Activo fuerte (nav principal): `text-primary-contrast bg-primary hover:bg-primary-emphasis`
- Activo sutil (nav in-page, list items): `text-color bg-emphasis`
- Inactivo: `text-muted-color bg-transparent`
- Solo hover (cards, carousel): sin estado activo, solo `hover:bg-emphasis`
- CTA card: `bg-emphasis text-color hover:text-color-emphasis rounded-3xl`

## Recetas de estado dinámico (ngClass)

```html
<!-- Selección activa -->
[ngClass]="{
  'text-color bg-emphasis': isActive,
  'text-muted-color bg-transparent': !isActive
}"

<!-- Avatar fallback (sin imagen → iniciales) — UN SOLO COLOR -->
[ngClass]="{
  '!bg-primary-100 !text-primary-950': !item.image
}"

<!-- Mensaje enviado vs recibido (chat) -->
[ngClass]="{
  'ml-auto flex-row-reverse': message.type === 'sent'
}"
<!-- Bubble: bg-primary (sent) / bg-surface-100 dark:bg-surface-800 (received) -->
<!-- Texto: text-primary-contrast (sent) / text-color (received) -->

<!-- Toggle de ícono -->
[ngClass]="value ? 'fa-sharp fa-solid fa-bookmark' : 'fa-sharp fa-regular fa-bookmark'"

<!-- Visibilidad condicional -->
[class]="isHidden ? 'hidden' : 'font-medium leading-none'"
```

## Iconos — Font Awesome Pro 7 Sharp

El proyecto usa **Font Awesome Pro 7** self-hosted desde `public/fontawesome/`, familia **Sharp** (regular + solid + duotone) como sistema principal. PrimeIcons fue removido. Cuatro familias cargadas (en `angular.json` styles):

- `sharp-regular.css` → familia principal de UI (default inline)
- `sharp-solid.min.css` → estado activo de toggles binarios
- `sharp-duotone-regular.css` → iconos decorativos ≥text-2xl
- `brands.min.css` → solo logos de marca reales (Bitcoin, GitHub, etc.)

### Sintaxis

Sharp requiere TRES clases — familia + estilo + nombre:

```html
<!-- Sharp regular (default) -->
<i class="fa-sharp fa-regular fa-magnifying-glass"></i>
<button pButton icon="fa-sharp fa-regular fa-download" label="Descargar"></button>
<p-inputicon class="fa-sharp fa-regular fa-magnifying-glass"></p-inputicon>

<!-- Sharp solid (estado activo de toggles binarios) -->
<i class="fa-sharp fa-solid fa-bookmark"></i>

<!-- Sharp duotone (≥text-2xl: feature cards, hero tiles, empty states) -->
<i class="fa-sharp-duotone fa-regular fa-file-invoice text-2xl"></i>
<i class="fa-sharp-duotone fa-regular fa-cloud-arrow-up text-4xl"></i>

<!-- Brands (solo logos reales) -->
<i class="fa-brands fa-bitcoin"></i>
```

### Estrategia de estilos (regla crítica)

**Regla #1 — Un solo peso para UI funcional.** Linear, Vercel, Stripe, GitHub: todos usan UN solo estilo en su product UI. Mezclar pesos en una vista (especialmente regular ↔ duotone inline) rompe el ritmo visual.

**Regla #2 — Selección por TAMAÑO y ROL, no por contenido semántico:**

| Tamaño / Rol | Familia | Por qué |
|---|---|---|
| **Inline (16-20px) junto a texto** — list items, metadata, labels, nav, toolbars | `fa-sharp fa-regular` siempre | Consistencia de ritmo visual al escanear |
| **Standalone 20px (`text-xl`)** — botones, indicadores | `fa-sharp fa-regular` | 20px aún muy chico para duotone |
| **Estado activo de toggle binario** (bookmark, like, favorite) | `fa-sharp fa-solid` (mismo nombre que inactivo) | Outline ↔ filled es estándar universal |
| **Indicador de estado fijo activo** (sin contraparte inactiva) | `fa-sharp fa-solid` | Mismo vocabulario, sin ambigüedad |
| **Decorativo standalone (≥`text-2xl`)** — feature cards, hero tiles | `fa-sharp-duotone fa-regular` | A 24px+ los dos tonos se separan lo suficiente |
| **Hero / empty state (≥`text-4xl`)** — onboarding, drop zones | `fa-sharp-duotone fa-regular` | Mismo criterio a escala grande |
| **Brand logos** (Bitcoin, Ethereum, GitHub) | `fa-brands` | Iconos de marca reales |

**Toggle pairs** — mismo nombre, sharp regular (off) ↔ sharp solid (on):
```html
[ngClass]="bookmarked ? 'fa-sharp fa-solid fa-bookmark' : 'fa-sharp fa-regular fa-bookmark'"
```

El contraste outline/fill es lo que los usuarios reconocen instantáneamente (iOS, Material, GitHub, Linear). **Nunca** `fa-sharp-duotone` como estado activo de un toggle inline — duotone es decorativo, no comunica "estado".

**Sharp Duotone — cuándo SÍ:**
- Feature cards con icono en box (factura, inventario, pagos — `text-2xl` dentro de box 48px)
- Hero tiles con icono grande (`text-4xl`+)
- Empty states (`<app-empty-state>` ya lo aplica a `text-4xl`)
- Onboarding screens, file upload drop zones

**Sharp Duotone — cuándo NO:**
- Iconos inline junto a texto en filas/metadata
- Estado activo de toggles binarios (usar `fa-sharp fa-solid`)
- Cualquier icono < text-2xl (24px) — los dos tonos se embarran
- Mezclado con sharp regular del mismo tamaño SIN diferenciación clara de rol

### Tamaño y misc

- Tamaño se hereda del contenedor por default. Standalone: `text-xl`, `text-2xl`, `text-4xl`.
- Catálogo: https://fontawesome.com/icons (filtrar por "Pro" + estilo)
- Naming FA es distinto a PrimeIcons: `fa-xmark` (no `fa-times`), `fa-magnifying-glass` (no `fa-search`), `fa-arrows-rotate` (no `fa-refresh`), `fa-gear` (no `fa-cog`).

### Íconos con contenedor circular

```html
<i class="fa-sharp fa-regular fa-bell bg-surface-950 text-surface-0 dark:bg-surface-0 dark:text-surface-950 w-7 h-7 rounded-full !flex items-center justify-center"></i>
```

### SVG inline

Cuando se necesite SVG custom (logo), usar `fill="var(--p-primary-color)"` para respetar el tema.

# Agent Prompt Guide

Bloque self-contained con prompts re-usables para agentes (Claude Code, Codex, Cursor) que trabajan en este repo. Copiar-pegar funciona.

## Quick reference cheat sheet

```text
COLORS       text-color | text-muted-color | text-primary | bg-surface-{0,50,100,200,800,900,950} | bg-emphasis | bg-primary | bg-primary-100
TYPOGRAPHY   text-{xs,base,xl,2xl,3xl} + font-{normal,medium,semibold,bold} + leading-{4,5,6,7,8,normal,tight,none}
SPACING      gap-{1,2,3,4,5,6,8} | p-{1,2,3,4,6} | m{t,b,x,y}-{0,1,2,4,6}
ROUNDED      rounded-{full,lg,xl,2xl,3xl}
TRANSITIONS  transition-{colors,opacity,transform} (NEVER transition-all)
ICONS        fa-sharp fa-regular fa-{name}      ← inline default
             fa-sharp fa-solid fa-{name}        ← toggle ON state only
             fa-sharp-duotone fa-regular ≥ text-2xl ← decorative hero
HOVER        hover:bg-emphasis (rows) | hover:opacity-70 (images) | hover:text-muted-color-emphasis (text)
ACTIVE       text-primary-contrast bg-primary  (nav principal)
             text-color bg-emphasis            (nav in-page, list items)
DARK MODE    every bg-surface-* needs a dark:bg-surface-* counterpart
```

## Prompts ready-to-use

### "Crear un nuevo módulo replicando el patrón de `customers`"

```
Crea un módulo `<feature>` en `src/app/modules/<feature>/`. Replica EXACTAMENTE
la estructura de src/app/modules/customers (component .ts/.html/.scss vacío,
constants/, mocks/, models/). Header de página con receta de DESIGN.md
(text-3xl font-bold + subtítulo text-muted-color font-medium). <p-table>
con [dt]=tableTokens, scrollHeight="flex", paginatorStyleClass="!bg-transparent".
Cero CSS en el .scss. Antes de implementar: corre el MCP de PrimeNG para
verificar APIs. Después: corre `npm run lint` y `npm run design-tokens:check`.
```

### "Agregar un componente nuevo de PrimeNG"

```
Necesito un <componente PrimeNG>. Antes de escribir código:
1. Consulta el MCP @primeng/mcp para ver la API actual (props, eventos, slots).
2. Busca en src/app/modules/ si ya hay un uso del mismo componente que pueda
   replicar (regla #1: consistencia con lo existente).
3. Verifica el receta para ese componente en .claude/rules/primeng-patterns.md.

Reglas no negociables:
- OnPush + standalone, signals para estado, inject() en lugar de constructor.
- Cero CSS en .scss; todo Tailwind en el template usando design tokens del DESIGN.md.
- Si es icon-only <p-button>: aria-label + pTooltip obligatorios (no excepciones).
- Cualquier elemento con cursor-pointer DEBE tener un hover:* correspondiente.
```

### "Revisa este código contra el design system"

```
Revisa <archivo> contra DESIGN.md. Reporta cualquier violación de:
- Tokens (text-gray-*, bg-blue-*, hex hardcodeado, etc.)
- Escala de spacing/rounded/typography fuera de la permitida
- Combinaciones tipográficas que no están en las recetas
- Hover sin cursor-pointer (o viceversa) en HTML plano
- transition-all
- pButton aplicado a nav/list items
- icon en <p-button> con clases que no son fa-*
- bg-surface-* sin par dark:bg-surface-*
- Iconos sharp-duotone inline o como toggle activo

Output: lista priorizada por severidad (high/medium/low). Cita file:line.
NO sugieras fixes — solo identifica.
```

### "Implementa estado de carga / error / vacío"

```
Para <feature>:
- Loading: <p-skeleton> con dimensiones que matcheen el contenido real
  (medir el componente real, reproducir alturas/anchos). aria-busy="true"
  en el contenedor.
- Empty state: <app-empty-state> con icono fa-sharp-duotone fa-regular text-4xl,
  título text-2xl font-medium, descripción text-muted-color, CTA secundario
  con outlined.
- Error: toast severity="error" con mensaje accionable + posibilidad de retry.
  Errores inline solo en form fields (Aura aplica invalidBorderColor automáticamente).

Detalle completo en .claude/rules/ux-patterns.md.
```

### "Agrega una nueva regla ESLint al plugin local"

```
Crea showcase/<nueva-regla> en tools/eslint/rules/<nombre>.js:
- // @ts-check + 'use strict'
- meta.type='problem', meta.schema=[], meta.messages, meta.docs.description
- Si necesita visitor de class strings: usa createClassAttrVisitor(context, fn)
- Si necesita visitor element-level: visit Element con node.name === '<tag>'

Crea suite RuleTester en tools/eslint/rules/__tests__/<nombre>.test.js:
- Importa { RuleTester } de 'eslint' + templateParser de '@angular-eslint/template-parser'
- Cubre: valid (5+ casos), invalid (5+ casos con messageId/data específicos),
  bound attributes, ternarios, multiple violations en un mismo string.

Registra en tools/eslint/plugin.js + eslint.config.js (severity error).
Documenta en .claude/rules/eslint-plugin.md.
Corre node --test tools/eslint/rules/__tests__/<nombre>.test.js antes de commit.
```

# Do's and Don'ts

## Do

- ✅ Usar exclusivamente design tokens del tema Aura (`text-color`, `bg-surface-*`, `bg-primary`).
- ✅ Proporcionar variante `dark:` cuando se usan tokens de surface.
- ✅ Componer elevación con `border border-surface rounded-2xl` (sin sombras).
- ✅ Combinar `text-3xl` siempre con `font-bold`.
- ✅ Input labels con `font-semibold`, checkbox/radio labels con `font-normal`.
- ✅ Cualquier elemento con `cursor-pointer` lleva un `hover:*` correspondiente.
- ✅ `<a>` de texto: `font-medium text-primary hover:text-primary-emphasis underline cursor-pointer transition-colors duration-150`.
- ✅ Iconos sharp regular para inline; sharp solid para toggles activos; sharp duotone solo ≥text-2xl decorativo.
- ✅ Botones de acción con `<p-button>` o `<button pButton>`. Nav/list items sin `pButton`.

## Don't

- ❌ Colores Tailwind genéricos (`text-gray-*`, `bg-blue-*`, `text-slate-*`).
- ❌ Hex/rgb hardcodeados (`#fff`, `rgb(0,0,0)`) excepto datos con significado fijo (charts).
- ❌ `shadow-*`. Usar `border border-surface` para elevación.
- ❌ Spacing fuera de la escala (`gap-9`, `p-7`, `m-3`, `gap-[13px]`).
- ❌ `rounded-sm`, `rounded-md`, `rounded-none`, `rounded-[value]`.
- ❌ CSS/SCSS en archivos de componente. Todo con Tailwind en el template.
- ❌ `::ng-deep`. Usar `class`/`styleClass` o design tokens.
- ❌ `style=""` inline. Para valores dinámicos: `[style.backgroundColor]="item.color"` o `[ngStyle]`.
- ❌ Combinaciones tipográficas fuera de las recetas definidas.
- ❌ `bg-surface-*` sin su par `dark:bg-surface-*`.
- ❌ `transition-all` o `transition` bare. Solo narrow (`transition-colors`, `transition-opacity`, etc.).
- ❌ `pi pi-*` (PrimeIcons removido).
- ❌ `fa-regular`/`fa-solid` SIN el prefijo `fa-sharp` o `fa-sharp-duotone` (familia base no cargada).
- ❌ Otras librerías de íconos (Heroicons, Lucide, Material Icons).
- ❌ `fa-sharp-duotone` para iconos inline ni como estado activo de toggles.
- ❌ `fa-brands` para iconos de UI generales — solo logos reales.
