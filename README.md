# prime-showcase

Showcase de UI enterprise construido con PrimeNG + Tailwind como vitrina de patrones de diseño, theming y accesibilidad.

## Stack

- **Angular 21** — standalone components, signals, nuevo control flow (`@if` / `@for`), zoneless change detection.
- **PrimeNG 21** con tema **Aura** (`@primeuix/themes`) y `cssLayer` para interop con Tailwind.
- **Tailwind CSS 4** + `tailwindcss-primeui` (clases consumen design tokens del preset, no colores ad-hoc).
- **Font Awesome Pro 7** self-hosted — familias Sharp (regular + solid + duotone) y Brands.
- **TypeScript strict mode** (`strictTemplates`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature`).
- **@angular/ssr** con hydration (`provideClientHydration(withEventReplay())`).

## Required reading antes de contribuir

Leer en este orden — son documentos normativos, no opcionales:

1. **[`CLAUDE.md`](./CLAUDE.md)** — guía de estilo del proyecto. Design system, tokens permitidos, patrones de componente, convenciones de Tailwind. Autoritativa.
2. **[`docs/adr/001-ssr-hydration-and-primeng-theming.md`](./docs/adr/001-ssr-hydration-and-primeng-theming.md)** — decisiones de arquitectura (SSR + PrimeNG theming + focus management + narrow transitions). Explica el *por qué* de configuraciones críticas en `app.config.ts` y `styles.scss`.
3. **[`docs/rules/README.md`](./docs/rules/README.md)** — documentación por regla del plugin ESLint local. Cada regla tiene su página con ejemplos pasan / fallan y rationale.

Cualquier cambio que entre en conflicto con estos documentos debe actualizar el documento primero.

## Scripts

```bash
npm start              # dev server (Angular dev server con SSR)
npm run build          # production build (SSR + prerender)
npm run lint           # ESLint — incluye reglas custom del plugin local
npm run lint:fix       # auto-fix para reglas con suggestions
npm run lint:rules:test # RuleTester unit tests para el plugin local
```

## Build budgets

Enforced en `angular.json`:

- **Initial bundle:** < 750 kB (warn) / 1 MB (error).
- **Component styles:** < 4 kB (warn) / 8 kB (error).

Los SCSS de componente deben permanecer vacíos (convención del proyecto — todo el styling se hace con Tailwind en el template). Si un componente se acerca al budget de styles, revisar `CLAUDE.md` — probablemente hay CSS que debería migrarse a clases Tailwind.

## Estructura

```text
src/app/
  modules/           ← páginas de la app, una carpeta por feature
    <feature>/
      <feature>.component.{ts,html,scss}
      constants/     ← configuraciones, listas estáticas
      mocks/         ← datos de ejemplo tipados
      models/        ← interfaces y tipos
  layouts/           ← shell (main, side-menu)
  core/              ← servicios globales (AppConfigService, etc.)
docs/
  adr/               ← Architecture Decision Records
  rules/             ← documentación del plugin ESLint local
tools/eslint/
  plugin.js          ← entry point del plugin `showcase/*`
  utils.js           ← visitor compartido (escanea class + styleClass + routerLinkActive)
  rules/             ← una regla por archivo, con tests en __tests__/
patches/             ← patch-package diffs sobre node_modules (documentados en ADR-001 §6)
```

## Flujo de contribución

1. Leer `CLAUDE.md` completo la primera vez.
2. Revisar componentes existentes en `src/app/modules/` antes de implementar uno nuevo — replicar patrones, no inventar.
3. `npm run lint` debe pasar limpio antes de commit.
4. Para cambios arquitecturales, crear o actualizar el ADR correspondiente en `docs/adr/` antes de tocar código.

## Convenciones del repositorio

- **Idioma:** ADR, commits y documentación interna en español. Código e identifiers en inglés.
- **Commits:** estilo conventional (ver `git log` reciente). Sin co-authorship tags automáticos salvo que lo pida explícitamente el reviewer.
- **No proactive docs:** no crear `*.md` sin pedido explícito. CLAUDE.md + ADRs + per-rule docs son la única documentación sostenida.
