# PrimeNG Showcase - Guia de Estilo para Claude

## Stack

- Angular 19 (standalone components, signals, new control flow)
- PrimeNG 19 con tema Aura (`@primeng/themes`)
- Tailwind CSS 4 con plugin `tailwindcss-primeui`
- PrimeIcons 7
- SCSS (archivos presentes por convención pero vacíos — todo el estilizado se hace con Tailwind)
- TypeScript strict mode

## MCP: PrimeNG (`@primeng/mcp`)

Este proyecto tiene configurado el MCP oficial de PrimeNG (`.mcp.json`). **Usarlo siempre** antes de implementar o recomendar un componente PrimeNG para:
- Verificar que el componente existe y su API actual (props, eventos, slots).
- Consultar ejemplos de uso y opciones de theming.
- Buscar el componente correcto por funcionalidad si no se conoce el nombre exacto.

No asumir la API de componentes PrimeNG de memoria. Consultar el MCP para obtener la API real y actualizada.

## Regla principal: Consistencia con lo existente

Antes de implementar cualquier feature, revisar los componentes existentes en `src/app/modules/` para replicar sus patrones exactos. No inventar nuevos patrones. Si hay duda entre dos formas de hacer algo, elegir la que ya existe en el código.

## Componentes: Siempre PrimeNG primero

- **SIEMPRE** usar componentes nativos de PrimeNG antes de crear componentes custom.
- Botones: `<p-button>`, nunca `<button>` sin directiva pButton.
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

```typescript
// Página estándar con scroll y borde
host: { class: 'flex-1 h-full overflow-y-auto overflow-x-clip overflow-hidden border border-surface rounded-2xl p-6' }

// Página con layout flex interno (ej: chat, inbox con paneles)
host: { class: 'flex-1 h-full overflow-y-auto overflow-x-clip overflow-hidden flex border border-surface rounded-2xl' }

// Página sin borde propio (ej: overview que maneja su propio scroll)
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

@if (isVisible) {
  <p-dialog header="Title" [(visible)]="isVisible">...</p-dialog>
}
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
GAP (entre elementos flex/grid):
  gap-1  (4px)   → Elementos muy compactos
  gap-2  (8px)   → Separación estándar entre elementos inline ← MÁS USADO
  gap-3  (12px)  → Separación media
  gap-4  (16px)  → Grupos de elementos
  gap-5  (20px)  → Entre secciones menores
  gap-6  (24px)  → Entre secciones/cards ← SEGUNDO MÁS USADO
  gap-8  (32px)  → Solo separaciones muy grandes

PADDING (dentro de contenedores):
  p-1            → Padding mínimo
  p-2            → Padding compacto ← MÁS USADO (default general)
  p-3            → Padding small-medium
  p-4            → Padding medio
  p-6            → Padding de contenido de card ← ESTÁNDAR PARA CARDS
  px-4 py-1      → Padding de botones
  px-7 py-5      → Padding expandido (cards con cabecera)

MARGIN (separación entre bloques):
  mt-1           → Espacio sutil entre líneas de texto
  mt-2 / mb-2    → Espacio pequeño entre bloques
  mt-4 / mb-4    → Espacio entre secciones
  mt-6 / mb-6    → Espacio grande entre secciones principales
  mb-0           → Reset de margin default

NO USAR: gap-7, gap-9, gap-10, gap-12, p-5, p-7, p-8, m-3, m-5
ni spacing arbitrario como gap-[13px]. Elegir el valor más cercano de la escala.
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
TÍTULOS DE PÁGINA
  class="text-2xl font-medium text-color leading-8"     → Título de sección
  class="text-3xl font-semibold text-color leading-normal" → Título principal

SUBTÍTULOS
  class="text-muted-color font-medium leading-normal"   → Subtítulo de página
  class="text-color font-semibold leading-6"             → Título de card/sección

TEXTO BODY
  class="text-color leading-6"                           → Texto principal
  class="text-color font-medium leading-6"               → Texto con énfasis
  class="text-sm text-color leading-5"                   → Texto compacto

TEXTO SECUNDARIO
  class="text-muted-color leading-6"                     → Metadata, descripciones
  class="text-sm text-muted-color leading-5"             → Labels, texto auxiliar

TEXTO PEQUEÑO
  class="text-xs font-medium"                            → Badges, contadores

REGLA DE PESO: font-medium es el default (90% de los textos).
font-semibold solo para títulos de card/sección. font-normal casi nunca.
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
<!-- Card con formulario -->
<div class="border border-surface rounded-3xl p-6 flex flex-col gap-6">
  <!-- Campo: label encima del input -->
  <div>
    <label class="text-color font-medium leading-6" for="field-id">Label</label>
    <input pInputText id="field-id" class="mt-2 w-full" />
  </div>

  <!-- Toggle row (icon + label + switch) -->
  <div class="flex items-center gap-3">
    <i class="pi pi-bell text-color text-xl"></i>
    <div class="leading-6 text-color flex-1">Label</div>
    <p-toggleswitch [(ngModel)]="value" />
  </div>

  <!-- Botones de acción al fondo -->
  <div class="flex items-center gap-2">
    <button pButton label="Cancel" outlined class="flex-1"></button>
    <button pButton label="Submit" class="flex-1"></button>
  </div>
</div>

<!-- Cards se envuelven con flex-wrap -->
<div class="flex flex-wrap items-start gap-6">
  <div class="flex-1 flex flex-col gap-6">
    <!-- Columna de cards -->
  </div>
  <div class="flex-1 flex flex-col gap-6">
    <!-- Otra columna de cards -->
  </div>
</div>
```

Reglas de formularios:
- Label encima del input con `mt-2` de separación.
- Cards de formulario usan `rounded-3xl` (más grande que cards de datos que usan `rounded-2xl`).
- `p-divider` para separar secciones dentro de una card.
- Botones de acción siempre al final, `flex-1` para ancho igual.

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
<!-- Botón con ícono only (77% de los botones del proyecto) -->
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

### Campos de formulario

```html
<!-- Búsqueda con ícono -->
<p-iconfield iconPosition="left">
  <p-inputicon class="pi pi-search"></p-inputicon>
  <input type="text" pInputText placeholder="Search" />
</p-iconfield>
```

### styleClass — patrones permitidos

Usar `styleClass` en componentes PrimeNG para ajustes de layout, no para colores custom:
```
styleClass="w-full"                          → Full width
styleClass="w-fit"                           → Fit content
styleClass="font-medium"                     → Peso de fuente
styleClass="!min-w-0 !w-2.5 !h-2.5"         → Override con ! (badges pequeños)
styleClass="!bg-transparent"                 → Fondo transparente (paginador)
styleClass="flex-1 w-full"                   → Textarea expandible
```

---

## Iconos

- Usar PrimeIcons: `class="pi pi-search"`, `icon="pi pi-download"`.
- Tamaño de íconos: se hereda del contenedor. Para standalone usar `text-xl`, `text-2xl`.
- Consultar el MCP de PrimeNG o https://primeng.org/icons para íconos disponibles.
- **No** agregar Font Awesome, Heroicons, ni otras librerías de íconos.

### Íconos con contenedor circular

```html
<!-- Ícono con fondo (ej: crypto, indicadores) -->
<i class="pi pi-ethereum bg-surface-950 text-surface-0 dark:bg-surface-0 dark:text-surface-950 w-7 h-7 rounded-full !flex items-center justify-center"></i>
```

### SVG inline

Cuando se necesite un SVG custom (ej: logo), usar `fill="var(--p-primary-color)"` para que respete el tema.

## Routing

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
// Datos simples y de constantes → field initializers
search: string = '';
activeChat: string = 'PrimeTek Team';
chats: ChatItem[] = CHATS;
options: string[] = ['Weekly', 'Monthly', 'Yearly'];
tableTokens = { header: { background: 'transparent' }, ... };

// Datos complejos o computados → ngOnInit()
ngOnInit() {
  this.menuItems = [{ label: 'Refresh', icon: 'pi pi-refresh' }];
  this.tableData = [ /* objetos complejos */ ];
}

// Reacción a cambios de tema → effect() como field
themeEffect = effect(() => {
  if (this.configService.transitionComplete()) {
    this.initChart();
  }
});
```

**Nunca** inicializar datos complejos en el constructor. Constructor solo para DI legacy (preferir `inject()`).

## Servicios y estado

- Servicios con `providedIn: 'root'`.
- Estado con `signal()`, derivados con `computed()`.
- Side effects con `effect()`.
- `AppConfigService` para acceso al tema/dark mode.
- No usar librerías de state management externas.

## PrimeNG imports: Module vs Standalone

PrimeNG 19 tiene componentes en dos formatos. Ambos van juntos en `PRIME_MODULES`:

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
// 1. Leer colores del tema (SIEMPRE desde CSS variables, nunca hardcoded)
const documentStyle = getComputedStyle(document.documentElement);
const primary400 = documentStyle.getPropertyValue('--p-primary-400');
const surface100 = documentStyle.getPropertyValue('--p-surface-100');
const surface900 = documentStyle.getPropertyValue('--p-surface-900');

// 2. Chart data — barras apiladas con colores del tema
chartData = {
  labels: [...],
  datasets: [{
    type: 'bar',
    label: 'Dataset 1',
    backgroundColor: primary400,
    hoverBackgroundColor: primary600,
    data: [...],
    barThickness: 32,
    borderRadius: { topLeft: 8, topRight: 8 }, // solo último dataset
    borderSkipped: false,                       // solo último dataset
  }]
};

// 3. Chart options — legend off, grid solo en Y, stacked
chartOptions = {
  maintainAspectRatio: false,
  plugins: {
    tooltip: { enabled: false, external: customTooltipFn },
    legend: { display: false },
  },
  scales: {
    x: { stacked: true, grid: { display: false }, border: { display: false } },
    y: {
      stacked: true, beginAtZero: true,
      grid: { color: darkTheme ? surface900 : surface100 },
      border: { display: false },
    },
  },
};

// 4. Reaccionar a cambios de tema
themeEffect = effect(() => {
  if (this.configService.transitionComplete()) {
    this.initChart(); // re-leer CSS vars y reconstruir data/options
  }
});
```

Reglas de charts:
- **Nunca** colores hex en datasets. Siempre `getPropertyValue('--p-primary-*')`.
- Legend custom con HTML, no la built-in de Chart.js.
- Tooltip custom con `external` callback usando clases Tailwind.
- Grid solo en eje Y, color condicional por dark mode.
- `barThickness: 32` consistente. `borderRadius` solo en el último dataset del stack.

## Lo que NO hacer

### Estilos
- No usar colores de Tailwind genéricos (`text-gray-*`, `bg-blue-*`, `text-slate-*`). Usar design tokens.
- No usar valores hex/rgb hardcodeados (`#fff`, `rgb(0,0,0)`) excepto datos con significado fijo (colores de gráficos de datos).
- No usar `shadow-*`. Usar `border border-surface` para elevación.
- No usar valores de spacing fuera de la escala definida.
- No usar `rounded-sm`, `rounded-md`, `rounded-none` ni valores arbitrarios de border-radius.
- No escribir CSS/SCSS en archivos de componente. Todo con Tailwind en el template.
- No usar `::ng-deep`. Si PrimeNG no expone la API de estilo, usar `styleClass` o design tokens.
- No usar `style=""` inline excepto para valores dinámicos que vienen de datos.
- No crear archivos de estilos globales adicionales. Todo pasa por `styles.scss` + Tailwind.
- No inventar combinaciones de tipografía fuera de las recetas definidas.
- No usar `bg-surface-*` sin su par `dark:bg-surface-*`.

### Componentes
- No crear componentes custom si PrimeNG ya tiene uno equivalente.
- No crear abstracciones prematuras o wrappers innecesarios sobre componentes PrimeNG.
- No usar `<button>` sin `pButton` o `<p-button>`.
- No usar tablas HTML. Siempre `<p-table>`.
- No usar `*ngIf`, `*ngFor` u otras directivas estructurales legacy. Usar `@if`, `@for`.

### Arquitectura
- No crear NgModules. Todo standalone.
- No usar `Default` change detection. Siempre `OnPush`.
- No agregar dependencias nuevas sin justificación (no Material, Bootstrap, Heroicons, etc).
- No inicializar datos complejos en el constructor. Usar `ngOnInit()` o field initializers.
- No usar constructor para DI. Preferir `inject()`.
- No crear servicios con estado que deberían ser signals en el componente.
- No usar RxJS para estado de UI local. Preferir signals.

### Charts
- No usar colores hex en datasets de charts. Siempre CSS variables del tema.
- No usar la legend built-in de Chart.js. Crear legend custom con HTML.
