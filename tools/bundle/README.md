# Bundle budget discipline

Filosofía de bundle size enterprise-grade. Alineado con cómo gestionan budgets
Stripe, Linear, Vercel y GitHub: **no subir el budget para pasar CI**.

## Tiered strategy

Dos gates, con roles distintos:

1. **`angular.json` → `budgets`** — hard ceilings absolutos. Si se superan,
   CI falla. Subir este número requiere architecture review + justification
   documentada en el PR.
2. **`tools/bundle/check-delta.mjs`** — per-PR delta check. El enforcer REAL
   contra crecimiento silencioso. Corre en CI, compara contra `baseline.json`,
   falla si cualquiera de las dos métricas crece > 3% sin justificación.

La diferencia clave: los budgets de Angular sólo disparan cuando se rompe el
techo. El delta check dispara en CADA PR que crezca, aunque esté lejos del
techo. Sin el delta check, 50 PRs de +5 kB cada uno suben el bundle 250 kB sin
que nadie se entere hasta que toca renegociar el budget.

## Dos métricas

El delta check rastrea dos números distintos — crecimiento en CUALQUIERA de
los dos falla CI:

1. **`initial`** — JS + CSS referenciado en `index.csr.html`. Es lo que el
   browser descarga antes del primer paint. Captura tiempo al primer render.
2. **`totalJs`** — sum de TODOS los `*.js` del dist/browser (initial + lazy
   chunks). Captura bloat en rutas que se cargan on-demand. Sin esto, un PR
   que mueve 100 kB desde initial a lazy se ve como "mejora" en `initial`
   pero empuja el mismo peso a los usuarios — solo lo difiere en el tiempo.

Por qué ambas importan: Chart.js vive en lazy chunks, y su tree-shaking (que
ahorró ~25 kB raw en 2026-04-24) es invisible en la métrica `initial`. Sin
`totalJs` trackeado, ese cambio no tendría baseline contra el cual defender
futuras regresiones.

## Defaults actuales (2026-04-24, post Chart.js tree-shake)

- **Initial:** `742 kB` raw / `167 kB` gz (estimated transfer)
- **TotalJs:** `1.75 MB` raw across 40 chunks
- **`maximumWarning`:** `760 kB` initial (baseline + ~3% → triggers review)
- **`maximumError`:** `820 kB` initial (baseline + ~10% → hard ceiling)
- **Per-PR delta:** falla si initial raw O totalJs raw crecen > 3%

El error budget está ceñido deliberadamente. Cuando este proyecto arrancó,
estaba en `1 MB` — suficiente headroom para duplicar el bundle sin CI quejarse.
Eso es lo opuesto a disciplina: el budget debe ser incómodo, no decorativo.

## Optimizaciones aplicadas

### ✅ Chart.js tree-shaking (2026-04-24)

**Problema:** `primeng/chart` → `<p-chart>` → `chart.js/auto` → todos los
controllers (bar, line, pie, doughnut, polarArea, radar, scatter, bubble) +
scales (radialLinear, time, timeseries, logarithmic) + plugins (Legend,
Title, Subtitle, Decimation, Colors). Usábamos sólo bar/line/doughnut +
category/linear + Tooltip/Filler.

**Fix:** wrapper custom `<app-chart>` en
[src/app/shared/components/chart/](../../src/app/shared/components/chart/)
que registra sólo las piezas realmente usadas vía
`chart-registry.ts`. `<p-chart>` eliminado del proyecto — PrimeNG's
`chart.js/auto` import ya no está en la grafo del bundler.

**Savings medidos:** lazy chunk de overview/settings-drawer: ~25 kB raw /
~6 kB gz. Initial no cambia (chart.js nunca estuvo en initial). Refactor:
1 nuevo component + registry, 2 consumers migrados (overview + settings-drawer),
+ 11 unit tests.

## Known bloat restante (optimization roadmap)

### 1. `fontawesome.min.css` — 137 kB raw / ~30 kB gz

Cargamos el mapping completo de ~20,000 iconos pero usamos ~80. El `styles.css`
final son 224 kB (el 60% del initial bundle) y ~137 kB son este archivo.

**Fix:** migrar a `@fortawesome/angular-fontawesome` + tree-shakeable icon
imports. Reemplaza `<i class="fa-sharp fa-regular fa-x">` por
`<fa-icon [icon]="faX" />`. Ahorro estimado: ~100 kB raw / ~25 kB gz en
`styles.css` (INITIAL bundle impact).

**Scope:** medium refactor. ~300 sitios con `<i class="fa-...">` en el repo.
Hay que balancear: el `icon` prop de `<p-button>` acepta string, no `IconDefinition`.

### 2. `brands.min.css` — 15 kB raw / ~4 kB gz

Cargamos el archivo de marcas enteros para 2 iconos:
- `fa-bitcoin` en `COIN_BADGES.btc`
- `fa-ethereum` en `COIN_BADGES.eth`

**Fix:** inline SVG en `overview-data.ts`. Eliminar
`public/fontawesome/css/brands.min.css` de `angular.json` → `styles[]`.
Ahorro: ~15 kB raw / ~4 kB gz. Scope: small refactor, 1 archivo.

## Cuándo subir el budget

Escenarios VÁLIDOS para subir `maximumError`:
- Feature funcional nueva que justifica el peso (ej: editor de código Monaco,
  PDF viewer, video player).
- Dependencia crítica de seguridad que no se puede tree-shakear más.

Escenarios NO VÁLIDOS (→ code review rechaza el PR):
- "Sólo subí 5 kB" — sin PR que justifique, sumado con otros 50 PRs es 250 kB.
- Dependencias nuevas de UI que duplican funcionalidad existente.
- Libs enteras importadas cuando sólo se usa una función.

## Cómo correr el check localmente

```bash
# Build + comparar contra baseline
npm run build
npm run bundle:check

# Actualizar baseline (sólo cuando hay justificación aprobada — commit el
# baseline.json actualizado junto con el PR que justifica el crecimiento).
npm run bundle:baseline
```

Output humano:
```
Bundle delta check
  dist: <path>
  threshold: +3% on each of {initial raw, totalJs raw}

Initial bundle (first paint):
  raw:   724.81 kB →  724.81 kB  (    +0 B / +0.00%)  ✔
  gzip:  190.90 kB →  190.90 kB  (     1 B / -0.00%)

Total JS shipped (initial + lazy chunks):
  raw:     1.75 MB →    1.75 MB  (    +0 B / +0.00%)  ✔
  chunks: 40 → 40

✔ Bundle delta dentro del threshold (initial + totalJs).
```
