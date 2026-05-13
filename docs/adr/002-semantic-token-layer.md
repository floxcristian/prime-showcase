# ADR-002: Capa semántica de tokens (motion, z-index, density)

- **Estado:** Accepted
- **Fecha:** 2026-05-13
- **Deciders:** design council de `prime-showcase` (3 personas), maintainers
  (2 personas)
- **Related:** [ADR-001 — SSR Hydration y configuración de theming
  PrimeNG](./001-ssr-hydration-and-primeng-theming.md)
- **Supersedes:** ninguno
- **Superseded-by:** ninguno

## Context

Hoy el preset `src/app/app.preset.ts` declara una capa `semantic` con
tres familias de tokens visibles para Aura: `primary.*`, `colorScheme.*`
y `focusRing.*`. Esos tokens se emiten automáticamente como CSS vars
(`--p-primary-500`, `--p-focus-ring-shadow`, etc.) que la app, Storybook
y el tooling consumen.

Sin embargo, **otras tres familias de tokens del design system están
documentadas pero no existen en el preset**:

1. **Motion.** [`DESIGN.md`](../../DESIGN.md) sección "Motion" declara la
   escala oficial:
   ```text
   DURATION: 0ms | 150ms | 250ms
   EASING:   cubic-bezier(0.2, 0, 0, 1)  (standard)
             cubic-bezier(0, 0, 0.2, 1)  (decelerate)
             cubic-bezier(0.4, 0, 1, 1)  (accelerate)
   ```
   Esos valores no existen como CSS vars ni como entries en
   `design-tokens/tokens.json`. La regla
   `showcase/no-forbidden-transitions`
   (`tools/eslint/rules/no-forbidden-transitions.js`) hardcodea la lista
   de transiciones permitidas (`transition-colors`, `transition-opacity`,
   etc.) en código JS. El único token motion que sí existe en el preset
   es `semantic.transitionDuration: '0s'`, usado para desactivar las
   transiciones internas de PrimeNG (decisión documentada en ADR-001 §2).

2. **Z-index.** [`DESIGN.md`](../../DESIGN.md) sección "Z-Index" declara
   una escala semántica:
   ```text
   sticky:   10
   dropdown: 1000
   overlay:  1100
   drawer:   1200
   modal:    1300
   toast:    1400
   tooltip:  1500
   ```
   Ninguno está exportado como token. Componentes PrimeNG usan los
   defaults de Aura (que coinciden por casualidad con varios de estos
   números, pero no por garantía). Si un día Aura los cambia o un dev
   necesita un nivel intermedio, no hay fuente única.

3. **Density.** [`DESIGN.md`](../../DESIGN.md) sección "Density" declara
   una densidad única "productive":
   ```text
   bodyFontSize: 16px
   rowHeight:    56px
   inputHeight:  40px
   ```
   Estos valores viven hardcodeados en clases Tailwind a lo largo del
   código (`p-4`, `h-14`, etc.). El documento también anticipa una
   modalidad `compact` futura como toggle de tokens — imposible de
   implementar sin la fuente única.

### Por qué el problema importa

- **Drift.** `DESIGN.md` documenta valores que el código no respeta de
  forma verificable. La regla ESLint hardcodea su propia copia de la
  escala. El día que se quiera cambiar un easing, hay que tocar tres
  lugares y rezar que nadie quede atrás.
- **Imposibilidad de auditar.** El tooling externo (Figma plugin,
  potencial app móvil consumidora de `tokens.json`, futuro repo de
  marketing) no puede leer motion, z-index ni density sin que existan
  en el JSON.
- **ESLint inconsistente.** La regla `showcase/no-forbidden-transitions`
  define qué motion es válido, pero no consume el preset — define su
  propia verdad. Eso es exactamente el patrón que `npm run
  design-tokens:check` existe para prevenir, pero solo cubre color hoy.
- **Roadmap bloqueado.** El toggle de density (compact vs productive)
  documentado en DESIGN.md como "futuro" no puede empezarse hasta que
  los tokens existan como tokens.

## Decision

Agregar una **capa `system` (semántica) dentro de `semantic` en
`src/app/app.preset.ts`** que centraliza estas tres familias como tokens
nativos del preset. Aura no provee estas categorías de fábrica, así que
las inyectamos via la extensión del preset siguiendo el shape de
`@primeuix/themes`.

### Shape propuesto

```typescript
// src/app/app.preset.ts (post-RFC)
export const AppPreset = definePreset(Aura, {
  semantic: {
    transitionDuration: '0s',
    primary: { /* ... existente ... */ },
    colorScheme: { /* ... existente ... */ },
    focusRing: { /* ... existente ... */ },

    // ─── NUEVO: capa system ─────────────────────────────────────
    system: {
      motion: {
        duration: {
          instant: '0ms',     // cambios de tema PrimeNG (ADR-001 §2)
          base: '150ms',      // transition-colors / transition-opacity
          slow: '250ms',      // transition-transform en overlays
        },
        easing: {
          standard: 'cubic-bezier(0.2, 0, 0, 1)',
          decelerate: 'cubic-bezier(0, 0, 0.2, 1)',
          accelerate: 'cubic-bezier(0.4, 0, 1, 1)',
        },
      },
      zIndex: {
        base: 0,
        sticky: 10,
        dropdown: 1000,
        overlay: 1100,
        drawer: 1200,
        modal: 1300,
        toast: 1400,
        tooltip: 1500,
      },
      density: {
        productive: {
          bodyFontSize: '16px',
          rowHeight: '56px',
          inputHeight: '40px',
        },
        // Reservado para futuro toggle:
        // compact: { bodyFontSize: '14px', rowHeight: '40px', inputHeight: '32px' },
      },
    },
  },
});
```

### Emisión como CSS vars

`definePreset` de `@primeuix/themes` emite tokens anidados como CSS vars
con prefijo `--p-` y separador `-`. Los nuevos tokens quedarían:

```css
--p-system-motion-duration-instant: 0ms;
--p-system-motion-duration-base: 150ms;
--p-system-motion-duration-slow: 250ms;
--p-system-motion-easing-standard: cubic-bezier(0.2, 0, 0, 1);
--p-system-motion-easing-decelerate: cubic-bezier(0, 0, 0.2, 1);
--p-system-motion-easing-accelerate: cubic-bezier(0.4, 0, 1, 1);
--p-system-z-index-sticky: 10;
--p-system-z-index-dropdown: 1000;
--p-system-z-index-overlay: 1100;
/* etc. */
--p-system-density-productive-body-font-size: 16px;
--p-system-density-productive-row-height: 56px;
--p-system-density-productive-input-height: 40px;
```

### Consumo desde `design-tokens/tokens.json`

`tools/design-tokens/resolver.mjs` se extiende para escanear
`semantic.system` y emitir bajo una nueva sección del JSON:

```json
{
  "primary": { /* ... */ },
  "surface": { /* ... */ },
  "semantic": { /* ... existente ... */ },
  "system": {
    "motion": {
      "duration": { "instant": "0ms", "base": "150ms", "slow": "250ms" },
      "easing": {
        "standard": "cubic-bezier(0.2, 0, 0, 1)",
        "decelerate": "cubic-bezier(0, 0, 0.2, 1)",
        "accelerate": "cubic-bezier(0.4, 0, 1, 1)"
      }
    },
    "zIndex": { /* ... */ },
    "density": { "productive": { /* ... */ } }
  }
}
```

`tools/design-tokens/sync.mjs` detecta drift de esta sección igual que
hoy con `primary`/`surface`. El test del resolver
(`tools/design-tokens/__tests__/*.test.mjs`) se extiende para cubrir
emisión y orden estable de keys.

### Consumo desde ESLint

`showcase/no-forbidden-transitions`
(`tools/eslint/rules/no-forbidden-transitions.js`) deja de hardcodear su
escala y la lee al boot del proceso desde
`design-tokens/tokens.json`. Equivalente: la lista de durations válidas
se deriva de las keys de `system.motion.duration.*` mapeadas a clases
Tailwind (`duration-150` ↔ `base`, `duration-250` ↔ `slow`). Lo mismo
para `system.zIndex` — futura regla `showcase/no-arbitrary-z-index`
podría enforce que solo `z-{sticky,dropdown,overlay,...}` sea válido.

### Consumo desde Tailwind config

Tailwind 4 soporta `@theme` con import de CSS vars. La capa system se
puede exponer en `src/styles.scss`:

```css
@theme {
  --duration-base: var(--p-system-motion-duration-base);
  --ease-standard: var(--p-system-motion-easing-standard);
  --z-dropdown: var(--p-system-z-index-dropdown);
  /* etc. */
}
```

Esto permite que clases como `duration-base`, `ease-standard`,
`z-dropdown` consuman el preset sin redefinición. Templates pasan de:

```html
<div class="transition-colors duration-150">
```

A:

```html
<div class="transition-colors duration-base">
```

(Adoption phased — ver "Adoption strategy" abajo.)

## Consequences

### Positivas

- **Single source of truth.** Motion, z-index y density siguen el mismo
  patrón de propagación que color hoy: preset → CSS vars → consumers.
  Cambiar un easing en una línea propaga a runtime, Tailwind, ESLint y
  `tokens.json` sin tocar templates.
- **ESLint consume tokens.** La regla `no-forbidden-transitions` ya no
  re-define la escala — la lee. Si se agrega un duration nuevo al
  preset, la regla lo acepta automáticamente.
- **Figma puede consumir.** El plugin Figma (futuro) o cualquier
  consumer externo lee `design-tokens/tokens.json` y obtiene motion,
  z-index y density listos para usar. Hoy no puede.
- **Roadmap de density desbloqueado.** El toggle compact/productive
  futuro deja de necesitar rewrite de templates — basta cambiar qué
  branch de `system.density.*` apunta a las CSS vars `--p-form-field-padding`, etc.
- **Drift detection automática.** `npm run design-tokens:check` cubre
  ahora todas las capas, no solo color. Imposible mergear un cambio de
  preset sin actualizar `tokens.json`.

### Negativas

- **`tokens.json` crece.** De ~60 líneas actuales a ~120. Aceptable.
- **Dependency chain más larga.** `app.preset.ts` →
  `resolver.mjs` → `tokens.json` → reglas ESLint → templates → Tailwind
  config → CSS vars en runtime. Hoy es la mitad. Se maneja con codegen
  estricto y tests que verifican coherencia end-to-end.
- **Migración no trivial.** ~80 touchpoints actuales de `duration-150`
  en templates a renombrar a `duration-base` (estimado con `grep -r`).
  Requiere codemod (ver "Migration path").
- **Más superficie a entender.** Un nuevo dev aprende una capa más del
  preset. Se mitiga con docs en DESIGN.md y stories en `src/stories/tokens/`.

### Riesgos

- **Aura podría agregar `system.*` propio.** Si en una versión futura
  `@primeuix/themes` introduce su propia capa con shape distinto, hay
  colisión. Mitigación: el RFC monitorea el changelog de Aura cada
  bump; si Aura agrega su propia capa, evaluamos rename
  (`semantic.app.*` o similar).
- **Tailwind 4 `@theme` API podría cambiar.** Es preview en algunas
  versiones. Mitigación: el consumo desde Tailwind se hace en una phase
  separada del rollout y se puede revertir sin afectar runtime ni
  ESLint.

## Alternatives considered

### Alt 1 — Tokens en TS constants separadas (`src/app/design-tokens.ts`)

```typescript
export const MOTION_TOKENS = {
  duration: { base: '150ms', slow: '250ms' },
  easing: { standard: 'cubic-bezier(0.2, 0, 0, 1)' },
} as const;
```

Rechazado:

- Rompe paridad con el shape del preset Aura. El equipo razona en
  "tokens del preset" como una capa única; agregar una capa paralela
  fuera del preset multiplica conceptos.
- No se emite como CSS var automáticamente. Habría que escribir la
  conversión a mano y mantenerla sincronizada.
- Storybook tendría que importar dos cosas distintas para reconstruir
  el "design system completo" — hoy importa solo `app.preset.ts`.
- `tools/design-tokens/sync.mjs` tendría que escanear ambos archivos
  como source. Drift detection más frágil.

### Alt 2 — Tokens en CSS vars manuales (`src/styles.scss`)

```css
:root {
  --motion-duration-base: 150ms;
  --motion-easing-standard: cubic-bezier(0.2, 0, 0, 1);
  --z-dropdown: 1000;
}
```

Rechazado:

- Imposible de auditar desde Node (resolver.mjs / sync.mjs no parsean
  CSS). El check de drift no puede correr.
- No hay forma de exponerlo a `tokens.json` sin un parser de CSS, que
  agrega dependencia significativa.
- Dark mode aparte requiere duplicar bajo `.p-dark { --motion-...: }`.
  El preset Aura ya maneja dark via `colorScheme.{light,dark}`. La capa
  system no necesita dark, pero el patrón mixto confunde.

### Alt 3 — Tokens per-componente (`semantic.components.button.motion.*`)

Rechazado:

- Explota a 100+ componentes PrimeNG cada uno con su propia copia de
  motion/z-index/density. Maintenance imposible.
- No expresa la intención: la escala es del sistema, no del componente.
  Un `<p-tooltip>` y un `<p-dialog>` consumen del mismo z-index ladder
  por elección de diseño, no por accidente del componente.
- Aura ya provee `components.<name>` para overrides específicos
  (color/border de un button); meter motion ahí mezcla rol con identidad.

### Alt 4 — No hacer nada

Rechazado:

- El drift documentado en "Context" sigue creciendo. La próxima vez que
  alguien quiera cambiar un easing, va a ser un trabajo de 3-4 PRs
  cruzadas.
- El roadmap de density toggle queda permanentemente bloqueado.
- Cuando un consumer externo (Figma plugin, repo de marketing) pida
  estos tokens, hay que hacer este RFC bajo presión en vez de
  proactivamente.

## Implementation phases

Ver [`docs/DEPRECATION.md`](../DEPRECATION.md) "Lifecycle estándar" para
política general. Phases específicas de este ADR:

1. **Phase 0 — Preset extension.** Agregar `system.{motion,zIndex,density}`
   al preset. CSS vars emitidas pero no consumidas. Tests del resolver
   verifican shape. PR aparte.
2. **Phase 1 — Resolver + tokens.json.** Extender `resolver.mjs` y
   `sync.mjs` para emitir bajo `system.*` en el JSON. `design-tokens:check`
   pasa con la nueva sección. PR aparte.
3. **Phase 2 — ESLint consume tokens.** Refactor
   `no-forbidden-transitions.js` para leer la escala desde
   `tokens.json` al boot. Test de drift cuando se agrega un duration
   nuevo al preset. PR aparte.
4. **Phase 3 — Tailwind config.** Exponer CSS vars como Tailwind theme
   tokens en `src/styles.scss`. Nuevas clases utility disponibles
   (`duration-base`, `ease-standard`, `z-dropdown`). PR aparte.
5. **Phase 4 — Codemod + migration.** Codemod en
   `tools/codemods/2026-MM-DD-rfc-NNNN-motion-tokens.mjs` que reescribe
   `duration-150` → `duration-base`, `duration-250` → `duration-slow`,
   `z-[1300]` → `z-modal`, etc. Run sobre el repo. PR aparte.
6. **Phase 5 — Deprecación de la escala vieja.** Las clases numéricas
   (`duration-150`, `z-[1000]`) entran en la regla ESLint con severity
   `warn` durante 1 minor, después `error` con remoción del soporte de
   la regla. Ver [`docs/DEPRECATION.md`](../DEPRECATION.md).

## Changelog

| Fecha | Cambio |
|---|---|
| 2026-05-13 | Creación inicial, status: Accepted. |
