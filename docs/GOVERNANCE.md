# Governance

Modelo de decisión de `prime-showcase`. Define roles, flujos de
aprobación según el tipo de cambio, mecanismos de medición de adopción y
política de versionado.

Documentos hermanos:

- [`../CONTRIBUTING.md`](../CONTRIBUTING.md) — flujo de contribución y
  code review checklist.
- [`DEPRECATION.md`](./DEPRECATION.md) — cómo retirar APIs.
- [`RFC_TEMPLATE.md`](./RFC_TEMPLATE.md) — plantilla de RFC.
- [`../CHANGELOG.md`](../CHANGELOG.md) — historial versionado.

## Roles

### Contributor

Cualquier persona que abra una PR contra el repo. No requiere onboarding
formal — basta seguir [`CONTRIBUTING.md`](../CONTRIBUTING.md). Puede:

- Abrir issues y PRs.
- Comentar en RFCs en discusión.
- Pedir review de PRs propias.

No puede:

- Mergear PRs (incluso las suyas).
- Aprobar RFCs.
- Modificar permisos del repo.

### Maintainer

Contributor con derechos de merge. Aproximadamente 3-5 personas del
equipo principal. Responsabilidades:

- Review de PRs según el checklist de
  [`CONTRIBUTING.md`](../CONTRIBUTING.md).
- Merge de PRs aprobadas siguiendo las reglas del flujo de decisión
  (sección "Decision flow" abajo).
- Bumps de version y corte de releases en `CHANGELOG.md`.
- Triage de issues — etiquetado, asignación, cierre de duplicados.
- Operación del workflow de visual baselines y de design-tokens sync.

Para agregar o remover maintainers: RFC + aprobación del design council.

### Design council

Grupo de 3-5 personas con autoridad sobre el design system. Combina
roles de design lead, ingeniería frontend senior y product. Aprueba:

- RFCs que tocan `src/app/app.preset.ts` (tokens, palette, motion,
  z-index, density, focus ring, component overrides).
- RFCs que agregan o renombran primitivos en
  `src/app/shared/components/`.
- RFCs que agregan o modifican reglas del plugin ESLint local.
- Cambios en governance docs (`CONTRIBUTING.md`, `GOVERNANCE.md`,
  `DEPRECATION.md`).
- Cualquier cambio de major en el changelog de tokens.

El design council no necesariamente revisa código línea por línea —
revisa la decisión de diseño. Un maintainer técnico hace el code review
del PR de implementación una vez el RFC está accepted.

Aprobación = quórum mínimo del 50% + 1 (e.g. 3 de 5). Empates se
resuelven postergando la decisión y pidiendo más contexto, no votando.

## Decision flow

Cada PR se clasifica en una de estas categorías. La clasificación es
responsabilidad del autor; los reviewers pueden re-clasificar si
corresponde:

### 1. Bugfix simple

**Definición:** corrige comportamiento incorrecto sin cambiar APIs
públicas, sin tocar tokens, < 50 líneas modificadas.

**Flujo:** PR directa → 1 review de cualquier maintainer → merge.

**Ejemplos:**
- Off-by-one en paginator.
- Tooltip cortado por overflow.
- Cookie SSR mal serializada.
- Bug visual de hover state.

### 2. Feature pequeña

**Definición:** funcionalidad nueva dentro de un `src/app/modules/`
existente, sin nuevos primitivos compartidos, sin cambios de tokens, sin
nuevas reglas ESLint.

**Flujo:** PR → 1 review de contributor + 1 review de maintainer → merge.

**Ejemplos:**
- Nueva pestaña en `inbox` reutilizando primitivos existentes.
- Filtro nuevo en `customers` consumiendo APIs ya disponibles.
- Estado vacío para una vista que no lo tenía.

### 3. Cambio en `src/app/app.preset.ts` o `design-tokens/tokens.json`

**Definición:** cualquier modificación al preset Aura o al tokens.json
generado.

**Flujo:** RFC obligatorio → 1 maintainer + 1 design council → RFC
accepted → PR de implementación → 1 maintainer review → merge.

**Ejemplos:**
- Retunear `primary.500` a un hex distinto.
- Agregar capa `semantic.system.motion.*` (ver ADR-002).
- Cambiar `focusRing.shadow`.
- Override de `formField.invalidBorderColor`.

### 4. Nuevo primitivo en `src/app/shared/components/`

**Definición:** agregar un componente compartido que más de una feature
va a consumir.

**Flujo:** RFC obligatorio → 1 maintainer + 1 design council → RFC
accepted → PR de implementación + story en `src/stories/primitives/` →
1 maintainer review → merge.

**Ejemplos:**
- `<app-empty-state>` (existente, sirve de referencia).
- `<app-metric-card>` (existente).
- Hipotético `<app-feature-flag-badge>`.

### 5. Nueva regla ESLint en `tools/eslint/rules/`

**Definición:** agregar o modificar significativamente una regla del
plugin local. Cambios de wording de mensaje o ajustes de severity no
califican (van como bugfix simple).

**Flujo:** RFC obligatorio (con casos `valid`/`invalid` documentados) →
1 maintainer + 1 design council → RFC accepted → PR de implementación +
tests + entry en docs/rules + entry en CHANGELOG → 1 maintainer →
merge.

**Ejemplos:**
- `showcase/no-pi-icons` (hipotético — bloquear `pi pi-*` legacy).
- `showcase/no-arbitrary-z-index` (hipotético).
- Modificar el set de selectores de `showcase/no-deprecated-styleclass`.

### 6. Cambio en governance docs

**Definición:** cualquier toque a `CONTRIBUTING.md`, `GOVERNANCE.md`,
`DEPRECATION.md`. Cambios en `AGENTS.md` o `DESIGN.md` que no derivan
de un cambio en el preset también aplican.

**Flujo:** RFC obligatorio → quórum del design council (50% + 1) → PR
de implementación → merge.

No requiere review de maintainer separado porque el design council ya
revisó la decisión.

### 7. Cambio arquitectural

**Definición:** nueva dependencia mayor, cambio de SSR strategy,
migration de Angular major, cambio en el tree de routing, cambio en
`app.config.ts` que afecta providers globales.

**Flujo:** RFC + ADR en `docs/adr/` → 2 maintainers + 1 design council
para impacto en design system → PR de implementación → merge.

**Ejemplos:**
- ADR-001 (SSR + hydration + PrimeNG theming + transitions).
- ADR-002 (capa semántica de tokens, ver
  `docs/adr/002-semantic-token-layer.md`).
- Hipotético ADR-003 (adopción de Signal Forms cuando estabilice).

### Tabla resumen

| Tipo | RFC | Reviewers | Aprobador final |
|---|---|---|---|
| Bugfix simple | No | 1 maintainer | Maintainer |
| Feature pequeña | No | 1 contributor + 1 maintainer | Maintainer |
| Tokens (`app.preset.ts`) | Sí | 1 maintainer + 1 design council | Quórum council |
| Primitivo `shared/components/` | Sí | 1 maintainer + 1 design council | Quórum council |
| Regla ESLint | Sí | 1 maintainer + 1 design council | Quórum council |
| Governance docs | Sí | 2 design council | Quórum council |
| Arquitectural | Sí + ADR | 2 maintainers + 1 design council | Quórum council |

## Medición de adopción

Para evaluar si una feature, primitivo, regla o token están siendo
adoptados en la práctica, el repo va a exponer un script `npm run
adoption` (issue abierto: implementar en `tools/adoption/`). El script
producirá un reporte JSON + markdown con:

- **Tokens.** Por cada token semántico del preset, cuántas veces aparece
  como clase (`bg-primary`, `text-color`, etc.) en el tree de templates.
  Drift contra `tokens.json` para detectar tokens declarados pero no
  usados.
- **Primitivos.** Por cada componente de `src/app/shared/components/`,
  conteo de imports en `src/app/modules/`. Primitivos sin uso son
  candidatos a deprecación.
- **Reglas ESLint.** Por cada regla custom, cantidad de violaciones que
  detectó en el último año (cruce con git history). Reglas que nunca
  detectan nada en código nuevo son candidatas a relajación.
- **Recetas.** Patrones documentados en DESIGN.md detectados por grep
  (e.g. `border border-surface rounded-2xl p-6` para card estándar).
  Útil para encontrar lugares donde se reinventó la receta en vez de
  reusarla.

El reporte se corre manualmente por ahora; cuando esté estable se
pondría como parte de un workflow mensual o como check opcional en PRs
grandes.

Hasta que `npm run adoption` exista, la adopción se mide ad-hoc con
`grep` y se discute en retrospectivas trimestrales del design council.

## Versionado

Detalle completo en [`../CHANGELOG.md`](../CHANGELOG.md). Resumen:

- `package.json` se mantiene en `version: 0.0.0` (no publicado a npm).
- Los **tokens del design system** sí tienen versión semantica via el
  CHANGELOG. El número de versión vive en la headline de cada release
  del CHANGELOG (e.g. `## [0.5.0] - YYYY-MM-DD`).
- Major bump = breaking en tokens o primitivos públicos.
- Minor = feature aditiva o deprecación (que mantiene compat).
- Patch = bugfix.

Cuándo se corta un release nombrado: cuando un maintainer decide que la
ventana de `[Unreleased]` tiene suficiente contenido y nada críticamente
pendiente. No hay cadence fija — releases son event-driven, no
calendar-driven. Cuando se automatize, sería con un workflow manualmente
disparable en `.github/workflows/release.yml` (issue abierto: `chore/
release-automation`).

## Cómo escalar disputas

Si una PR queda trabada por desacuerdo entre reviewers, el orden de
escalamiento es:

1. **Discusión en la PR.** Los reviewers ponen su posición por escrito.
   El autor sintetiza y propone resolución.
2. **Convocatoria al design council.** Si la disputa es sobre design
   system, governance o arquitectura. Cualquiera puede convocar añadiendo
   la label `needs-council` a la PR.
3. **Decisión del council.** Vota por quórum. La decisión se documenta
   en el thread de la PR + un comment del miembro del council que
   propone el resultado, citando el principio que aplica (e.g.
   consistency-with-existing, accessibility-first, performance-budget).
4. **Si el council no llega a quórum.** Se cierra la PR como `won't fix`
   con explicación. El autor puede re-abrir vía RFC.

No se permite "merge bombing" (mergear ignorando reviews pendientes).
Maintainers que lo hacen pierden derechos de merge por 30 días en
primera ofensa, permanentemente en segunda. Este punto se aplica
literalmente — no es performance.

## Conflictos de interés

- Un autor no aprueba su propia PR.
- Un member del design council no se cuenta para quórum en RFCs que él
  mismo autoró.
- Cambios que afecten dependencias de un employer/cliente del autor
  deben declararse en la descripción de la PR.

## Onboarding

Para un nuevo contributor, el camino mínimo es:

1. Leer [`README.md`](../README.md), [`CONTRIBUTING.md`](../CONTRIBUTING.md)
   y [`DESIGN.md`](../DESIGN.md). En ese orden.
2. Correr `npm install && npm run verify` y confirmar que pasa en local.
3. Tomar un issue etiquetado `good-first-issue` o `help-wanted`.
4. Abrir PR siguiendo el checklist.

Para un nuevo maintainer:

1. Haber mergeado al menos 5 PRs como contributor sin major rework
   pedido por reviewer.
2. Haber participado como reviewer (con comentarios sustantivos, no solo
   approvals) en al menos 10 PRs ajenas.
3. RFC de propuesta de nominación firmado por un maintainer existente.
4. Aprobación del design council.

Para un nuevo member del design council:

1. Haber sido maintainer durante al menos 6 meses.
2. Haber sido autor o reviewer principal de al menos 1 RFC aceptado.
3. Aprobación unánime del council actual.

## Comunicación

- **Decisiones técnicas pequeñas:** thread de PR.
- **Decisiones técnicas que afectan a más de una feature:** RFC.
- **Decisiones de proceso o governance:** RFC + discusión en
  retrospectiva trimestral.
- **Bugs críticos / regresiones en producción:** issue con label
  `critical` + tag a todos los maintainers + nota en el último release
  del CHANGELOG si requiere patch.

No hay canales privados de decisión. Si una decisión se discute fuera
del repo (chat, llamadas), el outcome se documenta de vuelta en un
issue/RFC/PR thread con citación de quién participó y la posición de
cada quien.
