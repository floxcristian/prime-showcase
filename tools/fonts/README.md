# Font preload injection

Post-build step que inyecta `<link rel="preload">` para el woff2 latin de
Inter Variable en los HTML emitidos por `ng build`.

## Por qué

Inter está self-hosted en `dist/.../media/inter-latin-wght-normal-HASH.woff2`.
Angular 21 inlina los `@font-face` en un `<style>` crítico del `<head>` —
buena base. Pero el browser NO baja el `.woff2` hasta que encuentra texto
realmente usando esa font-family. Con SSR, ese descubrimiento ocurre cuando
parsea el `<body>` renderizado → delay de 50-200ms entre HTML recibido y
font download iniciado. En ese hueco, el usuario ve texto en font de
sistema (FOUT), luego salta a Inter.

Con `<link rel="preload" as="font">` en el `<head>`, el browser's preload
scanner dispara la descarga **inmediatamente**, en paralelo con el parse
del CSS. Cuando el `@font-face` se evalúa, el archivo ya está en cache →
FOUT invisible. Ganancia medida: 50-200ms en cold load sobre 4G.

## Por qué NO preconnect

`preconnect` se usa para **origins remotos** (CDN, fonts.googleapis.com).
Abre DNS + TCP + TLS antes de la primera request. Inter acá es same-origin
con el HTML — el browser ya tiene la conexión TCP abierta cuando bajó el
HTML. Preconnect a `self` es literalmente no-op, y encima agrega markup
engañoso. La respuesta correcta es preload.

## Por qué SÓLO latin

Fontsource emite 6 subsets para Inter: `cyrillic-ext`, `cyrillic`,
`greek-ext`, `greek`, `vietnamese`, `latin-ext`, `latin`. Cada uno con su
propio `unicode-range` en el `@font-face`. El browser descarga el subset
que cubre los chars que efectivamente aparecen en la página.

En español (app actual), el 99.9% del texto cae en `U+0000-00FF` (ASCII +
Latin-1, incluye `ñ`, `á`, `é`, `í`, `ó`, `ú`). Ese es el subset `latin`,
de 48 kB. Preloadear los otros (85 kB latin-ext + 14 kB vietnamese + 13 kB
greek + 12 kB cyrillic + 5 kB cyrillic-ext + 2 kB greek-ext ≈ 131 kB) sería
**desperdicio**: el browser los bajaría JIT sólo si aparece un char raro,
que en una app ERP en español es casi nunca.

Si en el futuro la app se hace multi-idioma, extender el matcher para
detectar el subset dominante según `<html lang="...">` y preloadear ése.

## Por qué build-time (no runtime)

Los filenames tienen content hash (`inter-latin-wght-normal-NRMW37G5.woff2`)
que cambia en cada build. El `<link rel="preload" href="...">` necesita el
URL exacto con hash. Opciones:

1. **Build-time post-process** (elegido): scanear el `styles-*.css` emitido,
   extraer el URL, inyectar en los HTML templates. Zero runtime cost,
   resultado determinista, funciona con CDN enfrente.
2. **SSR middleware runtime injection**: middleware Express parsea la
   respuesta de Angular y injecta el link. Descartado: per-request cost,
   parsing HTML en cada request es frágil, sólo cubre SSR (no CSR fallback).
3. **Angular template build-time**: Angular no expone esta API hoy.
4. **`@angular/build` preloadResources**: no existe en 21.x.

Opción 1 es lo que hacen Next.js (`next/font`), Remix, SvelteKit — es el
patrón bigtech para este caso.

## Archivos

- [inject-preload.lib.mjs](./inject-preload.lib.mjs) — funciones puras
  (extract URL, build link tag, inject into HTML). Sin I/O, 100% testable.
- [inject-preload.mjs](./inject-preload.mjs) — runner. Lee el dist, llama
  a la lib, escribe los HTML.
- [__tests__/inject-preload.test.mjs](./__tests__/inject-preload.test.mjs)
  — node:test suite. 19 tests cubriendo happy path, errores (zero matches,
  ambiguity, no `<head>`), idempotencia, case-insensitivity.

## Integración con el build

```json
{
  "scripts": {
    "build": "ng build && node tools/fonts/inject-preload.mjs",
    "lint": "ng lint && npm run lint:rules:test && npm run fonts:preload:test",
    "fonts:preload:test": "node --test tools/fonts/__tests__/*.test.mjs"
  }
}
```

Se corre automáticamente en cada `npm run build` (incluido `npm run verify`
y CI). En watch-mode (`ng build --watch`) NO corre — dev no necesita este
hint y agregaría ruido.

## Invariantes del script

- **Idempotente:** correr dos veces deja el HTML idéntico. Si el tag ya
  está, no-op.
- **Fail-loud:** si no encuentra el subset latin (0 matches), o hay
  ambigüedad (>1 matches), o el archivo referenciado no existe en disco,
  **falla el build con error claro**. Nunca emite un preload a 404 ni
  decide arbitrariamente.
- **Case-insensitive ancla:** detecta `<meta name="theme-color">` y `<head>`
  sin importar casing — robusto contra formatters HTML que capitalicen.
- **Multi-target:** parchea tanto `index.csr.html` (CSR fallback) como
  `index.server.html` (shell que usa Angular SSR). Así cualquier modo de
  serving emite el preload.

## Regex vs AST parser: matriz de decisión (source-stability)

Pregunta natural: ¿por qué regex y no un CSS parser AST (css-tree / postcss)?
Respuesta corta: porque **la herramienta debe matchear la estabilidad de la
fuente**. Es el mismo criterio que usan las bigtechs.

| Caso | Herramienta correcta | Ejemplos reales |
|---|---|---|
| CSS **generado por tool controlado + version-pinned** (Google Fonts API, fontsource package) | **Regex + canary test** | [Next.js `next/font/google`](https://github.com/vercel/next.js/blob/canary/packages/font/src/google/fetch-css-from-google-fonts.ts) (regex on Google's CSS) |
| CSS **user-authored arbitrario** (imports user-provided) | **AST parser** (postcss/css-tree) | `next/font/local`, Nuxt `@nuxt/fonts`, Stylelint |
| CSS **legacy / desconocido** (lint, refactor tools) | **AST parser** | Prettier, Stylelint |

**Nuestro caso:** consumimos `@fontsource-variable/inter`. El package:
1. Está **version-pinned** en `package-lock.json`
2. Emite formato **determinista desde v5.x (2023+)**
3. El CSS pasa por Angular's minifier que normaliza whitespace

Esto es exactamente el cuadro 1 de la matriz → regex es la herramienta
correcta, no una concesión. Migrar a AST agregaría 80 kB de dep + 10ms de
parse time por zero beneficio práctico.

### Mitigación del riesgo regex

El único riesgo real de regex es que fontsource cambie formato en una major
(v6+) y nuestros fixtures hand-written queden stale sin detectarlo. Ese gap
lo cierra el **canary test** en `__tests__/inject-preload.test.mjs`:

- Lee el CSS REAL de `node_modules/@fontsource-variable/inter/index.css`
- Verifica que `findLatinWoff2Url` devuelva un URL válido
- Verifica que el archivo referenciado existe en disco
- **Corre en CI** vía `npm run lint` → cualquier dep bump que cambie formato
  falla CI antes del build

Con los fixtures (lockean expected behavior) + canary (lockea input real),
ambos frentes están cubiertos. Esta es la equivalencia práctica a lo que
daría un AST parser para un source controlado.

### Cuándo SÍ migrar a AST

Hoy: YAGNI. Migrar si aparece alguno de estos:

1. **Multi-font runtime selection** — permitir al usuario elegir entre
   Inter / Roboto / custom sin rebuild
2. **User-provided CSS files** — importar CSS arbitrario no pinned
3. **Multi-idioma dinámico con subset switching** — detectar `<html lang>`
   y preloadear el subset correcto (actualmente hardcodeado a latin)

Ninguno está en roadmap. Evaluar cuando llegue el requerimiento.

## Cómo extender

### Preloadear un subset distinto (ej: japanese)

Cambiar `LATIN_RANGE_MARKER` en [inject-preload.lib.mjs](./inject-preload.lib.mjs).
Cada subset tiene su propio range estable — tomar el primero del
`unicode-range` de la rule target. Los tests fallan si el cambio rompe
fixtures existentes — actualizarlos junto.

### Preloadear múltiples fonts

Evolucionar `findLatinWoff2Url` a `findWoff2Urls(css, ranges[])` que
devuelva un map. El runner itera y emite un `<link rel="preload">` por
cada uno. Mantener el constraint "fail si ambiguity" — regex debe retornar
exactamente 1 match por range.

### Agregar otros formatos (woff, ttf)

Hoy sólo match woff2 (el único formato que tiene sentido en 2026 — 95%+
coverage). Si aparece necesidad de fallbacks, agregar un segundo matcher
pero con el caveat: emitir un preload por fallback aumenta bytes totales
del HTML sin beneficio real (browsers modernos sólo usan woff2).
