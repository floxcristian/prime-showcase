# PrimeNG Showcase - Guia de Estilo para Claude

## Stack

- Angular 19 (standalone components, signals, new control flow)
- PrimeNG 19 con tema Aura (`@primeng/themes`)
- Tailwind CSS 4 con plugin `tailwindcss-primeui`
- PrimeIcons 7
- SCSS para estilos de componente
- TypeScript strict mode

## Regla principal: Consistencia con lo existente

Antes de implementar cualquier feature, revisar los componentes existentes en `src/app/modules/` para replicar sus patrones exactos. No inventar nuevos patrones.

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

Seguir exactamente este patron:

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
- `host.class` para layout del componente host.
- Preferir `signal()` y `computed()` sobre propiedades mutables para estado reactivo.
- Usar `effect()` para side effects (como reaccionar a cambios de tema).
- `inject()` en vez de constructor injection.

## Templates HTML

- Usar `@if`, `@for`, `@switch` (Angular 17+ control flow). Nunca `*ngIf` o `*ngFor`.
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

## Estilos y diseño visual

### Prioridad de estilizado (de mayor a menor)

1. **Clases de Tailwind** en `class=""` para layout, spacing, tipografia.
2. **`styleClass`** para personalizar componentes PrimeNG con Tailwind (soporta `!` para important).
3. **Design tokens de PrimeNG** via clases del plugin `tailwindcss-primeui`.
4. **SCSS del componente** solo para estilos que no se pueden lograr con Tailwind.
5. **Nunca** CSS arbitrario inline excepto valores verdaderamente dinamicos (`[style.backgroundColor]="var"`).

### Clases de design tokens (usar SIEMPRE estas, no colores arbitrarios)

```
Texto:     text-color, text-muted-color
Fondo:     bg-surface-0, bg-surface-50, bg-surface-100, bg-surface-900, bg-surface-950
           bg-primary, bg-emphasis
Bordes:    border-surface
Accent:    bg-primary, text-primary
```

### Dark mode

- Usar utilidades `dark:` de Tailwind: `bg-surface-0 dark:bg-surface-950`.
- El tema Aura maneja automaticamente el dark mode de componentes PrimeNG.
- Para CSS variables: `--p-primary-*`, `--p-surface-*`.

### Patrones de layout

```html
<!-- Card estandar -->
<div class="border border-surface rounded-2xl p-6">...</div>

<!-- Card con seccion de cabecera -->
<div class="border border-surface rounded-2xl py-5 px-7">
  <div class="text-color font-semibold leading-6">Titulo</div>
  ...
</div>

<!-- Layout responsive -->
<div class="flex flex-col lg:flex-row gap-6">...</div>

<!-- Contenedor principal de pagina -->
<div class="flex-1 h-full overflow-y-auto pb-0.5">...</div>
```

### Tipografia (no usar font-size arbitrarios)

```
Titulo pagina:    text-2xl o text-3xl font-semibold text-color
Subtitulo:        text-muted-color font-medium
Texto cuerpo:     text-color leading-6
Texto secundario: text-sm text-muted-color leading-5
Labels:           text-sm text-color font-medium leading-5
```

### Iconos

- Usar PrimeIcons: `class="pi pi-search"`, `icon="pi pi-download"`.
- Consultar https://primeng.org/icons para iconos disponibles.

## Routing

- Lazy load con `loadComponent`:

```typescript
{
  path: 'nueva-ruta',
  loadComponent: () =>
    import('./modules/feature/feature.component').then(
      (m) => m.FeatureComponent
    ),
}
```

## Organizacion de archivos

```
src/app/modules/feature-name/
  feature-name.component.ts
  feature-name.component.html
  feature-name.component.scss
  constants/           # Constantes y configuraciones
  mocks/               # Datos mock
  models/              # Interfaces y tipos
```

- Interfaces en archivos `.interface.ts`.
- Constantes en UPPER_SNAKE_CASE.
- Mocks en archivos separados, importados como const.

## Servicios y estado

- Servicios con `providedIn: 'root'`.
- Estado con `signal()`, derivados con `computed()`.
- Side effects con `effect()`.
- `AppConfigService` para acceso al tema/dark mode.
- No usar librerias de state management externas.

## Lo que NO hacer

- No crear componentes custom si PrimeNG ya tiene uno equivalente.
- No usar colores hardcodeados (`#fff`, `rgb(...)`, `text-gray-500`). Usar design tokens.
- No usar `*ngIf`, `*ngFor` u otras directivas estructurales legacy.
- No crear NgModules.
- No usar `Default` change detection.
- No agregar dependencias nuevas sin justificacion (ej: no agregar Material, Bootstrap, etc).
- No usar `style=""` inline excepto para valores dinamicos.
- No crear abstracciones prematuras o wrappers innecesarios sobre componentes PrimeNG.
