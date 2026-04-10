# PrimeNG Showcase - Guia de Estilo para Claude

## Stack

- Angular 21 (standalone components, signals, new control flow)
- PrimeNG 21 con tema Aura (`@primeuix/themes`)
- Tailwind CSS 4 con plugin `tailwindcss-primeui`
- PrimeIcons 7
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

```
TEXTO
  text-color                          → Texto principal (body, títulos)
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

SURFACE INTERMEDIOS (solo para detalles finos, no para layout principal)
  text-surface-400 / text-surface-500   → Ticks de charts, texto muy sutil
  text-surface-600 dark:text-surface-400 → Texto de empresas/logos
  fill-surface-600 dark:fill-surface-400 → Fill de SVGs inline

EXCEPCIONES PERMITIDAS
  Colores con nombre solo para indicadores semánticos con significado fijo:
  - bg-violet-100, text-violet-950    → Iniciales de avatar (fallback sin imagen)
  - bg-orange-100, text-orange-950    → Iniciales de avatar
  - text-yellow-500                   → Iconos de criptomoneda (BTC)
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

### Escala de spacing — valores permitidos

```
GAP:     gap-1 | gap-2 ← DEFAULT | gap-3 | gap-4 | gap-5 | gap-6 ← CARDS/SECCIONES | gap-8
PADDING: p-1 | p-2 ← DEFAULT | p-3 | p-4 | p-6 ← CARDS | px-4 py-1 (botones) | px-7 py-5 (cabecera)
MARGIN:  mt-1 (sutil) | mt-2/mb-2 | mt-4/mb-4 (secciones) | mt-6/mb-6 (grandes) | mb-0 (reset)
FLEX:    grow (expandir) | shrink-0 (nunca encoger, ej: avatares en flex) | flex-1 (crecer+encoger)

NO USAR: gap-7,9,10,12 | p-5,7,8 | m-3,5 | valores arbitrarios como gap-[13px]
```

### Escala de border-radius

```
rounded-full    → Círculos: avatares, indicadores de estado, dots
rounded-lg      → Elementos pequeños: botones, inputs, badges, avatares con imagen
rounded-xl      → Contenedores medianos
rounded-2xl     → Cards estándar ← MÁS USADO PARA CARDS
rounded-3xl     → Cards grandes o secciones principales

NO USAR: rounded, rounded-sm, rounded-md, rounded-none ni rounded-[value].
```

### Escala de tipografía

Combinaciones fijas — usar exactamente estas, no mezclar libremente:

```
TÍTULOS:    text-2xl font-medium leading-8 (sección) | text-3xl font-semibold leading-normal (principal)
SUBTÍTULOS: text-muted-color font-medium leading-normal ← SUBTÍTULO DE PÁGINA | text-color font-semibold leading-6 ← TÍTULO DE CARD
BODY:       text-color leading-6 (base) | + font-medium (énfasis) | text-sm leading-5 (compacto)
SECUNDARIO: text-muted-color leading-6 (metadata) | text-sm text-muted-color leading-5 (labels)
PEQUEÑO:    text-xs font-medium (badges, contadores)

PESO: font-medium = default (90%) | font-semibold = solo títulos card/sección | font-normal = casi nunca
```

### Sombras

```
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
class="hover:bg-emphasis cursor-pointer transition-all"

<!-- Active (click/pressed) -->
class="active:bg-surface-200 dark:active:bg-surface-700"

<!-- Hover en texto -->
class="hover:text-muted-color-emphasis"

<!-- Hover con opacidad (links, iconos) -->
class="hover:opacity-70"

<!-- Elemento activo/seleccionado (nav, tabs) -->
class="text-color bg-emphasis"           → Activo
class="text-muted-color bg-transparent"  → Inactivo
```

Transiciones: usar `transition-all` para elementos interactivos, `transition-colors` para cambios solo de color. **No agregar animaciones** más allá de transitions.

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
  class="px-4 py-1 flex items-center gap-1 cursor-pointer text-base rounded-lg transition-all select-none"
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
  class="px-4 py-2 rounded-lg flex items-center gap-2 cursor-pointer hover:bg-emphasis transition-all"
>
  <i [class]="nav.icon"></i>
  <span class="font-medium">{{ nav.name }}</span>
</button>

<!-- 3. List item clickeable (chat list) — hover only, activo sutil -->
<div
  (click)="select(item)"
  [ngClass]="{ 'bg-emphasis': item.id === activeId() }"
  class="flex items-center gap-2 p-4 cursor-pointer hover:bg-emphasis transition-all"
>
  <!-- contenido -->
</div>

<!-- 4. Card/item clickeable (carousel, grid) — solo hover -->
<div class="p-2 rounded-xl hover:bg-emphasis transition-colors cursor-pointer">
  <!-- contenido -->
</div>

<!-- 5. Menu item en card (lista de acciones sin pButton) -->
<button
  class="w-full flex items-center gap-2 text-color p-2 bg-transparent hover:bg-emphasis active:bg-surface-200 dark:active:bg-surface-700 cursor-pointer rounded-lg transition-all select-none"
>
  <i class="pi pi-refresh"></i>
  <span>Refresh</span>
</button>

<!-- 6. CTA card item (botón llamativo dentro de card, sin pButton) -->
<button
  class="p-4 rounded-3xl w-full bg-emphasis transition-all text-color hover:text-color-emphasis flex items-center gap-2 justify-between cursor-pointer"
>
  <div class="flex items-center"><!-- avatares, iconos --></div>
  <div class="flex items-center gap-2">
    <span class="font-medium leading-6">12 Postulantes</span>
    <i class="pi pi-arrow-right"></i>
  </div>
</button>
```

Clases base compartidas: `cursor-pointer hover:bg-emphasis transition-all rounded-lg`

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
      <p-inputicon class="pi pi-search"></p-inputicon>
      <input type="text" pInputText placeholder="Search" />
    </p-iconfield>
    <p-button severity="secondary" outlined>
      <i class="pi pi-bell"></i>
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
<div class="flex items-center gap-2 p-4 cursor-pointer hover:bg-emphasis transition-all">
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
<div class="px-4 py-2 rounded-lg flex items-center gap-2 cursor-pointer hover:bg-emphasis transition-all">
  <i class="pi pi-inbox"></i>
  <span class="font-medium">Label</span>
</div>

<!-- Patrón de settings row (icon + label + toggle) -->
<div class="flex items-center gap-2">
  <i class="pi pi-bell text-color"></i>
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
<div class="w-4/12 xl:w-3/12 min-w-40 overflow-auto flex flex-col">
  <!-- Panel izquierdo: lista -->
</div>
<div class="w-8/12 xl:w-6/12 border-x border-surface flex flex-col">
  <!-- Panel central: contenido principal -->
</div>
<div class="w-3/12 xl:block hidden min-w-40 overflow-auto">
  <!-- Panel derecho: info (oculto bajo xl) -->
</div>

<!-- 2 paneles (ej: inbox) — host: flex gap-4 -->
<div class="w-64 h-full border border-surface rounded-2xl flex flex-col">
  <!-- Sidebar fijo -->
</div>
<div class="flex-1 h-full border border-surface rounded-2xl">
  <!-- Contenido principal -->
</div>
```

Reglas multi-panel:
- Paneles se separan con `border-x border-surface` (adyacentes) o `gap-4` + bordes propios (separados).
- Paneles ocultos en mobile usan `xl:block hidden`.
- Cada panel scrollea independientemente con `overflow-auto`.
- Anchos con fracciones: `w-4/12`, `w-8/12`, `w-3/12`. Fijos: `w-64`, `w-72`.

### Formularios dentro de cards

```html
<div class="border border-surface rounded-3xl p-6 flex flex-col gap-6">
  <div>
    <label class="text-color font-medium leading-6" for="id">Label</label>
    <input pInputText id="id" class="mt-2 w-full" />
  </div>
  <div class="flex items-center gap-3">
    <i class="pi pi-bell text-color text-xl"></i>
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

<!-- Avatar fallback (sin imagen → iniciales) -->
[ngClass]="{
  '!bg-primary-100 !text-primary-950': !item.image
}"
<!-- Variantes de color: bg-violet-100/text-violet-950, bg-orange-100/text-orange-950 -->

<!-- Mensaje enviado vs recibido (chat) -->
[ngClass]="{
  'ml-auto flex-row-reverse': message.type === 'sent'
}"
<!-- Bubble: bg-primary para enviados, bg-surface-100 dark:bg-surface-800 para recibidos -->
<!-- Texto: text-primary-contrast para enviados, text-color para recibidos -->

<!-- Toggle de ícono (bookmark, dark mode) -->
[ngClass]="value ? 'pi pi-bookmark-fill' : 'pi pi-bookmark'"

<!-- Visibilidad condicional (slim menu) -->
[class]="isHidden ? 'hidden' : 'font-medium leading-none'"
```

---

## Patrones de componentes PrimeNG

### Botones — variantes y cuándo usarlas

```html
<!-- Botón con ícono only — para acciones secundarias en headers/toolbars -->
<p-button icon="pi pi-ellipsis-h" text rounded />

<!-- Botón secundario outlined (acciones secundarias) -->
<p-button severity="secondary" outlined />

<!-- Botón primario (acción principal) -->
<p-button label="Download" icon="pi pi-download" iconPos="right" />

<!-- Botón full-width -->
<p-button label="Show All" outlined styleClass="w-full" />
```

Reglas de severity:
- `severity="secondary"` → default para la mayoría de botones
- Sin severity (default/primary) → acción principal destacada
- `severity="danger"` → acciones destructivas
- `severity="contrast"` → alto contraste visual
- `severity="success"` / `"warn"` → rara vez, solo donde el significado semántico lo requiere

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
<p-button icon="pi pi-ellipsis-h" severity="secondary" text
  (click)="menu.toggle($event)" />
<p-menu #menu [model]="menuItems" [popup]="true" />

<!-- En el .ts -->
menuItems: MenuItem[] = [
  { label: 'Refresh', icon: 'pi pi-refresh' },
  { label: 'Export', icon: 'pi pi-upload' },
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
  class="px-4 py-1 flex items-center gap-1 cursor-pointer text-base rounded-lg transition-all select-none"
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
  icon="pi pi-search" rounded outlined severity="secondary" />

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
  <p-inputicon class="pi pi-search"></p-inputicon>
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
```
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

- Usar PrimeIcons: `class="pi pi-search"`, `icon="pi pi-download"`.
- Tamaño de íconos: se hereda del contenedor. Para standalone usar `text-xl`, `text-2xl`.
- Consultar el MCP de PrimeNG o https://primeng.org/icons para íconos disponibles.
- **No** agregar Font Awesome, Heroicons, ni otras librerías de íconos.

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
<i class="pi pi-ethereum bg-surface-950 text-surface-0 dark:bg-surface-0 dark:text-surface-950 w-7 h-7 rounded-full !flex items-center justify-center"></i>
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
ngOnInit() { this.menuItems = [{ label: 'Refresh', icon: 'pi pi-refresh' }]; }

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

### SSR guard

El proyecto tiene `@angular/ssr`. Usar `isPlatformBrowser` antes de acceder a APIs del browser:

```typescript
platformId = inject(PLATFORM_ID);

ngOnInit() {
  if (isPlatformBrowser(this.platformId)) {
    // localStorage, document, getComputedStyle, ViewTransition API
  }
}
```

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

## ESLint y enforcement del design system

El proyecto tiene ESLint configurado con reglas custom que **bloquean** violaciones del design system en tiempo de desarrollo.

```
tools/eslint/
  plugin.js                         ← Entry point del plugin local
  utils.js                          ← Visitor helper (escanea class + styleClass + *StyleClass)
  rules/
    no-hardcoded-colors.js          ← Bloquea text-gray-*, bg-blue-*, text-white, bg-[#hex], etc.
    no-shadow-classes.js            ← Bloquea shadow-* y drop-shadow-* (permite !shadow-none para resets)
    no-forbidden-rounded.js         ← Solo rounded-lg a rounded-3xl + rounded-full + rounded-border
    no-inline-styles.js             ← Bloquea style="" estático
```

Comandos: `npm run lint` | `npm run lint:fix`

### Reglas custom (severity: error)

| Regla | Qué bloquea | Qué permite |
|---|---|---|
| `showcase/no-hardcoded-colors` | `text-gray-*`, `bg-blue-*`, `text-white`, `bg-black`, `bg-[#hex]`, `bg-[rgb(...)]` | Design tokens (`text-color`, `bg-surface-*`, `bg-primary`), excepciones semánticas (`bg-violet-100`, `border-black/10`) |
| `showcase/no-shadow-classes` | `shadow-*`, `drop-shadow-*` | `shadow-none`, `!shadow-none` (resets de PrimeNG) |
| `showcase/no-forbidden-rounded` | `rounded`, `rounded-sm`, `rounded-md`, `rounded-none`, `rounded-[*]` | `rounded-lg`, `rounded-xl`, `rounded-2xl`, `rounded-3xl`, `rounded-full`, `rounded-border`, directional variants (`rounded-t-lg`) |
| `showcase/no-inline-styles` | `style="..."` estático | `[style.*]="expr"` y `[ngStyle]` para valores dinámicos |

### Reglas built-in habilitadas

| Regla | Severity | Qué previene |
|---|---|---|
| `@angular-eslint/prefer-on-push-component-change-detection` | error | Componentes sin OnPush |
| `@angular-eslint/template/prefer-control-flow` | error | `*ngIf`, `*ngFor` legacy |
| `@angular-eslint/component-selector` | error | Selectores sin prefijo `app-` |

### Scope de las reglas custom

Las reglas escanean atributos estáticos:
- `class="..."` — HTML estándar
- `styleClass="..."` — Componentes PrimeNG
- `paginatorStyleClass`, `valueStyleClass`, `panelStyleClass`, `contentStyleClass`, `headerStyleClass`, `footerStyleClass`, `inputStyleClass`, `labelStyleClass` — Variantes de PrimeNG

**No escanean** (limitación conocida): `[ngClass]`, `[class]`, bindings dinámicos. Estos se validan por code review y el CLAUDE.md.

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
