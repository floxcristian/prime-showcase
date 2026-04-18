# PrimeNG Showcase - Guia de Estilo para Claude

## Stack

- Angular 21 (standalone components, signals, new control flow)
- PrimeNG 21 con tema Aura (`@primeuix/themes`)
- Tailwind CSS 4 con plugin `tailwindcss-primeui`
- Font Awesome Pro 7 (self-hosted, estilos: sharp-regular, sharp-solid, sharp-duotone-regular, brands)
- SCSS (archivos presentes por convención pero vacíos — todo el estilizado se hace con Tailwind)
- TypeScript strict mode (`strictTemplates`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature`)

## Resumen de reglas críticas

Leer SIEMPRE antes de generar código:

1. **PrimeNG primero** — Usar componentes nativos de PrimeNG. No crear custom components si PrimeNG ya tiene uno.
2. **Solo design tokens** — Nunca `text-gray-500`, `bg-blue-100`, `#fff`. Solo `text-color`, `bg-surface-*`, `bg-primary`, etc.
3. **OnPush + standalone** — Todos los componentes. Sin excepciones.
4. **Tailwind en template, SCSS vacío** — Cero CSS en archivos `.scss`. Todo con clases Tailwind en el HTML.
5. **Consultar MCP de PrimeNG** — Antes de implementar cualquier componente PrimeNG, verificar su API actual via MCP.
6. **Consistencia** — Revisar componentes existentes en `src/app/modules/` y replicar sus patrones exactos.

## Índice

- [Stack](#stack)
- [Resumen de reglas críticas](#resumen-de-reglas-críticas)
- [MCP: PrimeNG (`@primeng/mcp`)](#mcp-primeng-primengmcp)
- [Regla principal: Consistencia con lo existente](#regla-principal-consistencia-con-lo-existente)
- [Componentes: Siempre PrimeNG primero](#componentes-siempre-primeng-primero)
- [Estructura de componente](#estructura-de-componente)
- [Templates HTML](#templates-html)
- [Design System: Valores Restringidos](#design-system-valores-restringidos)
- [Patrones estructurales de página](#patrones-estructurales-de-página)
- [Recetas de estado dinámico (ngClass)](#recetas-de-estado-dinámico-ngclass)
- [Patrones de componentes PrimeNG](#patrones-de-componentes-primeng)
- [Iconos](#iconos)
- [Routing](#routing)
- [Organización de archivos](#organización-de-archivos)
- [Servicios y estado](#servicios-y-estado)
- [Zoneless change detection (implicaciones para autoría)](#zoneless-change-detection-implicaciones-para-autoría)
- [SSR guard](#ssr-guard)
- [Focus ring: `:focus-visible` vs `:focus-within` vs `:has()`](#focus-ring-focus-visible-vs-focus-within-vs-has)
- [PrimeNG imports: Module vs Standalone](#primeng-imports-module-vs-standalone)
- [Charts (Chart.js via PrimeNG)](#charts-chartjs-via-primeng)
- [Loading states: `<p-skeleton>` always](#loading-states-p-skeleton-always)
- [Incremental Hydration (`@defer hydrate`)](#incremental-hydration-defer-hydrate)
- [ESLint y enforcement del design system](#eslint-y-enforcement-del-design-system)
- [Lo que NO hacer](#lo-que-no-hacer)

## MCP: PrimeNG (`@primeng/mcp`)

Este proyecto tiene configurado el MCP oficial de PrimeNG (`.mcp.json`). **Usarlo siempre** antes de implementar o recomendar un componente PrimeNG para:
- Verificar que el componente existe y su API actual (props, eventos, slots).
- Consultar ejemplos de uso y opciones de theming.
- Buscar el componente correcto por funcionalidad si no se conoce el nombre exacto.

**Siempre** consultar el MCP antes de implementar cualquier componente PrimeNG. No asumir la API de memoria.

> **Build budgets:** Initial bundle < 750kB (warn) / 1MB (error). Component styles < 4kB (warn) / 8kB (error).

## Regla principal: Consistencia con lo existente

**Antes de implementar cualquier feature**, revisar los componentes existentes en `src/app/modules/` y replicar sus patrones exactos. **Nunca** inventar nuevos patrones. Si hay duda entre dos formas de hacer algo, elegir la que ya existe en el código.

## Componentes: Siempre PrimeNG primero

- **SIEMPRE** usar componentes nativos de PrimeNG antes de crear componentes custom.
- Botones de acción: `<p-button>` o `<button pButton>`. Ver sección "Elementos interactivos: acción vs navegación" para cuándo NO usar pButton.
- Inputs: `<input pInputText>`, `<p-inputnumber>`, `<p-textarea>`, etc.
- Tablas: `<p-table>`, nunca tablas HTML custom.
- Selects: `<p-select>`, `<p-selectbutton>`, `<p-multiselect>`.
- Overlays: `<p-dialog>`, `<p-popover>`, `<p-menu>`, `<p-tooltip>`.
- Feedback: `p-toast`, `p-confirmdialog`, `p-progressbar`, `p-tag`.
- Si PrimeNG no tiene un componente para el caso de uso, construirlo con Tailwind + design tokens de PrimeNG (nunca con CSS puro arbitrario).

## Estructura de componente

```typescript
// Angular
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
// PrimeNG
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
// Local
import { MOCK_DATA } from './mocks/data';
import { MyModel } from './models/my-model.interface';

const NG_MODULES = [CommonModule, FormsModule];
const PRIME_MODULES = [ButtonModule, TableModule];

@Component({
  selector: 'app-feature-name',
  imports: [NG_MODULES, PRIME_MODULES],
  templateUrl: './feature-name.component.html',
  styleUrl: './feature-name.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'flex-1 h-full overflow-y-auto border border-surface rounded-2xl',
  },
})
export class FeatureNameComponent {
  // propiedades simples, signals para estado reactivo
}
```

Reglas:
- **Siempre** `ChangeDetectionStrategy.OnPush`.
- **Siempre** standalone (sin NgModules).
- Agrupar imports en `NG_MODULES` y `PRIME_MODULES` como arrays const.
- Imports ordenados: Angular > PrimeNG > Local (mocks, models, constants).
- Selector: `app-feature-name`.
- `host.class` para layout del componente host (ver patrones de host abajo).
- Preferir `signal()` y `computed()` sobre propiedades mutables para estado reactivo.
- Usar `effect()` para side effects (como reaccionar a cambios de tema).
- `inject()` en vez de constructor injection.
- **El archivo `.scss` del componente debe permanecer vacío.** Todo se resuelve con Tailwind en el template.

### Patrones de host class por tipo de página

Elegir según el tipo de contenido:

```typescript
// 1. Página con contenido simple (cards, customers, movies) → borde + padding + scroll
host: { class: 'flex-1 h-full overflow-y-auto overflow-x-clip overflow-hidden border border-surface rounded-2xl p-6' }

// 2. Página con paneles lado a lado (chat) → flex sin padding (cada panel maneja su propio padding)
host: { class: 'flex-1 h-full overflow-y-auto overflow-x-clip overflow-hidden flex border border-surface rounded-2xl' }

// 3. Página con paneles separados (inbox) → gap entre paneles, sin borde externo
host: { class: 'flex gap-4 h-full flex-1 w-full overflow-auto' }

// 4. Página wrapper (overview) → sin borde, el contenido interno define sus propias cards
host: { class: 'flex-1 h-full overflow-y-auto pb-0.5' }
```

## Templates HTML

- Usar `@if`, `@for`, `@switch` (Angular 17+ control flow). **Nunca** `*ngIf` o `*ngFor`.
- `@for` siempre requiere `track`.
- `[(ngModel)]` para two-way binding en formularios simples.

```html
@for (item of items; track item.id) {
  <div class="flex items-center gap-2">
    <span class="text-color font-medium">{{ item.name }}</span>
  </div>
}

<!-- @for con $index -->
@for (file of files; track file; let i = $index) {
  <div>{{ i }}: {{ file.name }}</div>
}

@if (isVisible) {
  <p-dialog header="Title" [(visible)]="isVisible">...</p-dialog>
}

<!-- Array join en template -->
{{ item.categories.join(", ") }}

<!-- stopPropagation en click -->
(click)="$event.stopPropagation(); data.bookmarked = !data.bookmarked"
```

---

## Design System: Valores Restringidos

**REGLA CRITICA:** Usar SOLO los valores listados abajo. No inventar valores intermedios ni arbitrarios. Esto es lo que mantiene la consistencia visual.

### Paleta de colores — SOLO design tokens

**Nunca** usar colores Tailwind genéricos (`text-gray-500`, `bg-blue-100`, `text-slate-700`) ni valores hex/rgb hardcodeados. Usar exclusivamente tokens semánticos del tema Aura:

```text
TEXTO
  text-color                          → Texto principal (body, títulos)
  text-color-emphasis                 → Texto principal hover (CTA cards, links destacados)
  text-muted-color                    → Texto secundario (labels, ayuda, metadata)
  text-muted-color-emphasis           → Texto secundario hover
  text-primary                        → Texto con color de acento
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
  bg-primary-100                      → Fondo sutil de acento (ej: avatar iniciales)
  bg-transparent                      → Sin fondo

BORDES
  border-surface                      → Borde estándar (cards, divisores)
  border-primary                      → Borde de acento (raro, solo énfasis)
  border-black/10 dark:border-white/20 → Solo layout principal (main.component)

  ⚠️ border-surface vs surface-200: NO son iguales.
  - `border-surface` / `divide-surface` usa --p-surface-border-color → borde FUERTE (cards, panels)
  - `border-surface-200 dark:border-surface-800` / `divide-surface-200 dark:divide-surface-800`
    → borde SUTIL gris-azulado (dividers entre items de lista, filas de tabla interna)
  Usar surface-200/800 para separadores internos que necesiten ser más suaves que border-surface.

SURFACE INTERMEDIOS (solo para detalles finos, no para layout principal)
  text-surface-400 / text-surface-500   → Ticks de charts, texto muy sutil
  text-surface-600 dark:text-surface-400 → Texto de empresas/logos
  fill-surface-600 dark:fill-surface-400 → Fill de SVGs inline

EXCEPCIONES PERMITIDAS
  Colores con nombre solo para indicadores semánticos con significado fijo:
  - bg-violet-100, text-violet-950    → Indicadores semánticos (tags, badges, categorías)
  - bg-orange-100, text-orange-950    → Indicadores semánticos (alertas, warnings, categorías)
  - text-yellow-500                   → Iconos de criptomoneda (BTC)
  - text-green-500                    → Indicadores de estado activo/online (dot icons)
  Estos NO son colores de UI general. Son datos con significado.
```

### Dark mode

Siempre proporcionar variante dark cuando se usan tokens de surface:
```html
<!-- Patrón estándar -->
class="bg-surface-0 dark:bg-surface-950"
class="bg-surface-100 dark:bg-surface-800"
class="bg-surface-200 dark:bg-surface-700"
```
Los componentes PrimeNG manejan dark mode automáticamente via el tema Aura.
Para CSS variables en JS (charts): `getComputedStyle(document.documentElement).getPropertyValue('--p-primary-400')`.

### Focus ring — CSS custom properties

El focus ring global usa estas variables, definidas por el preset Aura en `src/app/app.config.ts` → `definePreset(..., { semantic: { focusRing: {...} } })`:

```text
--p-focus-ring-width      (ej: 2px)
--p-focus-ring-style      (ej: solid)
--p-focus-ring-color      (primary)
--p-focus-ring-offset     (ej: 2px)
--p-focus-ring-shadow     (ej: 0 0 0 4px hsl(...))
```

Uso práctico: al construir un elemento enfocable custom (raro — la mayoría de UI usa PrimeNG o inputs nativos), heredar la regla global `:focus-visible` de `styles.scss` o aplicar estas vars directamente. Nunca hardcodear colores/widths del focus ring.

### Escala de spacing — valores permitidos

```text
GAP:     gap-1 | gap-2 ← DEFAULT | gap-3 | gap-4 | gap-5 | gap-6 ← CARDS/SECCIONES | gap-8
PADDING: p-1 | p-2 ← DEFAULT | p-3 | p-4 | p-6 ← CARDS | px-4 py-1 (botones) | px-7 py-5 (cabecera)
MARGIN:  mt-1 (sutil) | mt-2/mb-2 | mt-4/mb-4 (secciones) | mt-6/mb-6 (grandes) | mb-0 (reset)
FLEX:    grow (expandir) | shrink-0 (nunca encoger, ej: avatares en flex) | flex-1 (crecer+encoger)

NO USAR: gap-9,10,12 | p-7,8 | m-7,8,9 | valores arbitrarios como gap-[13px]
EXCEPCIONES ACEPTADAS (pre-existentes, documentadas en AUDIT_BASELINE.md EX-005):
  gap-7, gap-8, py-8 (chat) | p-5 (side-menu) | mt-3, mb-5, mt-5 (layouts) | mt-10 (separadores)
```

### Escala de border-radius

```text
rounded-full    → Círculos: avatares, indicadores de estado, dots
rounded-lg      → Elementos pequeños: botones, inputs, badges, avatares con imagen
rounded-xl      → Contenedores medianos
rounded-2xl     → Cards estándar ← MÁS USADO PARA CARDS
rounded-3xl     → Cards grandes o secciones principales

NO USAR: rounded, rounded-sm, rounded-md, rounded-none ni rounded-[value].
```

**Cuándo usar cada nivel** — elegir según la jerarquía del elemento en el layout:

| Nivel | Valor | Cuándo usarlo | Ejemplos |
|---|---|---|---|
| **Círculo** | `rounded-full` | Elementos que deben ser perfectamente redondos | Avatares circle, status dots, progress bars |
| **Elemento interno** | `rounded-lg` | Elementos pequeños DENTRO de una card o panel | Inputs, botones, nav items, imágenes, tablas internas, badges sobre imágenes |
| **Contenedor medio** | `rounded-xl` | Elementos interactivos medianos | Carousel items, media grid items, movie cards |
| **Card / panel** | `rounded-2xl` | Contenedores de datos con borde propio, panels de layout | Overview cards, inbox/chat panels, host de componentes |
| **Form card** | `rounded-3xl` | Cards con formularios o contenido editable | Profile cards, file upload, settings, price range |

**Regla clave:** Si un elemento vive DENTRO de un contenedor que ya tiene `rounded-2xl` (como el host), usar `rounded-lg` para sub-contenedores internos (tablas, listas). NO usar `rounded-2xl` para ambos — el radio interior debe ser menor que el exterior.

### Escala de tipografía

Combinaciones aprobadas — usar estas recetas, no inventar combinaciones nuevas:

```text
TÍTULOS:    text-3xl font-semibold leading-normal (principal)
            text-2xl font-medium leading-8 (sección)
            text-xl font-medium leading-7 (subsección, inbox/movies headers)
SUBTÍTULOS: text-muted-color font-medium leading-normal ← SUBTÍTULO DE PÁGINA
            text-color font-semibold leading-6 ← TÍTULO DE CARD
BODY:       text-color leading-6 (base)
            text-color font-medium leading-6 (énfasis)
            text-sm leading-5 (compacto)
            text-sm font-medium leading-5 (compacto con énfasis — labels, stats, nav items)
SECUNDARIO: text-muted-color leading-6 (metadata)
            text-sm text-muted-color leading-5 (labels)
PEQUEÑO:    text-xs font-medium (badges, contadores)
            text-xs leading-4 (emails, sub-labels compactos)
ESPECIAL:   text-base font-medium leading-5 (nav items side-menu)
            text-sm font-medium leading-tight (movie titles — contenedores estrechos)

PESO: font-medium = default (90%) | font-semibold = solo títulos card/sección | font-normal = casi nunca
```

> **Nota:** ESLint valida valores individuales (text sizes, leading, font-weight) contra la escala aprobada. Las combinaciones se validan por code review contra estas recetas.

### Sombras

```text
NO USAR SOMBRAS. El proyecto usa border-surface en vez de sombras para definir
elevación. La única excepción es el tooltip custom de Chart.js.
Si necesitas elevar un elemento, usar: border border-surface rounded-2xl
```

### Patrones de layout

```html
<!-- Card estándar -->
<div class="border border-surface rounded-2xl p-6">...</div>

<!-- Card con cabecera expandida -->
<div class="border border-surface rounded-2xl py-5 px-7">
  <div class="text-color font-semibold leading-6">Título</div>
  ...
</div>

<!-- Layout responsive (columnas en desktop, stack en mobile) -->
<div class="flex flex-col xl:flex-row gap-6">...</div>

<!-- Contenedor principal de página -->
<div class="flex-1 h-full overflow-y-auto pb-0.5">...</div>

<!-- Grid responsive -->
<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-x-4 gap-y-6">...</div>
```

Breakpoints: usar `xl:` como breakpoint principal para layout. `lg:` secundario. `md:` solo para grids. `sm:` no se usa.

### Estados interactivos

```html
<!-- Hover estándar para elementos clickeables -->
class="hover:bg-emphasis cursor-pointer transition-colors"

<!-- Active (click/pressed) -->
class="active:bg-surface-200 dark:active:bg-surface-700"

<!-- Hover en texto -->
class="hover:text-muted-color-emphasis"

<!-- Hover con opacidad (links, iconos) -->
class="hover:opacity-70 transition-opacity"

<!-- Elemento activo/seleccionado (nav, tabs) -->
class="text-color bg-emphasis"           → Activo
class="text-muted-color bg-transparent"  → Inactivo
```

### Transiciones — narrow por default

**REGLA CRITICA:** `transition-all` está **prohibido sin excepciones** y bloqueado por `showcase/no-forbidden-transitions`. Solo se permiten: `transition-colors`, `transition-opacity`, `transition-transform`, `transition-none`, `transition-shadow`, y arbitrary values narrow (`transition-[transform]`).

| Efecto | Clase | Cuándo |
|---|---|---|
| Cambio de color/fondo (hover:bg-emphasis, hover:text-*) | `transition-colors` | Default para la mayoría de elementos interactivos |
| Cambio de opacidad (hover:opacity-70) | `transition-opacity` | Imágenes, avatares, iconos con hover por opacidad |
| Sin animación | — (omitir) | Nav items con estado activo binario (ver side-menu) |
| Transform / layout (movement) | `transition-transform` | Animaciones de movimiento (carousel, sheets, panels) |

**No agregar animaciones** más allá de estas transitions (sin keyframes, sin delays).

Rationale, validación por industria y análisis frame-by-frame del fade-out en focus rings: **Ref: ADR-001 §9**.

**REGLA:** Todo elemento con `cursor-pointer` DEBE tener un `hover:*` correspondiente. Sin hover feedback el usuario no sabe que puede interactuar. Elegir según el tipo de elemento:
- **Contenedores/cards/rows** → `hover:bg-emphasis`
- **Imágenes/avatares** → `hover:opacity-70`
- **Texto/links** → `hover:text-muted-color-emphasis`

**Exenciones de `showcase/hover-requires-cursor-pointer`:**
- **`<p-*>` components** y cualquier elemento con la directiva `[pButton]` están exentos. PrimeNG aplica sus propios estados hover vía el tema Aura; declarar `cursor-pointer` sobre un `<p-button>` es redundante y añade ruido.
- **`group-hover:*`** y **`peer-hover:*`** NO se flaggean: son patrones legítimos de Tailwind donde el hover vive en el padre/sibling y el efecto se aplica a un descendiente — el `cursor-pointer` debe estar en el elemento que captura el hover, no en el receptor del estilo.

### Elementos interactivos: acción vs navegación

**REGLA CRITICA:** No todo elemento clickeable es un botón de acción. Distinguir entre:

| Tipo | Elemento | Directiva | Estilo |
|---|---|---|---|
| **Botón de acción** (submit, cancel, download, toggle) | `<p-button>` o `<button pButton>` | `pButton` obligatorio | PrimeNG controla el estilo |
| **Nav item principal** (side-menu, routerLink) | `<div>` con `[routerLink]` | Sin pButton | Tailwind + ngClass/routerLinkActive |
| **Nav item in-page** (sidebar tabs, filtros) | `<button>` o `<div>` | Sin pButton | Tailwind + ngClass |
| **List item clickeable** (chat list, inbox rows) | `<div>` | Sin pButton | Tailwind + ngClass |
| **Card/item clickeable** (carousel, media grid) | `<div>` | Sin pButton | Tailwind hover only |
| **Menu item en card** (acciones de perfil, settings) | `<button>` | Sin pButton | Tailwind + active state |
| **CTA card item** (postulantes, ver más) | `<button>` | Sin pButton | Tailwind, bg-emphasis por defecto |

**¿Por qué no usar pButton en nav/list items?** `pButton` aplica estilos de botón de PrimeNG (fondo primary, padding, tipografía) que sobreescriben las clases Tailwind de layout. Los nav/list items necesitan control fino de estados activo/inactivo con clases propias.

#### Recetas de nav/list items

```html
<!-- 1. Nav principal (side-menu) — usa routerLinkActive para estado -->
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

<!-- 2. Nav in-page (inbox sidebar, filtros) — usa ngClass para estado -->
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

<!-- 3. List item clickeable (chat list) — hover only, activo sutil -->
<div
  (click)="select(item)"
  [ngClass]="{ 'bg-emphasis': item.id === activeId() }"
  class="flex items-center gap-2 p-4 cursor-pointer hover:bg-emphasis transition-colors"
>
  <!-- contenido -->
</div>

<!-- 4. Card/item clickeable (carousel, grid) — solo hover -->
<div class="p-2 rounded-xl hover:bg-emphasis transition-colors cursor-pointer">
  <!-- contenido -->
</div>

<!-- 5. Menu item en card (lista de acciones sin pButton) -->
<button
  class="w-full flex items-center gap-2 text-color p-2 bg-transparent hover:bg-emphasis active:bg-surface-200 dark:active:bg-surface-700 cursor-pointer rounded-lg transition-colors select-none"
>
  <i class="fa-regular fa-arrows-rotate"></i>
  <span>Refresh</span>
</button>

<!-- 6. CTA card item (botón llamativo dentro de card, sin pButton) -->
<button
  class="p-4 rounded-3xl w-full bg-emphasis transition-colors text-color hover:text-color-emphasis flex items-center gap-2 justify-between cursor-pointer"
>
  <div class="flex items-center"><!-- avatares, iconos --></div>
  <div class="flex items-center gap-2">
    <span class="font-medium leading-6">12 Postulantes</span>
    <i class="fa-regular fa-arrow-right"></i>
  </div>
</button>
```

Clases base compartidas: `cursor-pointer hover:bg-emphasis transition-colors rounded-lg`

Estados:
- **Activo fuerte** (nav principal): `text-primary-contrast bg-primary hover:bg-primary-emphasis`
- **Activo sutil** (nav in-page, list items): `text-color bg-emphasis`
- **Inactivo**: `text-muted-color bg-transparent`
- **Solo hover** (cards, carousel): sin estado activo, solo `hover:bg-emphasis`
- **CTA card** (botón destacado en card): `bg-emphasis text-color hover:text-color-emphasis rounded-3xl` — fondo visible por defecto, hover cambia texto

---

## Patrones estructurales de página

### Header de página

```html
<div class="flex flex-wrap gap-4 items-start justify-between p-1">
  <!-- Título -->
  <div class="flex-1">
    <div class="text-muted-color font-medium leading-normal">Subtítulo</div>
    <div class="text-color text-3xl font-semibold leading-normal">Título</div>
  </div>
  <!-- Acciones -->
  <div class="flex gap-2 whitespace-nowrap flex-nowrap">
    <p-iconfield iconPosition="left">
      <p-inputicon class="fa-regular fa-magnifying-glass"></p-inputicon>
      <input type="text" pInputText placeholder="Search" />
    </p-iconfield>
    <p-button severity="secondary" outlined>
      <i class="fa-regular fa-bell"></i>
    </p-button>
  </div>
</div>
```

### Header de card

```html
<!-- Con título + leyenda/acciones -->
<div class="flex items-center gap-6 mb-6">
  <div class="flex-1 text-color font-semibold leading-6">Título</div>
  <div class="flex items-center gap-5">
    <!-- Leyenda o botones -->
  </div>
</div>

<!-- Con avatar + info -->
<div class="flex items-center gap-3">
  <p-overlayBadge severity="danger" styleClass="w-fit">
    <p-avatar image="url" class="rounded-lg overflow-hidden flex" />
  </p-overlayBadge>
  <div>
    <div class="font-medium text-color leading-6">Nombre</div>
    <div class="mt-1 text-muted-color leading-5">Detalle</div>
  </div>
</div>
```

### Item de lista (nav, chat, inbox)

```html
<!-- Patrón base de list item -->
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

<!-- Patrón de nav item -->
<div class="px-4 py-2 rounded-lg flex items-center gap-2 cursor-pointer hover:bg-emphasis transition-colors">
  <i class="fa-regular fa-inbox"></i>
  <span class="font-medium">Label</span>
</div>

<!-- Patrón de settings row (icon + label + toggle) -->
<div class="flex items-center gap-2">
  <i class="fa-regular fa-bell text-color"></i>
  <div class="leading-6 font-medium text-color flex-1">Notification</div>
  <p-toggleswitch [(ngModel)]="value" />
</div>
```

### Scroll y sticky headers

```html
<!-- Contenedor scrollable estándar -->
<div class="flex-1 overflow-y-auto flex flex-col gap-6">
  <!-- Sticky header dentro del scroll -->
  <div class="sticky top-0 z-10 bg-surface-0 dark:bg-surface-950">
    Header que se queda fijo
  </div>
  <!-- Contenido que scrollea -->
</div>

<!-- Tabla con scroll flex (llena el espacio disponible) -->
<p-table [scrollable]="true" scrollHeight="flex">...</p-table>
```

Reglas: sticky headers siempre necesitan `bg-surface-0 dark:bg-surface-950` y `z-10` para cubrir el contenido.

### Text overflow

```html
<!-- Una línea con ellipsis -->
<div class="line-clamp-1">Texto largo...</div>
<div class="truncate">Texto largo...</div>

<!-- Múltiples líneas -->
<div class="line-clamp-4">Descripción larga...</div>

<!-- Prevenir wrap en botones/labels -->
<div class="whitespace-nowrap">No wrap</div>

<!-- Nombre de archivo con ellipsis -->
<span class="text-ellipsis whitespace-nowrap overflow-hidden">archivo.pdf</span>
```

### Imágenes y medios

```html
<!-- Imagen en contenedor con aspect ratio -->
<div class="relative aspect-[195/118.5] rounded-lg overflow-hidden">
  <img [src]="url" class="w-full h-full object-cover" />
</div>

<!-- Imagen cuadrada (media grid) -->
<div class="aspect-square rounded-lg overflow-hidden">
  <img [src]="url" class="w-full h-full object-cover block" />
</div>

<!-- Overlay sobre imagen (badge, progreso) -->
<div class="relative ...">
  <img ... />
  <div class="absolute z-10 top-2 right-2">Badge</div>
  <div class="absolute z-10 bottom-2 inset-x-2">Progress</div>
</div>
```

Regla: siempre `object-cover` para imágenes en contenedores. Siempre `rounded-lg overflow-hidden` en el contenedor.

### Layouts multi-panel

```html
<!-- 3 paneles (ej: chat) — host: flex border border-surface rounded-2xl -->
<div class="w-4/12 xl:w-3/12 min-w-40 h-full overflow-hidden flex flex-col">
  <!-- Header fijo con border-b -->
  <div class="flex items-center justify-between gap-2 p-4 border-b border-surface">
    <h1 class="text-2xl font-medium leading-8 text-color">Título</h1>
    <p-button icon="fa-sharp fa-regular fa-plus" text />
  </div>
  <!-- Contenido scrolleable -->
  <div class="flex-1 flex flex-col overflow-auto">...</div>
</div>
<div class="w-8/12 xl:w-6/12 border-x border-surface flex flex-col">
  <!-- Header fijo con border-b (misma estructura que panel izquierdo) -->
  <div class="flex items-center p-4 border-b border-surface">...</div>
  <!-- Contenido scrolleable -->
  <div class="flex-1 overflow-auto">...</div>
</div>
<div class="w-3/12 xl:block hidden min-w-40 overflow-auto">
  <!-- Panel derecho: info (oculto bajo xl) -->
</div>

<!-- 2 paneles (ej: inbox) — host: flex gap-4 -->
<div class="w-64 h-full overflow-hidden border border-surface rounded-2xl flex flex-col">
  <!-- Header fijo con border-b -->
  <div class="flex items-center justify-between gap-2 p-4 border-b border-surface">...</div>
  <!-- Contenido scrolleable -->
  <div class="flex-1 flex flex-col overflow-auto">...</div>
</div>
<div class="flex-1 h-full border border-surface rounded-2xl">
  <!-- Contenido principal -->
</div>
```

Reglas multi-panel:
- **Headers consistentes:** Todos los headers de panel deben usar `p-4 border-b border-surface`. Esto garantiza alturas alineadas entre paneles. Para tablas PrimeNG, usar `header.padding: '1rem'` en `[dt]` tokens.
- **Estructura header/scroll:** Cada panel con header usa `overflow-hidden` en el contenedor, header fijo arriba, y `flex-1 overflow-auto` en el contenido. **Nunca** usar `sticky` como sustituto de esta estructura.
- Paneles se separan con `border-x border-surface` (adyacentes) o `gap-4` + bordes propios (separados).
- Paneles ocultos en mobile usan `xl:block hidden`.
- Cada panel scrollea independientemente con `overflow-auto` en su zona de contenido (no en el contenedor padre).
- Anchos con fracciones: `w-4/12`, `w-8/12`, `w-3/12`. Fijos: `w-64`, `w-72`.

### Formularios dentro de cards

```html
<div class="border border-surface rounded-3xl p-6 flex flex-col gap-6">
  <div>
    <label class="text-color font-medium leading-6" for="id">Label</label>
    <input pInputText id="id" class="mt-2 w-full" />
  </div>
  <div class="flex items-center gap-3">
    <i class="fa-regular fa-bell text-color text-xl"></i>
    <div class="leading-6 text-color flex-1">Label</div>
    <p-toggleswitch [(ngModel)]="value" />
  </div>
  <div class="flex items-center gap-2">
    <button pButton label="Cancel" outlined class="flex-1"></button>
    <button pButton label="Submit" class="flex-1"></button>
  </div>
</div>
```

Reglas: `rounded-3xl` para form cards (vs `rounded-2xl` para data cards) | Label encima con `mt-2` | `p-divider` entre secciones | Botones `flex-1` al final | Multi-columna: `flex flex-wrap items-start gap-6` con `flex-1` por columna

---

## Recetas de estado dinámico (ngClass)

Patrones estándar para estados de UI. Usar exactamente estas recetas:

```html
<!-- Selección activa (nav, tabs, chat list) -->
[ngClass]="{
  'text-color bg-emphasis': isActive,
  'text-muted-color bg-transparent': !isActive
}"

<!-- Avatar fallback (sin imagen → iniciales) — UN SOLO COLOR para todos -->
[ngClass]="{
  '!bg-primary-100 !text-primary-950': !item.image
}"

<!-- Mensaje enviado vs recibido (chat) -->
[ngClass]="{
  'ml-auto flex-row-reverse': message.type === 'sent'
}"
<!-- Bubble: bg-primary para enviados, bg-surface-100 dark:bg-surface-800 para recibidos -->
<!-- Texto: text-primary-contrast para enviados, text-color para recibidos -->

<!-- Toggle de ícono (bookmark, dark mode) -->
[ngClass]="value ? 'fa-solid fa-bookmark' : 'fa-regular fa-bookmark'"

<!-- Visibilidad condicional (slim menu) -->
[class]="isHidden ? 'hidden' : 'font-medium leading-none'"
```

---

## Patrones de componentes PrimeNG

### Botones — variantes y cuándo usarlas

```html
<!-- Botón con ícono only — para acciones secundarias en headers/toolbars -->
<p-button icon="fa-regular fa-ellipsis" text rounded />

<!-- Botón secundario outlined (acciones secundarias) -->
<p-button severity="secondary" outlined />

<!-- Botón primario (acción principal) -->
<p-button label="Download" icon="fa-regular fa-download" iconPos="right" />

<!-- Botón full-width -->
<p-button label="Show All" outlined styleClass="w-full" />
```

Reglas de severity:
- `severity="secondary"` → default para la mayoría de botones
- Sin severity (default/primary) → acción principal destacada
- `severity="danger"` → acciones destructivas
- `severity="contrast"` → alto contraste visual
- `severity="success"` / `"warn"` → rara vez, solo donde el significado semántico lo requiere

**Icon-only buttons — tooltip obligatorio.** Todo `<p-button>` sin `label` visible (solo `icon`) DEBE declarar tanto `aria-label` como `pTooltip` con el mismo texto:

```html
<!-- Correcto: screen readers (aria-label) + mouse/keyboard (pTooltip) -->
<p-button icon="fa-sharp fa-regular fa-bell" aria-label="Notifications" pTooltip="Notifications" />
```

Rationale: `aria-label` expone el propósito a tecnologías asistivas, pero usuarios de mouse/teclado que no usan screen reader no ven esa etiqueta — sin `pTooltip` el botón es opaco para ellos. Con ambos, la UX es equivalente en todos los modos de entrada. Excepción: si el botón tiene un `label` visible, el texto ya está presente y `pTooltip` sería redundante. Enforcement: la regla `showcase/no-icon-button-without-tooltip` falla el lint si un `<p-button>` tiene `icon` + `aria-label` pero le falta `pTooltip`.

### Tags y Badges

```html
<!-- Tag con severity dinámica -->
<p-tag
  [severity]="data.status === 'Active' ? 'success' : 'danger'"
  [value]="data.status"
  styleClass="font-medium"
/>

<!-- OverlayBadge como indicador de estado -->
<p-overlayBadge severity="danger" styleClass="!min-w-0 !w-2.5 !h-2.5">
  <p-avatar ... />
</p-overlayBadge>
```

### Avatares

```html
<!-- Avatar con imagen -->
<p-avatar image="url" class="rounded-lg overflow-hidden flex" />

<!-- Avatar con iniciales (sin imagen) -->
<p-avatar label="JD" styleClass="text-base font-medium"
  class="!bg-primary-100 !text-primary-950" />

<!-- Avatar con indicador de estado -->
<p-overlayBadge severity="danger" styleClass="w-fit">
  <p-avatar image="url" class="rounded-lg overflow-hidden flex" />
</p-overlayBadge>
```

### Tablas — templates y estructura

```html
<p-table
  [value]="data"
  [dt]="tableTokens"
  [scrollable]="true"
  scrollHeight="flex"
  [tableStyle]="{ 'min-width': '50rem' }"
  [paginator]="true"
  [rows]="5"
  paginatorStyleClass="!bg-transparent"
>
  <ng-template #header>
    <tr>
      <th class="w-1/12">Id</th>
      <th class="w-1/4">Name</th>
    </tr>
  </ng-template>
  <ng-template #body let-item>
    <tr>
      <td class="w-1/12">
        <div class="text-muted-color">{{ item.id }}</div>
      </td>
      <td class="w-1/4">
        <div class="flex items-center">
          <p-avatar [label]="item.initials" shape="circle" />
          <div class="leading-6 text-muted-color flex-1">{{ item.name }}</div>
        </div>
      </td>
    </tr>
  </ng-template>
</p-table>

<!-- Tabla con selección -->
<p-table [(selection)]="selectedRows" dataKey="id">
  <ng-template #header>
    <tr>
      <th style="width: 1rem"><p-tableHeaderCheckbox /></th>
      <!-- columnas -->
    </tr>
  </ng-template>
  <ng-template #body let-data>
    <tr>
      <td style="width: 1rem"><p-tableCheckbox [value]="data" /></td>
      <!-- celdas -->
    </tr>
  </ng-template>
</p-table>

<!-- Tabla con caption (barra de acciones) -->
<ng-template #caption>
  <div class="flex xl:items-center justify-between gap-2 flex-col xl:flex-row">
    <!-- Acciones bulk + búsqueda + paginación -->
  </div>
</ng-template>
```

### Menú popup

```html
<!-- Trigger con botón -->
<p-button icon="fa-regular fa-ellipsis" severity="secondary" text
  (click)="menu.toggle($event)" />
<p-menu #menu [model]="menuItems" [popup]="true" />

<!-- En el .ts -->
menuItems: MenuItem[] = [
  { label: 'Refresh', icon: 'fa-regular fa-arrows-rotate' },
  { label: 'Export', icon: 'fa-regular fa-upload' },
];
```

### Navegación con routerLink

```html
<!-- Nav item con routerLinkActive -->
<div
  [routerLink]="navItem.url"
  routerLinkActive="text-primary-contrast bg-primary hover:bg-primary-emphasis"
  [routerLinkActiveOptions]="{ exact: true }"
  #rla="routerLinkActive"
  [pTooltip]="isSlimMenu ? navItem.title : ''"
  [ngClass]="{
    'text-muted-color hover:bg-emphasis bg-transparent': !rla.isActive,
    'w-12 justify-center py-4': isSlimMenu,
    'w-full': !isSlimMenu
  }"
  class="px-4 py-1 flex items-center gap-1 cursor-pointer text-base rounded-lg transition-colors select-none"
>
  <i [class]="navItem.icon"></i>
  <span>{{ navItem.title }}</span>
</div>
```

Reglas:
- `routerLinkActive` aplica clases de estado activo: `text-primary-contrast bg-primary`.
- `[routerLinkActiveOptions]="{ exact: true }"` para evitar falsos positivos.
- `#rla="routerLinkActive"` permite usar `rla.isActive` en `[ngClass]` para clases complementarias.
- `pTooltip` condicional: solo en modo slim (cuando el label está oculto).

### Popover

```html
<!-- Trigger -->
<p-button (onClick)="displayPopover($event, op)"
  icon="fa-regular fa-magnifying-glass" rounded outlined severity="secondary" />

<!-- Contenido -->
<p-popover #op>
  <ng-template pTemplate="content">
    <div class="flex gap-2">
      <p-button label="Details" size="small" outlined (onClick)="op.hide()" />
      <p-button label="Delete" severity="danger" size="small" outlined (onClick)="op.hide()" />
    </div>
  </ng-template>
</p-popover>

<!-- En el .ts -->
displayPopover(e: MouseEvent, op: Popover) {
  op.hide();
  setTimeout(() => { op.show(e); }, 150);
}
```

### Campos de formulario

```html
<!-- Búsqueda con ícono -->
<p-iconfield iconPosition="left">
  <p-inputicon class="fa-regular fa-magnifying-glass"></p-inputicon>
  <input type="text" pInputText placeholder="Search" />
</p-iconfield>
```

### Eventos PrimeNG vs Angular

```html
<!-- PrimeNG: camelCase -->
<p-selectbutton (onChange)="onSelect()" />
<p-button (onClick)="action($event)" />
<p-fileupload (onUpload)="handle($event)" (onSelect)="onFiles($event)" />

<!-- HTML nativo: minúsculas -->
<div (click)="action()">...</div>
<button (click)="action()">...</button>
```

Consultar MCP para el nombre exacto del evento de cada componente.

### styleClass y selectores avanzados

`styleClass` para ajustes de layout en componentes PrimeNG (usar `!` para override):
```text
styleClass="w-full"                          → Full width
styleClass="!min-w-0 !w-2.5 !h-2.5"         → Override badges
styleClass="!bg-transparent"                 → Fondo transparente (paginador)
valueStyleClass="!bg-surface-0 !rounded-full" → Relleno de p-progressbar
```

Selectores avanzados permitidos para contenedores con hijos repetidos:
```html
<div class="flex [&>*]:-mr-2">...</div>           <!-- Avatares solapados -->
<div class="[&>*]:flex-1 [&>*]:min-h-14">...</div> <!-- Hijos igual tamaño -->
<div class="last:[&>td]:border-0">...</div>        <!-- Último sin borde -->
```

---

## Iconos

El proyecto usa **Font Awesome Pro 7** self-hosted desde `public/fontawesome/`, con la familia **Sharp** (regular + solid + duotone) como sistema principal. PrimeIcons fue reemplazado completamente. Se cargan 4 familias (definidas en `angular.json` styles):

- `sharp-regular.css` → familia principal de UI (default inline)
- `sharp-solid.min.css` → estado activo de toggles binarios (outline vs filled)
- `sharp-duotone-regular.css` → hero icons a ≥text-4xl (empty states, onboarding)
- `brands.min.css` → solo para logos de marca reales (Bitcoin, Ethereum, etc.)

### Sintaxis

Sharp requiere TRES clases: **familia** + **estilo** + **nombre**:

```html
<!-- Sharp regular (default) -->
<i class="fa-sharp fa-regular fa-magnifying-glass"></i>
<button pButton icon="fa-sharp fa-regular fa-download" label="Descargar"></button>
<p-inputicon class="fa-sharp fa-regular fa-magnifying-glass"></p-inputicon>

<!-- Sharp solid (estado activo de toggles binarios) -->
<i class="fa-sharp fa-solid fa-bookmark"></i>

<!-- Sharp duotone (hero icons ≥text-4xl: empty states, onboarding) -->
<i class="fa-sharp-duotone fa-regular fa-cloud-arrow-up text-4xl"></i>

<!-- Brands (solo logos reales) -->
<i class="fa-brands fa-bitcoin"></i>
```

### Estrategia de estilos (REGLA CRITICA)

**Regla #1 — Un solo peso para UI funcional.** Linear, Vercel, Stripe, GitHub: todos usan UN solo estilo en su product UI. Mezclar pesos en una misma vista (especialmente regular ↔ duotone inline) rompe el ritmo visual. Es exactamente lo que evita la inconsistencia.

**Regla #2 — La selección depende del TAMAÑO y el ROL del icono, no del contenido semántico:**

| Tamaño / Rol | Familia | Por qué |
|---|---|---|
| **Inline (16-20px) junto a texto** — list items, metadata, labels, nav, toolbars | `fa-sharp fa-regular` siempre | Consistencia de ritmo visual al escanear |
| **Mediano (24-32px) standalone** — botones de acción, indicadores | `fa-sharp fa-regular` | Default consistente |
| **Estado activo de toggle binario** (bookmark, like, favorito, notif on/off) | `fa-sharp fa-solid` (mismo nombre que el inactivo) | Outline ↔ filled es el estándar universal de toggle — lectura inmediata |
| **Indicador de estado fijo activo** (solo visible cuando true, sin contraparte inactiva) | `fa-sharp fa-solid` | Mismo vocabulario visual que un toggle activo, sin ambigüedad |
| **Grande (≥48px / `text-4xl`+)** — empty states, hero feature cards, onboarding | `fa-sharp-duotone fa-regular` | A escala grande, los dos tonos crean profundidad |
| **Brand logos** (Bitcoin, Ethereum, GitHub, Google) | `fa-brands` | Iconos de marca reales — sharp brands no existe |

**Toggle pairs** — mismo nombre, sharp regular (off) ↔ sharp solid (on):

```html
[ngClass]="bookmarked ? 'fa-sharp fa-solid fa-bookmark' : 'fa-sharp fa-regular fa-bookmark'"
```

El contraste outline/fill es el que los usuarios reconocen instantáneamente (iOS, Material, GitHub, Linear). **Nunca** usar `fa-sharp-duotone` como estado activo de un toggle inline — duotone es decorativo, no comunica "estado".

**Sharp Duotone — cuándo SÍ y cuándo NO:**

✅ **SÍ funciona en:**
- Empty states grandes (`<app-empty-state>` ya lo aplica a `text-4xl`)
- Feature cards con icono hero (e.g., "Plan Premium" con shield 48px)
- Onboarding screens
- File upload drop zones (ej: `fa-cloud-arrow-up text-4xl`)

❌ **NO usar sharp-duotone en:**
- Iconos inline junto a texto en filas de listas/metadata
- Estado activo de toggles binarios (usar `fa-sharp fa-solid`)
- Cualquier icono < text-4xl (48px)
- Mezclado con sharp regular del mismo tamaño SIN diferenciación clara de rol

**Por qué importa:** la mezcla sharp/sharp-duotone inline sin propósito (estado, emphasis) crea "saltos" visuales al escanear. Tu ojo espera ritmo consistente. Cuando hay un cambio de familia debe HABER UN PORQUÉ semántico (toggle activo, hero, etc.).

### Tamaño

- Se hereda del contenedor por default.
- Para standalone usar `text-xl`, `text-2xl`, `text-4xl` (Tailwind).

### Buscar íconos

- Catálogo oficial: https://fontawesome.com/icons (filtrar por "Pro" + estilo)
- Naming convention de FA es distinta a PrimeIcons (`fa-xmark` no `fa-times`, `fa-magnifying-glass` no `fa-search`, `fa-arrows-rotate` no `fa-refresh`, `fa-gear` no `fa-cog`).

### Lo que NO hacer

- **No** usar `pi pi-*` (PrimeIcons fue removido del proyecto, ya no existe).
- **No** usar `fa-regular`, `fa-solid`, `fa-light` o `fa-duotone` SIN el prefijo `fa-sharp` o `fa-sharp-duotone`. La familia base no está cargada — solo sharp.
- **No** importar otras librerías de íconos (Heroicons, Lucide, Material Icons).
- **No** usar `fa-sharp-duotone` para iconos inline ni como estado activo de toggles. Solo a ≥text-4xl (hero icons en empty states/onboarding). Para toggles usar `fa-sharp fa-solid`.
- **No** usar `fa-brands` para iconos genéricos de UI — solo para logos de marca reales (crypto, redes sociales, plataformas).

### Otros componentes PrimeNG usados en el proyecto

Estos componentes se usan pero no tienen recetas detalladas aquí. **Consultar el MCP de PrimeNG** para su API y revisar los componentes existentes que los usan:

| Componente | Archivo de referencia | Notas |
|---|---|---|
| `p-datepicker` | overview.component | `selectionMode="range"`, `showIcon`, `appendTo="body"` |
| `p-carousel` | movies.component | Custom nav (`showNavigators=false`, `[page]` binding) |
| `p-fileupload` | cards.component | Templates `#header` y `#content` con callbacks |
| `p-metergroup` | overview.component | Template `#label` custom, `labelPosition="end"` |
| `p-autocomplete` | cards.component | `multiple`, `(completeMethod)`, `[typeahead]="false"` |
| `p-slider` | cards.component | `range`, `[min]`, `[max]` |
| `p-inputotp` | cards.component | `[length]="6"`, `[integerOnly]="true"` |
| `p-select` | cards.component | Borderless: `class="!border-0 !shadow-none"` |
| `p-radiobutton` | cards.component | `variant="filled"`, `[(ngModel)]` |
| `p-checkbox` | inbox.component | `[binary]="true"` |

### Íconos con contenedor circular

```html
<!-- Ícono con fondo (ej: crypto, indicadores) -->
<i class="fa-regular fa-bell bg-surface-950 text-surface-0 dark:bg-surface-0 dark:text-surface-950 w-7 h-7 rounded-full !flex items-center justify-center"></i>
```

### SVG inline

Cuando se necesite un SVG custom (ej: logo), usar `fill="var(--p-primary-color)"` para que respete el tema.

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
- Constantes en UPPER_SNAKE_CASE, tipadas con su interfaz: `export const ITEMS: ItemType[] = [...]`.
- Mocks en archivos separados, tipados con interfaces, datos realistas (10-15 items).
- Un export por archivo de constante/mock.

### Inicialización de datos en componentes

```typescript
// Simple/constantes → field initializers
search: string = '';  chats: ChatItem[] = CHATS;  options: string[] = ['Weekly', 'Monthly', 'Yearly'];

// Datos complejos → ngOnInit()
ngOnInit() { this.menuItems = [{ label: 'Refresh', icon: 'fa-regular fa-arrows-rotate' }]; }

// Tema → effect() como field
themeEffect = effect(() => { if (this.configService.transitionComplete()) this.initChart(); });
```

**Nunca** inicializar datos complejos en el constructor. Preferir `inject()` sobre constructor DI.

## Servicios y estado

- Servicios con `providedIn: 'root'`.
- Estado con `signal()`, derivados con `computed()`.
- Side effects con `effect()`.
- `AppConfigService` para acceso al tema/dark mode.
- No usar librerías de state management externas.

## Zoneless change detection (implicaciones para autoría)

El proyecto corre con `provideZonelessChangeDetection()` — NO hay `zone.js`. Reglas prácticas:

1. **Siempre signals para estado reactivo.** Propiedades mutables (`this.foo = ...`) no disparan CD en zoneless. Usar `signal()` / `computed()` para toda pieza de estado que afecte el template. **No negociable.**
2. **`effect()` para side effects** que reaccionan a signals (tema, route, mediaQuery). No usar lifecycle hooks para sincronizar con estado reactivo.
3. **Librerías con propiedades planas** (ej: PrimeNG 21 aplica `.p-focus` vía `this.focused = true` sin signal) pueden mostrar lag perceptible. Solución: estilizar con selectores CSS-nativos (`:focus-within`, `:has()`) que no dependen del ciclo de CD.

**Workflow ante sospecha de lag visual:** DevTools → ver si la clase esperada (`.p-focus`, `.p-highlight`) aparece sincrónicamente con el evento. Si llega tarde, cambiar a selector CSS-nativo en `styles.scss`.

Análisis root-cause detallado (Zone.js vs zoneless, latencias medidas, alternativas consideradas): **Ref: ADR-001 §5c**.

## SSR guard

El proyecto tiene `@angular/ssr`. Usar `isPlatformBrowser` antes de acceder a APIs del browser:

```typescript
platformId = inject(PLATFORM_ID);

ngOnInit() {
  if (isPlatformBrowser(this.platformId)) {
    // localStorage, document, getComputedStyle, ViewTransition API
  }
}
```

## Focus ring: `:focus-visible` vs `:focus-within` vs `:has()`

Tres selectores cubren todos los casos de focus ring. Elegir por rol del elemento, no por preferencia:

| Selector | Dispara con | Aplicar en | Caso de uso |
|---|---|---|---|
| `:focus-visible` | Teclado solamente | El elemento enfocado mismo | Buttons, links, inputs planos. Es la regla global de `styles.scss` — default para todo lo enfocable. |
| `:focus-within` | Teclado **y** clic del mouse, cualquier descendiente con foco | Elemento **wrapper** cuando el enfocable real es un hijo | `p-autocomplete[multiple]`, `p-iconfield`. CSS-nativo y sincrónico → evita lag por clases mediadas en zoneless CD. Ref: ADR-001 §5c. |
| `:has(input:focus-visible)` | Teclado solamente, via descendiente | Wrapper cuando se necesita filtro teclado-only **y** patrón wrapper | Cuando `:focus-within` sería muy amplio (también activa con clic). Requiere soporte Baseline (OK en 2026) y tiene pequeño overhead vs `:focus-within`. |

**Regla práctica:** si hay lag visible al enfocar un wrapper de PrimeNG (clase `.p-focus` no aplica a tiempo), preferir `:focus-within` en `styles.scss`. Ya aplicado a `p-autocomplete-input-multiple:focus-within` — seguir ese patrón.

## PrimeNG imports: Module vs Standalone

PrimeNG 21 tiene componentes en dos formatos. Ambos van juntos en `PRIME_MODULES`:

```typescript
const PRIME_MODULES = [
  // Modules (sufijo Module) — componentes más antiguos
  ButtonModule, AvatarModule, TableModule, InputTextModule,
  MenuModule, TooltipModule, OverlayBadgeModule, DividerModule,
  BadgeModule, ChartModule, ToggleSwitchModule, MeterGroupModule,

  // Standalone (sin sufijo) — componentes más nuevos
  SelectButton, Tag, Checkbox, IconField, InputIcon,
  Textarea, Carousel, ProgressBar, FileUpload, Select,
  AutoComplete, RadioButton, InputNumber, InputOtp, Slider,
];
```

Regla: consultar el MCP de PrimeNG para saber si un componente se importa como Module o Standalone. No mezclar — si existe `Tag` standalone, usar `Tag`, no buscar `TagModule`.

## Charts (Chart.js via PrimeNG)

```typescript
// Leer colores del tema (NUNCA hardcodear hex)
const documentStyle = getComputedStyle(document.documentElement);
const primary400 = documentStyle.getPropertyValue('--p-primary-400');

// Dataset con colores del tema
{ type: 'bar', backgroundColor: primary400, hoverBackgroundColor: primary600,
  barThickness: 32, borderRadius: { topLeft: 8, topRight: 8 }, borderSkipped: false }

// Options: legend off, grid solo Y, stacked
{ maintainAspectRatio: false, plugins: { tooltip: { enabled: false, external: fn }, legend: { display: false } },
  scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, beginAtZero: true, grid: { color: darkTheme ? surface900 : surface100 } } } }

// Reaccionar a cambios de tema
themeEffect = effect(() => { if (this.configService.transitionComplete()) this.initChart(); });
```

Reglas: colores siempre con `getPropertyValue()` | Legend custom HTML, no Chart.js built-in | Tooltip con `external` callback | Grid solo eje Y, color condicional dark mode | `barThickness: 32` | `borderRadius` solo en último dataset del stack

## Loading states: `<p-skeleton>` always

**REGLA CRITICA:** Cualquier estado de carga — placeholders de `@defer`, contenido pendiente de HTTP, listas que se rellenan async — usa `<p-skeleton>` de PrimeNG. **Nunca** divs con `animate-pulse`, spinners custom ni `bg-surface-*` sin animacion como sustituto.

**Por que:** la base del repo es enterprise-grade (cards con HTTP en cada tarjeta). Una sola convencion de loading state evita inconsistencia visual al escanear, hereda animacion `wave` del tema Aura (sin escribir keyframes), y respeta dark mode automaticamente. Patron alineado con Linear, Vercel, Stripe — un solo skeleton primitive aplicado en todos los contextos.

```html
<!-- Bloque generico (rectangulo con borde rounded-lg) -->
<p-skeleton width="100%" height="20rem" />

<!-- Avatar / dot circular -->
<p-skeleton shape="circle" size="2.5rem" />

<!-- Linea de texto compacta (con margen al siguiente bloque) -->
<p-skeleton width="60%" height="1rem" styleClass="mt-2" />

<!-- Sustituye exactamente al borde del componente real (file upload card) -->
<p-skeleton width="100%" height="10rem" borderRadius="0.5rem" />
```

**Imports:** `Skeleton` es standalone (sin sufijo Module) — agregar a `PRIME_MODULES`:
```typescript
import { Skeleton } from 'primeng/skeleton';
const PRIME_MODULES = [..., Skeleton];
```

**Dimensiones del placeholder:** medir el componente real renderizado y reproducir esas alturas/anchos. Un placeholder que cambia de tamano al hidratarse causa CLS — el objetivo es zero layout shift.

**`aria-busy="true"`** en el contenedor del placeholder. Lectores de pantalla anuncian "ocupado" sin enumerar cada skeleton individual.

## Incremental Hydration (`@defer hydrate`)

El proyecto usa `withIncrementalHydration()` (configurado en [app.config.ts](src/app/app.config.ts)). Esto activa el comportamiento de `@defer (hydrate on <trigger>)`:

| Aspecto | Sin Incremental Hydration | Con Incremental Hydration |
|---|---|---|
| SSR del bloque | Renderiza placeholder | Renderiza contenido completo |
| Bytes enviados | Solo `@placeholder` | Contenido SSR + markers `ngh=dN` |
| Hidratacion | Eager al bootstrap | Lazy hasta que dispara el trigger |
| Beneficio | Bundle inicial mas pequeno (CSR) | TTI mas rapido + main thread libre (SSR) |

**Cuando aplicar `@defer (hydrate on <trigger>)`:**

| Trigger | Cuando usar | Ejemplo |
|---|---|---|
| `viewport` | Bloque pesado (chart, carousel, file upload, panel lateral xl) | Charts de Chart.js, Carousel con muchos items |
| `interaction` | Bloque que solo importa al click/hover | Menu contextual con 50 items |
| `idle` | Bloque secundario que puede esperar a que el browser este libre | Footer, sidebar de "tambien podria interesarte" |
| `timer(Nms)` | Animacion diferida o efecto progresivo | Banner de "newsletter" 3s post-load |
| `never` | Solo SSR, nunca hidratar (estatico puro) | Footer legal, copyright |

**Cuando NO aplicar:**
- Componentes pequenos (`< 5kB` de JS) — el overhead de IO + hydration scheduling no compensa
- Bloques above-the-fold critical (header, primer card) — siempre hidratan instantly de todos modos
- Bloques con `effect()` que reaccionan a estado externo desde el primer frame (ej: theme switcher)

**Patron del repo:**
```html
@defer (hydrate on viewport) {
  <!-- contenido pesado real -->
} @placeholder {
  <div aria-busy="true">
    <p-skeleton width="100%" height="20rem" />
  </div>
}
```

El `@placeholder` es opcional pero se debe incluir siempre porque:
1. CSR fallback: si el cliente navega a la ruta sin SSR (client-side route change), el placeholder es lo que se ve hasta el trigger
2. Documentacion visual: comunica al lector la dimension/forma esperada del bloque

**Verificado en:** overview chart, movies carousel, chat right panel, cards file upload. Ref: ADR-001 §10.

## ESLint y enforcement del design system

El proyecto tiene ESLint configurado con reglas custom que **bloquean** violaciones del design system en tiempo de desarrollo.

```text
tools/eslint/
  plugin.js                           ← Entry point del plugin local
  utils.js                            ← Visitor helper (escanea class + styleClass + *StyleClass + routerLinkActive)
  rules/
    no-hardcoded-colors.js            ← Bloquea text-gray-*, bg-blue-*, text-white, bg-[#hex], etc.
    no-shadow-classes.js              ← Bloquea shadow-* y drop-shadow-* (permite !shadow-none para resets)
    no-forbidden-rounded.js           ← Solo rounded-lg a rounded-3xl + rounded-full + rounded-border
    no-inline-styles.js               ← Bloquea style="" estático
    no-forbidden-spacing.js           ← Enforces spacing scale (gap, padding, margin)
    no-missing-dark-pair.js           ← Requiere dark: counterpart para bg-surface-*
    no-forbidden-typography.js        ← Enforces text size, leading, font-weight scale
    no-forbidden-transitions.js       ← Bloquea transition-all / bare transition (política big-tech)
    hover-requires-cursor-pointer.js  ← hover:* ↔ cursor-pointer deben ir en pareja
    no-icon-button-without-tooltip.js ← Icon-only <p-button> requiere pTooltip
    no-deprecated-styleclass.js       ← `styleClass` deprecated en PrimeNG v20 — usar `class`
  rules/__tests__/                    ← node:test suites por regla (RuleTester + invariantes del set)
```

### Comandos del proyecto

| Comando | Qué hace | Cuándo correrlo |
|---|---|---|
| `npm run lint` | `ng lint` (HTML+TS rules) **+ chained** `lint:rules:test` (10 RuleTester suites + drift detection vs PrimeNG type defs) | Antes de cada commit |
| `npm run lint:fix` | Igual que `lint` con autofix donde aplique | Para limpiar warnings mecánicas |
| `npm run lint:rules:test` | Solo los tests del plugin local (útil al editar reglas) | Al modificar `tools/eslint/rules/*` |
| `npm test` | `ng test` → vitest sobre `src/**/*.spec.ts` | Después de cambios en componentes/servicios |
| `npm run build` | Build de producción, valida budgets (`750 kB warn` / `1 MB error`) | Antes de PR |
| `npm run test:ssr:smoke` | 4 cookie cases del dark-mode SSR (necesita `serve:ssr:prime-showcase` corriendo en `:4000`) | Después de cambios en SSR/theme/cookie |
| `npm run verify` | `lint && build && (server + smoke)` end-to-end con server orchestration | **Antes de pushear** — paridad exacta con CI |

CI (`.github/workflows/ci.yml`) corre el equivalente de `verify` en cada push a main y cada PR.

### Reglas custom (severity: error)

| Regla | Qué bloquea | Qué permite |
|---|---|---|
| `showcase/no-hardcoded-colors` | `text-gray-*`, `bg-blue-*`, `text-white`, `bg-black`, `bg-[#hex]`, `bg-[rgb(...)]` | Design tokens (`text-color`, `bg-surface-*`, `bg-primary`), excepciones semánticas (`bg-violet-100`, `border-black/10`) |
| `showcase/no-shadow-classes` | `shadow-*`, `drop-shadow-*` | `shadow-none`, `!shadow-none` (resets de PrimeNG) |
| `showcase/no-forbidden-rounded` | `rounded`, `rounded-sm`, `rounded-md`, `rounded-none`, `rounded-[*]` | `rounded-lg`, `rounded-xl`, `rounded-2xl`, `rounded-3xl`, `rounded-full`, `rounded-border`, directional variants (`rounded-t-lg`) |
| `showcase/no-inline-styles` | `style="..."` estático | `[style.*]="expr"` y `[ngStyle]` para valores dinámicos |
| `showcase/no-forbidden-spacing` | `gap-9`, `p-8`, `m-3`, `m-5`, `gap-[13px]`, etc. | Escala aprobada (gap 1-6,8 / p 1-4,6 / m 0,1,2,4,6) + excepciones documentadas |
| `showcase/no-missing-dark-pair` | `bg-surface-100` sin `dark:bg-surface-800` | Pares completos, shades oscuros sin par (900, 950) |
| `showcase/no-forbidden-typography` | `text-4xl+`, `leading-snug`, `leading-relaxed`, `font-bold`, `font-black`, `text-[18px]` | Escala aprobada (text-xs a text-3xl, leading-4 a leading-8, font-normal/medium/semibold) + `text-4xl` para iconos/stats |
| `showcase/no-forbidden-transitions` | `transition-all`, bare `transition`, `transition-[all]` arbitrary values | `transition-colors`, `transition-opacity`, `transition-transform`, `transition-none`, `transition-shadow`, `transition-[transform]` |
| `showcase/hover-requires-cursor-pointer` | Elementos con `hover:*` pero sin `cursor-pointer`, o viceversa (plain HTML, `<div>`, `<button>` sin pButton) | Mismo elemento con el par correspondiente; `group-hover:*` y `peer-hover:*` NO se flaggean; `<p-*>` y `[pButton]` están exentos |
| `showcase/no-icon-button-without-tooltip` | `<p-button [icon]="..." aria-label="..."/>` sin `pTooltip` (icon-only buttons sin hint en hover) | Botones con `label` visible, o con `pTooltip` |
| `showcase/no-deprecated-styleclass` | `styleClass` / `[styleClass]` en componentes PrimeNG v20 que deprecaron el atributo (53 selectores: p-tag, p-avatar, p-table, p-skeleton, etc.) | `class=`, `[class]=`, `[ngClass]=`. Sub-element variants (`paginatorStyleClass`, `valueStyleClass`, etc.) y overlays (`p-drawer`, `p-dialog`, `p-popover`, `p-tooltip`, `p-menu`, `p-button`) no se flaggean. Set sincronizado automáticamente con PrimeNG type defs vía drift-test. |

### Reglas built-in habilitadas

| Regla | Severity | Qué previene |
|---|---|---|
| `@angular-eslint/prefer-on-push-component-change-detection` | error | Componentes sin OnPush |
| `@angular-eslint/template/prefer-control-flow` | error | `*ngIf`, `*ngFor` legacy |
| `@angular-eslint/component-selector` | error | Selectores sin prefijo `app-` |

### Scope de las reglas custom

Las reglas escanean atributos estáticos y dinámicos:

**Estáticos** (string plano en el atributo):
- `class="..."` — HTML estándar
- `styleClass="..."` — Componentes PrimeNG
- `paginatorStyleClass`, `valueStyleClass`, `panelStyleClass`, `contentStyleClass`, `headerStyleClass`, `footerStyleClass`, `inputStyleClass`, `labelStyleClass` — Variantes de PrimeNG
- `routerLinkActive="..."` — Clases aplicadas al elemento en estado activo (escaneadas con la misma política que `class`)

**Dinámicos** (expresiones Angular — se camina el AST para extraer string literals):
- `[ngClass]="{ 'class': cond }"` — Object literal keys
- `[ngClass]="cond ? 'class-a' : 'class-b'"` — Ternary branches
- `[class]="'class-a'"` — String literals
- `[styleClass]="expr"`, `[*StyleClass]="expr"` — Mismas reglas que [ngClass]/[class]

**No escanean** (limitación inherente al análisis estático): expresiones que construyen clases via variables o funciones (`[ngClass]="myVar"`, `[class]="getClass()"`). Estas son imposibles de resolver en lint — se validan por code review.

### Agregar nuevas reglas

1. Crear el archivo en `tools/eslint/rules/nombre-regla.js`
2. Usar `createClassAttrVisitor` de `tools/eslint/utils.js` para escanear clases
3. Registrar en `tools/eslint/plugin.js`
4. Habilitar en `eslint.config.js` bajo el bloque `**/*.html`

## Lo que NO hacer

### Estilos
- No usar colores de Tailwind genéricos (`text-gray-*`, `bg-blue-*`, `text-slate-*`). Usar design tokens.
- No usar valores hex/rgb hardcodeados (`#fff`, `rgb(0,0,0)`) excepto datos con significado fijo (colores de gráficos de datos).
- No usar `shadow-*`. Usar `border border-surface` para elevación.
- No usar valores de spacing fuera de la escala definida arriba.
- No usar `rounded-sm`, `rounded-md`, `rounded-none` ni valores arbitrarios de border-radius.
- No escribir CSS/SCSS en archivos de componente. Todo con Tailwind en el template.
- No usar `::ng-deep`. Si PrimeNG no expone la API de estilo, usar `styleClass` o design tokens.
- No usar `style=""` inline. Para valores dinámicos de datos usar `[style.backgroundColor]="item.color"` o `[ngStyle]="{ backgroundColor: val.color }"`.
- No inventar combinaciones de tipografía fuera de las recetas definidas.
- No usar `bg-surface-*` sin su par `dark:bg-surface-*`.

**Excepción documentada:** `shadow-[...]` aplicado en runtime vía `classList.add()` sobre el tooltip custom de Chart.js (`src/app/modules/overview/overview.component.ts:191`). Chart.js dibuja el tooltip fuera del árbol de componentes Angular, por lo que no hereda el vocabulario de design tokens del preset y el elevation no se puede expresar con `border border-surface` (rompería el layout del tooltip). Es la única excepción aprobada — agregar otra requiere justificación en code review. ESLint no la detecta porque vive en una string concatenada en TS, fuera del scope del visitor HTML.

### Componentes
- No crear componentes custom si PrimeNG ya tiene uno equivalente.
- No crear abstracciones prematuras o wrappers innecesarios sobre componentes PrimeNG.
- No usar `<button>` sin `pButton` para **botones de acción** (submit, cancel, download, etc.). Excepciones: nav items y list items interactivos que usan clases Tailwind propias (ver sección "Elementos interactivos").
- No usar tablas HTML. Siempre `<p-table>`.
- No usar `*ngIf`, `*ngFor` u otras directivas estructurales legacy. Usar `@if`, `@for`.
- No usar `@else` — preferir bloques `@if` separados (patrón del proyecto).

### Arquitectura
- No crear NgModules. Todo standalone.
- No usar `Default` change detection. Siempre `OnPush`.
- No agregar dependencias nuevas sin justificación (no Material, Bootstrap, Heroicons, etc).
- No inicializar datos complejos en el constructor. Usar `ngOnInit()` o field initializers.
- No usar constructor para DI. Preferir `inject()`.
- No crear servicios con estado que deberían ser signals en el componente.
- No usar RxJS para estado de UI local. Preferir signals.
- No usar pipes en templates (`| date`, `| number`). Formatear datos en el componente (.ts).

### Charts
- No usar colores hex en datasets de charts. Siempre CSS variables del tema.
- No usar la legend built-in de Chart.js. Crear legend custom con HTML.
