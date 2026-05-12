---
paths:
  - "src/**/*.html"
  - "src/**/*.ts"
---

# PrimeNG component recipes

Recetas detalladas de componentes PrimeNG. **Siempre consultar el MCP de PrimeNG (`@primeng/mcp`) antes de implementar** — no asumir la API de memoria.

## Botones — variantes

```html
<!-- Botón con ícono only — para acciones secundarias en headers/toolbars -->
<p-button icon="fa-sharp fa-regular fa-ellipsis" text rounded />

<!-- Botón secundario outlined (acciones secundarias) -->
<p-button severity="secondary" outlined />

<!-- Botón primario (acción principal) -->
<p-button label="Download" icon="fa-sharp fa-regular fa-download" iconPos="right" />

<!-- Botón full-width -->
<p-button label="Show All" outlined styleClass="w-full" />
```

**Severity:**
- `severity="secondary"` → default para la mayoría
- Sin severity → acción principal destacada
- `severity="danger"` → acciones destructivas
- `severity="contrast"` → alto contraste visual
- `severity="success"` / `"warn"` → rara vez, solo donde el significado semántico lo requiere

### Icon-only buttons — tooltip obligatorio

Todo `<p-button>` sin `label` visible (solo `icon`) DEBE declarar tanto `aria-label` como `pTooltip` con el mismo texto:

```html
<p-button icon="fa-sharp fa-regular fa-bell" aria-label="Notifications" pTooltip="Notifications" />
```

`aria-label` expone el propósito a screen readers; `pTooltip` lo expone a usuarios de mouse/teclado. Sin ambos, el botón es opaco. Excepción: si tiene `label` visible, `pTooltip` es redundante. Enforcement: `showcase/no-icon-button-without-tooltip`.

## Tags y Badges

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

## Avatares

```html
<!-- Avatar con imagen -->
<p-avatar image="url" class="rounded-lg overflow-hidden flex" />

<!-- Avatar con iniciales (sin imagen) — UN SOLO COLOR para todos -->
<p-avatar label="JD" styleClass="text-base font-medium"
  class="!bg-primary-100 !text-primary-950" />

<!-- Avatar con indicador de estado -->
<p-overlayBadge severity="danger" styleClass="w-fit">
  <p-avatar image="url" class="rounded-lg overflow-hidden flex" />
</p-overlayBadge>
```

## Tablas

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
    </tr>
  </ng-template>
  <ng-template #body let-data>
    <tr>
      <td style="width: 1rem"><p-tableCheckbox [value]="data" /></td>
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

## Menú popup

```html
<p-button icon="fa-sharp fa-regular fa-ellipsis" severity="secondary" text
  (click)="menu.toggle($event)" />
<p-menu #menu [model]="menuItems" [popup]="true" />
```

```typescript
menuItems: MenuItem[] = [
  { label: 'Refresh', icon: 'fa-sharp fa-regular fa-arrows-rotate' },
  { label: 'Export', icon: 'fa-sharp fa-regular fa-upload' },
];
```

## Navegación con routerLink

```html
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

## Popover

```html
<p-button (onClick)="displayPopover($event, op)"
  icon="fa-sharp fa-regular fa-magnifying-glass" rounded outlined severity="secondary" />

<p-popover #op>
  <ng-template pTemplate="content">
    <div class="flex gap-2">
      <p-button label="Details" size="small" outlined (onClick)="op.hide()" />
      <p-button label="Delete" severity="danger" size="small" outlined (onClick)="op.hide()" />
    </div>
  </ng-template>
</p-popover>
```

```typescript
displayPopover(e: MouseEvent, op: Popover) {
  op.hide();
  setTimeout(() => { op.show(e); }, 150);
}
```

## Campos de formulario

```html
<!-- Búsqueda con ícono -->
<p-iconfield iconPosition="left">
  <p-inputicon class="fa-sharp fa-regular fa-magnifying-glass"></p-inputicon>
  <input type="text" pInputText placeholder="Search" />
</p-iconfield>
```

## Eventos PrimeNG vs Angular

```html
<!-- PrimeNG: camelCase -->
<p-selectbutton (onChange)="onSelect()" />
<p-button (onClick)="action($event)" />
<p-fileupload (onUpload)="handle($event)" (onSelect)="onFiles($event)" />

<!-- HTML nativo: minúsculas -->
<div (click)="action()">...</div>
<button (click)="action()">...</button>
```

Consultar el MCP para el nombre exacto del evento de cada componente.

## styleClass y selectores avanzados

`styleClass` para ajustes de layout (usar `!` para override):

```text
styleClass="w-full"                          → Full width
styleClass="!min-w-0 !w-2.5 !h-2.5"          → Override badges
styleClass="!bg-transparent"                 → Fondo transparente (paginador)
valueStyleClass="!bg-surface-0 !rounded-full" → Relleno de p-progressbar
```

Selectores avanzados permitidos para contenedores con hijos repetidos:

```html
<div class="flex [&>*]:-mr-2">...</div>            <!-- Avatares solapados -->
<div class="[&>*]:flex-1 [&>*]:min-h-14">...</div>  <!-- Hijos igual tamaño -->
<div class="last:[&>td]:border-0">...</div>         <!-- Último sin borde -->
```

## Otros componentes PrimeNG en el proyecto

Sin recetas detalladas — **consultar el MCP** y revisar el archivo de referencia para el patrón:

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
