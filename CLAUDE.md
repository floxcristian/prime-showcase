# PrimeNG Showcase — Claude Code instructions

@AGENTS.md

@DESIGN.md

## Cómo está organizada la documentación de este repo

| Archivo | Audiencia | Contenido |
|---|---|---|
| `AGENTS.md` | Cualquier agente o reviewer (importado arriba) | Stack, comandos, organización, "lo que NO hacer" en arquitectura |
| `DESIGN.md` | Cualquier agente o reviewer (importado arriba) | Identidad visual: tokens, escalas, recetas, "do's and don'ts" de diseño |
| `.claude/rules/primeng-patterns.md` | Cargado solo al tocar `src/**/*.{ts,html}` | Recetas detalladas de componentes PrimeNG |
| `.claude/rules/component-architecture.md` | Cargado solo al tocar `src/app/**/*.component.ts` | Estructura, host class, signals, zoneless, imports Module vs Standalone |
| `.claude/rules/ssr-and-runtime.md` | Cargado solo al tocar `src/**/*.{ts,html,scss}` | SSR guard, focus ring CSS-nativo, Chart.js, `<p-skeleton>`, `@defer hydrate` |
| `.claude/rules/ux-patterns.md` | Cargado solo al tocar `src/**/*.{ts,html}` | Empty states, error states, toast, confirm dialogs, validación, forms |
| `.claude/rules/eslint-plugin.md` | Cargado solo al tocar `tools/eslint/**/*` | Plugin local, reglas custom, agregar nuevas reglas |

Path-scoped rules cargan **on demand** cuando los archivos matchean — saving de context window.

## Storybook (`src/stories/**`)

El catálogo de design system del proyecto. **Si agregás un componente nuevo o una receta compuesta**, agregá story en el tree correspondiente (`primitives/`, `recipes/`, `tokens/`). El catálogo se publica a GitHub Pages en push a `main`.

Workflows asociados:
- `npm run storybook` — dev server local en `:6006`.
- `npm run build-storybook` — build estático a `dist/storybook/`.
- `tests/visual/storybook.spec.ts` — baselines visuales a nivel componente.

Preset Aura compartido (`src/app/app.preset.ts`): si modificás colores/tokens en el preset, corré `npm run design-tokens:sync -- --update` para reflejar en DESIGN.md, luego commit ambos archivos.

## MCP de PrimeNG (`@primeng/mcp`)

Este proyecto tiene configurado el MCP oficial de PrimeNG (`.mcp.json`). **Usarlo siempre** antes de implementar o recomendar un componente PrimeNG para:

- Verificar que el componente existe y su API actual (props, eventos, slots).
- Consultar ejemplos de uso y opciones de theming.
- Buscar el componente correcto por funcionalidad si no se conoce el nombre exacto.

**Siempre** consultar el MCP antes de implementar cualquier componente PrimeNG. **No asumir la API de memoria** — PrimeNG cambia entre versiones (eventos, props, deprecaciones).

## Regla #1 del proyecto

**Consistencia con lo existente.** Antes de implementar cualquier feature, revisar componentes existentes en `src/app/modules/` y replicar sus patrones exactos. Nunca inventar nuevos patrones. Si hay duda entre dos formas de hacer algo, elegir la que ya existe en el código.

## Antes de pushear

Correr `npm run verify` — replica exactamente lo que hace CI (`lint && build && bundle:check && smoke`). Si falla local, va a fallar en CI.

## /ultrareview

Para review profundo multi-agente del branch o un PR existente: el usuario invoca `/ultrareview` o `/ultrareview <PR#>`. **No puedo lanzarlo yo** — es user-triggered y billed. Si me piden "revisar el PR", recordar al usuario que existe `/ultrareview` para review más exhaustivo que `/review`.
