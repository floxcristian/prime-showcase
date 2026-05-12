---
paths:
  - "src/app/**/*.component.ts"
  - "src/app/**/*.service.ts"
---

# Component architecture

Estructura, host class, signals/effects, inicialización de datos, PrimeNG imports.

## Estructura base

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

## Reglas

- **Siempre** `ChangeDetectionStrategy.OnPush`.
- **Siempre** standalone (sin NgModules).
- Agrupar imports en `NG_MODULES` y `PRIME_MODULES` como arrays const.
- Imports ordenados: Angular > PrimeNG > Local (mocks, models, constants).
- Selector: `app-feature-name`.
- `host.class` para layout del componente host (ver patrones abajo).
- Preferir `signal()` y `computed()` sobre propiedades mutables para estado reactivo.
- Usar `effect()` para side effects (reaccionar a cambios de tema).
- `inject()` en vez de constructor injection.
- **El archivo `.scss` debe permanecer vacío.** Todo Tailwind en el template.

## Patrones de host class por tipo de página

Elegir según el tipo de contenido:

```typescript
// 1. Página con contenido simple (cards, customers, movies) → borde + padding + scroll
host: { class: 'flex-1 h-full overflow-y-auto overflow-x-clip overflow-hidden border border-surface rounded-2xl p-6' }

// 2. Página con paneles lado a lado (chat) → flex sin padding
host: { class: 'flex-1 h-full overflow-y-auto overflow-x-clip overflow-hidden flex border border-surface rounded-2xl' }

// 3. Página con paneles separados (inbox) → gap entre paneles, sin borde externo
host: { class: 'flex gap-4 h-full flex-1 w-full overflow-auto' }

// 4. Página wrapper (overview) → sin borde, contenido define cards propias
host: { class: 'flex-1 h-full overflow-y-auto pb-0.5' }
```

## Inicialización de datos

```typescript
// Simple/constantes → field initializers
search: string = '';
chats: ChatItem[] = CHATS;
options: string[] = ['Weekly', 'Monthly', 'Yearly'];

// Datos complejos → ngOnInit()
ngOnInit() {
  this.menuItems = [{ label: 'Refresh', icon: 'fa-sharp fa-regular fa-arrows-rotate' }];
}

// Tema → effect() como field
themeEffect = effect(() => {
  if (this.configService.transitionComplete()) this.initChart();
});
```

**Nunca** inicializar datos complejos en el constructor. Preferir `inject()` sobre constructor DI.

## Servicios y estado

- Servicios con `providedIn: 'root'`.
- Estado con `signal()`, derivados con `computed()`.
- Side effects con `effect()`.
- `AppConfigService` para acceso al tema/dark mode.
- No librerías de state management externas.
- No usar RxJS para estado de UI local — preferir signals.

## Zoneless change detection

El proyecto corre con `provideZonelessChangeDetection()` — NO hay `zone.js`. Reglas prácticas:

1. **Siempre signals para estado reactivo.** Propiedades mutables (`this.foo = ...`) NO disparan CD en zoneless. Usar `signal()` / `computed()` para toda pieza de estado que afecte el template. **No negociable.**
2. **`effect()` para side effects** que reaccionan a signals (tema, route, mediaQuery). No usar lifecycle hooks para sincronizar con estado reactivo.
3. **Librerías con propiedades planas** (PrimeNG 21 aplica `.p-focus` via `this.focused = true` sin signal) pueden mostrar lag. Solución: estilizar con selectores CSS-nativos (`:focus-within`, `:has()`) que no dependen del ciclo de CD.

**Workflow ante sospecha de lag:** DevTools → ver si la clase esperada (`.p-focus`, `.p-highlight`) aparece sincrónicamente con el evento. Si llega tarde, cambiar a selector CSS-nativo en `styles.scss`.

Ref: ADR-001 §5c.

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

**Regla:** consultar el MCP de PrimeNG para saber si un componente se importa como Module o Standalone. No mezclar — si existe `Tag` standalone, usar `Tag`, no buscar `TagModule`.
