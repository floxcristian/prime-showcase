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

### Tablas

```typescript
// Tokens de tabla — fondo transparente siempre
tableTokens = {
  header: { background: 'transparent' },
  headerCell: { background: 'transparent' },
  row: { background: 'transparent' },
};
```

```html
<p-table
  [value]="data"
  [dt]="tableTokens"
  [scrollable]="true"
  scrollHeight="flex"
  [tableStyle]="{ 'min-width': '50rem' }"
>
  <!-- Anchos de columna con fracciones -->
  <th class="w-1/6">Columna</th>
  <th class="w-1/4">Otra</th>
</p-table>
```

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

- Interfaces en archivos `.interface.ts`.
- Constantes en UPPER_SNAKE_CASE en archivos separados.
- Mocks en archivos separados, importados como const.

## Servicios y estado

- Servicios con `providedIn: 'root'`.
- Estado con `signal()`, derivados con `computed()`.
- Side effects con `effect()`.
- `AppConfigService` para acceso al tema/dark mode.
- No usar librerías de state management externas.

## Charts (Chart.js via PrimeNG)

- Colores siempre desde CSS variables: `getComputedStyle(document.documentElement).getPropertyValue('--p-primary-400')`.
- Reaccionar a cambios de tema con `effect()` para reinicializar charts.
- Tooltips custom: usar `external` callback con clases Tailwind + tokens (ver overview.component.ts).
- Fondos de chart transparentes, grids con `--p-surface-100` / `--p-surface-900`.

## Lo que NO hacer

- No crear componentes custom si PrimeNG ya tiene uno equivalente.
- No usar colores de Tailwind genéricos (`text-gray-*`, `bg-blue-*`, `text-slate-*`). Usar design tokens.
- No usar valores hex/rgb hardcodeados (`#fff`, `rgb(0,0,0)`) excepto datos con significado fijo (colores de gráficos de datos).
- No usar `*ngIf`, `*ngFor` u otras directivas estructurales legacy.
- No crear NgModules.
- No usar `Default` change detection.
- No agregar dependencias nuevas sin justificación (no Material, Bootstrap, Heroicons, etc).
- No usar `style=""` inline excepto para valores dinámicos que vienen de datos.
- No crear abstracciones prematuras o wrappers innecesarios sobre componentes PrimeNG.
- No escribir CSS/SCSS en archivos de componente. Todo con Tailwind en el template.
- No usar `shadow-*`. Usar `border border-surface` para elevación.
- No usar valores de spacing fuera de la escala definida.
- No usar `rounded-sm`, `rounded-md`, `rounded-none` ni valores arbitrarios de border-radius.
- No crear archivos de estilos globales adicionales. Todo pasa por `styles.scss` + Tailwind.
- No usar `::ng-deep`. Si PrimeNG no expone la API de estilo, usar `styleClass` o design tokens.
