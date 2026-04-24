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
   falla si el initial bundle crece > 3% sin justificación.

La diferencia clave: los budgets de Angular sólo disparan cuando se rompe el
techo. El delta check dispara en CADA PR que crezca, aunque esté muy lejos del
techo. Sin el delta check, 50 PRs de +5 kB cada uno suben el bundle 250 kB sin
que nadie se entere hasta que toca renegociar el budget.

## Defaults actuales (2026-04-24)

- **Current baseline:** initial `742 kB` raw / `167 kB` gz
- **`maximumWarning`:** `760 kB` (baseline + ~3% → triggers review, NOT block)
- **`maximumError`:** `820 kB` (baseline + ~10% → hard ceiling, blocks CI)
- **Per-PR delta:** falla si initial crece > 3% vs `baseline.json`

El error budget está ceñido deliberadamente. Cuando este proyecto arrancó,
estaba en `1 MB` — suficiente headroom para duplicar el bundle sin CI quejarse.
Eso es lo opuesto a disciplina: el budget debe ser incómodo, no decorativo.

## Known bloat (optimization roadmap)

### 1. `fontawesome.min.css` — 137 kB raw / ~30 kB gz

Cargamos el mapping completo de ~20,000 iconos pero usamos ~80. El `styles.css`
final son 224 kB (el 60% del initial bundle) y ~137 kB son este archivo.

**Fix:** migrar a `@fortawesome/angular-fontawesome` + tree-shakeable icon
imports. Reemplaza `<i class="fa-sharp fa-regular fa-x">` por
`<fa-icon [icon]="faX" />`. Ahorro estimado: ~100 kB raw / ~25 kB gz.

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
node tools/bundle/check-delta.mjs

# Actualizar baseline (sólo cuando hay justificación aprobada)
node tools/bundle/check-delta.mjs --update-baseline
```

El output humano:
```
Bundle delta check
  initial:  742.1 kB → 745.3 kB  (+3.2 kB / +0.43%)  OK
  lazy:     520.4 kB → 520.4 kB  (+0.0 kB / +0.00%)  OK
  styles:   224.1 kB → 224.1 kB  (+0.0 kB / +0.00%)  OK
```
