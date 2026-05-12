---
paths:
  - "src/**/*.ts"
  - "src/**/*.html"
  - "src/**/*.scss"
---

# SSR, runtime patterns, hydration

Reglas para patrones que dependen del runtime: SSR guard, focus ring CSS-nativo, charts, skeleton loading, incremental hydration.

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

Tres selectores cubren todos los casos. Elegir por rol del elemento, no por preferencia:

| Selector | Dispara con | Aplicar en | Caso de uso |
|---|---|---|---|
| `:focus-visible` | Teclado solamente | Elemento enfocado mismo | Buttons, links, inputs planos. Es la regla global de `styles.scss` — default para todo lo enfocable. |
| `:focus-within` | Teclado **y** clic, cualquier descendiente con foco | Wrapper cuando el enfocable real es un hijo | `p-autocomplete[multiple]`, `p-iconfield`. CSS-nativo y sincrónico → evita lag por clases mediadas en zoneless. |
| `:has(input:focus-visible)` | Teclado solamente, via descendiente | Wrapper cuando se necesita filtro teclado-only **y** patrón wrapper | Cuando `:focus-within` sería muy amplio. Requiere Baseline (OK 2026), pequeño overhead vs `:focus-within`. |

**Regla práctica:** si hay lag visible al enfocar un wrapper de PrimeNG (clase `.p-focus` no aplica a tiempo), preferir `:focus-within` en `styles.scss`. Ya aplicado a `p-autocomplete-input-multiple:focus-within` — seguir ese patrón.

## Charts (Chart.js via PrimeNG)

```typescript
// Leer colores del tema (NUNCA hardcodear hex)
const documentStyle = getComputedStyle(document.documentElement);
const primary400 = documentStyle.getPropertyValue('--p-primary-400');

// Dataset con colores del tema
{
  type: 'bar',
  backgroundColor: primary400,
  hoverBackgroundColor: primary600,
  barThickness: 32,
  borderRadius: { topLeft: 8, topRight: 8 },
  borderSkipped: false,
}

// Options: legend off, grid solo Y, stacked
{
  maintainAspectRatio: false,
  plugins: {
    tooltip: { enabled: false, external: fn },
    legend: { display: false },
  },
  scales: {
    x: { stacked: true, grid: { display: false } },
    y: {
      stacked: true,
      beginAtZero: true,
      grid: { color: darkTheme ? surface900 : surface100 },
    },
  },
}

// Reaccionar a cambios de tema
themeEffect = effect(() => {
  if (this.configService.transitionComplete()) this.initChart();
});
```

**Reglas:**
- Colores siempre con `getPropertyValue()` — nunca hex
- Legend custom HTML, no Chart.js built-in
- Tooltip con `external` callback
- Grid solo eje Y, color condicional dark mode
- `barThickness: 32`
- `borderRadius` solo en último dataset del stack

## Loading states: `<p-skeleton>` always

**REGLA CRÍTICA:** Cualquier estado de carga — placeholders de `@defer`, contenido pendiente de HTTP, listas async — usa `<p-skeleton>`. **Nunca** divs con `animate-pulse`, spinners custom ni `bg-surface-*` sin animación.

**Por qué:** una sola convención de loading state evita inconsistencia visual al escanear, hereda animación `wave` del tema Aura (sin escribir keyframes), y respeta dark mode automáticamente. Patrón alineado con Linear, Vercel, Stripe.

```html
<!-- Bloque genérico -->
<p-skeleton width="100%" height="20rem" />

<!-- Avatar / dot circular -->
<p-skeleton shape="circle" size="2.5rem" />

<!-- Línea de texto compacta -->
<p-skeleton width="60%" height="1rem" styleClass="mt-2" />

<!-- Sustituye exactamente al borde del componente real -->
<p-skeleton width="100%" height="10rem" borderRadius="0.5rem" />
```

**Imports:** `Skeleton` es standalone — agregar a `PRIME_MODULES`:

```typescript
import { Skeleton } from 'primeng/skeleton';
const PRIME_MODULES = [..., Skeleton];
```

**Dimensiones:** medir el componente real renderizado y reproducir alturas/anchos. Un placeholder que cambia de tamaño causa CLS — el objetivo es zero layout shift.

**`aria-busy="true"`** en el contenedor del placeholder. Lectores de pantalla anuncian "ocupado" sin enumerar cada skeleton.

## Incremental Hydration (`@defer hydrate`)

El proyecto usa `withIncrementalHydration()` (configurado en `src/app/app.config.ts`). Esto activa el comportamiento de `@defer (hydrate on <trigger>)`:

| Aspecto | Sin Incremental Hydration | Con Incremental Hydration |
|---|---|---|
| SSR del bloque | Renderiza placeholder | Renderiza contenido completo |
| Bytes enviados | Solo `@placeholder` | Contenido SSR + markers `ngh=dN` |
| Hidratación | Eager al bootstrap | Lazy hasta que dispara el trigger |
| Beneficio | Bundle inicial más pequeño (CSR) | TTI más rápido + main thread libre (SSR) |

**Cuándo aplicar `@defer (hydrate on <trigger>)`:**

| Trigger | Cuándo usar | Ejemplo |
|---|---|---|
| `viewport` | Bloque pesado (chart, carousel, file upload, panel xl) | Charts, Carousel con muchos items |
| `interaction` | Bloque que solo importa al click/hover | Menu contextual con 50 items |
| `idle` | Bloque secundario que puede esperar | Footer, sidebar de "también podría interesarte" |
| `timer(Nms)` | Animación diferida o efecto progresivo | Banner de newsletter 3s post-load |
| `never` | Solo SSR, nunca hidratar | Footer legal, copyright |

**Cuándo NO aplicar:**
- Componentes pequeños (<5kB de JS) — overhead de IO + scheduling no compensa
- Bloques above-the-fold critical (header, primer card) — siempre hidratan instantly de todos modos
- Bloques con `effect()` que reaccionan a estado externo desde el primer frame (theme switcher)

**Patrón del repo:**

```html
@defer (hydrate on viewport) {
  <!-- contenido pesado real -->
} @placeholder {
  <div aria-busy="true">
    <p-skeleton width="100%" height="20rem" />
  </div>
}
```

El `@placeholder` es opcional pero **siempre incluirlo**:
1. CSR fallback: si el cliente navega a la ruta sin SSR, el placeholder es lo que se ve hasta el trigger
2. Documentación visual: comunica al lector la dimensión/forma esperada

Verificado en: overview chart, movies carousel, chat right panel, cards file upload. Ref: ADR-001 §10.
