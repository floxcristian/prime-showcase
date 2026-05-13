# Política de deprecación

Esta política define cómo `prime-showcase` retira APIs públicas sin
romper consumers de un día para el otro. Aplica a tokens del preset,
primitivos en `src/app/shared/components/`, reglas del plugin ESLint,
clases utility documentadas en [`DESIGN.md`](../DESIGN.md) y cualquier
contrato exportado por `design-tokens/tokens.json`.

Documentos hermanos:

- [`CONTRIBUTING.md`](../CONTRIBUTING.md) — flujo general de contribución.
- [`GOVERNANCE.md`](./GOVERNANCE.md) — quién aprueba una deprecación.
- [`RFC_TEMPLATE.md`](./RFC_TEMPLATE.md) — plantilla obligatoria para
  cambios breaking.
- [`../CHANGELOG.md`](../CHANGELOG.md) — registro versionado de
  deprecaciones y remociones.

## Definiciones

**Deprecation.** Mantener una API funcionando pero marcarla como
candidata a remoción en una versión futura. El código sigue corriendo
sin warnings al usuario final, pero los developers ven el aviso en su
herramienta (ESLint, IDE, doc).

**Removal.** Eliminar la API. Cualquier consumer que la siga usando se
rompe en compile-time, runtime o lint según corresponda.

**Breaking change.** Cualquier cambio que no sea backward-compatible.
Incluye remoción de APIs deprecadas, rename sin alias, cambio semántico
de un token (mismo nombre, otro valor que no es un refinamiento).

## Lifecycle estándar

```text
[announced] ─── 1 minor ──> [deprecated] ─── ≥1 minor ──> [removed]
   día 0                       minor X                       major Y
```

Tres fases con timing concreto:

1. **Announced (día 0).** El RFC que propone la deprecación se mergea.
   La API sigue funcionando sin cambios. Solo se commitea: el RFC en
   `docs/rfc/NNNN-titulo.md`, entry en `CHANGELOG.md ## [Unreleased]
   ### Deprecated`, y un test de regresión que prueba que la API vieja
   sigue funcionando.

2. **Deprecated (minor X).** El siguiente release minor cuenta como el
   "minor de gracia". En este release la API queda formalmente
   deprecada — aparece el warning en las herramientas (ESLint, JSDoc),
   pero sigue funcionando. Los consumers tienen este minor completo (y
   los siguientes minor hasta el major Y) para migrar. **Mínimo 1
   minor entero de gracia**, sin excepciones.

3. **Removed (major Y).** La API se borra. Si la migración tenía codemod,
   el codemod se ejecuta una última vez sobre el repo del proyecto
   antes del release del major y los autores remueven todos los call
   sites internos. Consumers externos que no migraron rompen — esto es
   el contrato del semver major.

**Regla absoluta:** nunca deprecar y remover en el mismo release. Si
necesitás romper algo ya, eso es un breaking change directo que requiere
RFC + bump de major, no una deprecación.

## Cuándo se requiere RFC

Cualquier deprecación de **API pública** requiere RFC siguiendo
[`RFC_TEMPLATE.md`](./RFC_TEMPLATE.md). API pública incluye:

- Tokens del preset (`src/app/app.preset.ts`) y de `design-tokens/tokens.json`.
- Primitivos exportados de `src/app/shared/components/*` y sus inputs/outputs.
- Reglas del plugin ESLint (`tools/eslint/rules/*`) — porque cada regla
  define qué código es válido en el repo.
- Clases utility documentadas en [`DESIGN.md`](../DESIGN.md) con receta.
- Scripts npm en `package.json` consumidos por workflows.

**No requieren RFC** (sí entry en CHANGELOG):

- APIs privadas (no exportadas, no documentadas).
- Helpers internos de un módulo (`src/app/modules/feature/*/helpers/`).
- Constantes y mocks específicos de una feature.

## Vehículos de deprecación

Una deprecación se anuncia en **todos** los vehículos aplicables. Si el
consumer ignora uno, otro lo va a alertar.

### 1. Regla ESLint con `messageId` que apunta al CHANGELOG

Para deprecaciones de clases Tailwind, props PrimeNG, patrones de uso o
APIs HTML. Patrón:

```javascript
// tools/eslint/rules/no-deprecated-foo.js
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow deprecated `foo` API (removal in vX.0.0)',
    },
    messages: {
      deprecated:
        '`{{ name }}` está deprecado desde vX.Y.0 y se removerá en ' +
        'vX+1.0.0. Reemplazar por `{{ replacement }}`. Ver ' +
        'CHANGELOG.md sección "vX.Y.0 / Deprecated".',
    },
    schema: [],
  },
  create(context) { /* ... */ },
};
```

Ejemplo concreto del repo: `showcase/no-deprecated-styleclass`
(`tools/eslint/rules/no-deprecated-styleclass.js`) bloquea `styleClass`
en componentes PrimeNG v20 que lo deprecaron, con un set de 53
selectores sincronizado vía drift test contra las type defs de PrimeNG.

### 2. JSDoc `@deprecated` en componentes y servicios

Para deprecaciones de TS APIs: props, métodos, exports. El IDE
(VSCode/Cursor) muestra strikethrough y tooltip automáticamente.

```typescript
/**
 * @deprecated since v0.5.0 — use `<app-status-chip>` instead.
 * Will be removed in v1.0.0. See CHANGELOG.md "v0.5.0 / Deprecated".
 */
export class HealthBadgeComponent { /* ... */ }
```

Para inputs/outputs:

```typescript
/**
 * @deprecated since v0.5.0 — use `severity` instead.
 * Will be removed in v1.0.0.
 */
@Input() variant?: 'ok' | 'warn' | 'crit';
```

### 3. Entry en `CHANGELOG.md` bajo `### Deprecated`

Toda deprecación se lista en
[`CHANGELOG.md`](../CHANGELOG.md) bajo la subsección `### Deprecated` del
release correspondiente. Formato:

```markdown
### Deprecated

- `<old-api>` — usar `<new-api>` en su lugar. Removal en vX+1.0.0.
  Codemod: `node tools/codemods/<nombre>.mjs`. Ver RFC-NNNN.
```

Cada entry incluye:

- Nombre exacto de la API deprecada.
- Reemplazo concreto (no "ver docs").
- Release objetivo de remoción.
- Path al codemod si existe.
- Link al RFC.

### 4. Drift detector si afecta a `tokens.json`

Para deprecaciones de tokens, `tools/design-tokens/sync.mjs` detecta
drift entre el preset y los artefactos generados (`DESIGN.md`,
`design-tokens/tokens.json`). Cuando un token se deprecar, mantenerlo
en el preset con un alias al token nuevo durante el minor de gracia, y
documentar el alias en el RFC. La remoción borra tanto el alias como el
token original.

### 5. Storybook story con badge `Deprecated`

Si la API tiene story en `src/stories/`, agregar al `meta` de la story
un parámetro que pinte un badge visible:

```typescript
const meta: Meta<MyComponent> = {
  title: 'Primitives/MyComponent',
  parameters: {
    badges: ['deprecated'], // requiere el addon de badges si se adopta
    docs: {
      description: {
        component:
          '**Deprecated en v0.5.0**, removal en v1.0.0. Migrar a ' +
          '`<new-component>`. Ver CHANGELOG.md.',
      },
    },
  },
};
```

(Issue abierto: agregar `@geometricpanda/storybook-addon-badges` cuando
se adopte. Hasta entonces, basta con el bloque de descripción.)

## Reglas operativas

### Mínimo 1 minor de gracia

Una deprecación anunciada en v0.5.0 puede removerse a partir de v0.6.0
(siguiente minor) o posterior. **No** se puede remover en v0.5.1 (patch)
ni en v0.5.0 mismo. Si la urgencia es real, considerar un workaround
temporal en lugar de violar el contrato.

### Una deprecación, un RFC

No bundlear múltiples deprecaciones ortogonales en un solo RFC.
Excepción: deprecaciones consecuencia obvia de una decisión arquitectural
mayor (e.g. cambio de strategy de SSR puede deprecar 3-4 helpers
relacionados). En ese caso, el RFC madre lista todas y cada una se
trackea en el CHANGELOG por separado.

### Breaking sin deprecación previa = bump de major + RFC

Si una API no se puede deprecar por imposibilidad técnica (e.g. el
comportamiento del token es semánticamente incompatible con el nuevo),
eso es un breaking change directo:

1. Requiere RFC con la sección "Migration path" obligatoria y completa.
2. Requiere bump de major en el CHANGELOG.
3. Requiere ADR en `docs/adr/` que documente la decisión.
4. Si se distribuyera el design system fuera del repo (futuro), también
   requeriría release notes destacados y notification a consumers
   conocidos.

### Tests de regresión durante el minor de gracia

Mientras una API esté en estado deprecated, debe tener al menos un test
que pruebe que sigue funcionando. Esto previene remoción accidental
antes del major target.

Para reglas ESLint deprecadas: la regla sigue en `eslint.config.js` con
severity `warn` durante el minor de gracia, y un caso del test suite
verifica el messageId.

Para tokens deprecados: el alias en el preset se cubre con un test del
resolver (`tools/design-tokens/__tests__/`).

Para primitivos deprecados: el `.spec.ts` del componente sigue cubriendo
el comportamiento viejo.

### Quién aprueba

| Tipo de API | Reviewers requeridos |
|---|---|
| Token del preset | RFC + 1 maintainer + 1 design council |
| Primitivo `src/app/shared/components/` | RFC + 1 maintainer + 1 design council |
| Regla ESLint | RFC + 1 maintainer + 1 design council |
| Receta documentada en DESIGN.md | RFC + 2 design council |
| Helper privado | PR + 1 maintainer (no RFC) |

Detalle en [`GOVERNANCE.md`](./GOVERNANCE.md).

## Codemod expectations

Si la deprecación afecta **más de 5 touchpoints** en el repo (medido con
`grep -r` o ESLint count), debe shipearse un codemod en
`tools/codemods/`. Sin codemod, la migración cae sobre los reviewers de
cada PR que toca el código viejo — eso no escala y genera drift.

### Estructura de un codemod

`tools/codemods/` aún no existe en el repo (issue abierto: crear el
directorio en el primer codemod que se necesite). La convención
propuesta para cuando se materialice:

```text
tools/codemods/
  README.md                              ← índice de codemods, cómo correrlos
  YYYY-MM-DD-<rfc-NNNN>-<slug>.mjs       ← un codemod por deprecación
  __tests__/
    YYYY-MM-DD-<slug>.test.mjs           ← fixtures de entrada/salida
```

### Contrato del codemod

Cada codemod debe:

1. **Ser idempotente.** Correrlo dos veces no debe alterar más que la
   primera.
2. **Soportar `--dry-run`.** Mostrar qué cambios haría sin escribir
   archivos. Default debe ser dry-run; `--write` para aplicar.
3. **Soportar `--check`.** Salir con código != 0 si encuentra patrones
   viejos. Permite integrarlo a CI durante el minor de gracia.
4. **Reportar count.** Output final: "N touchpoints encontrados, M
   modificados, K skipped (motivo: ...)".
5. **Preservar formato.** Usar un parser AST (TypeScript Compiler API
   para `.ts`, `@angular/compiler` para templates, regex con cuidado
   para CSS/Tailwind). No reformatear archivos.
6. **Tests con fixtures.** Mínimo 3 fixtures: caso simple, caso con
   variantes, caso que NO matchea (negative test).
7. **Documentación inline.** Header con: RFC asociado, qué hace, edge
   cases conocidos, falsos negativos posibles.

### Ejemplo de invocación esperada

```bash
# Dry-run (default) — preview
node tools/codemods/2026-06-01-rfc-0007-styleclass-to-class.mjs

# Aplicar al repo
node tools/codemods/2026-06-01-rfc-0007-styleclass-to-class.mjs --write

# Check para CI
node tools/codemods/2026-06-01-rfc-0007-styleclass-to-class.mjs --check
```

## Casos del repo

### Ejemplo activo: `showcase/no-deprecated-styleclass`

PrimeNG v20 deprecó el atributo `styleClass` en 53 componentes
(`<p-tag>`, `<p-avatar>`, `<p-table>`, etc.) y recomienda `class` o
`[class]` plano. El repo enforce esta deprecación vía la regla
`showcase/no-deprecated-styleclass` en `tools/eslint/rules/`.

Componentes:

- **ESLint rule** — `tools/eslint/rules/no-deprecated-styleclass.js` con
  el set de 53 selectores. Cubre estáticos (`styleClass="..."`) y
  dinámicos (`[styleClass]="..."`). Excluye sub-element variants
  (`paginatorStyleClass`, `valueStyleClass`) y overlays (`p-drawer`,
  `p-dialog`, `p-popover`, `p-tooltip`, `p-menu`, `p-button`) que
  PrimeNG mantiene.

- **Drift test** — `tools/eslint/rules/__tests__/no-deprecated-styleclass.test.js`
  mantiene el set sincronizado con las type defs de PrimeNG. Si una
  versión nueva de PrimeNG agrega o quita componentes, el test marca
  drift y obliga a actualizar la regla.

- **Documentación** — `docs/rules/no-deprecated-styleclass.md` (regla
  docs por rule).

Esta es la plantilla viva para futuras deprecaciones del mismo tipo:
nueva regla ESLint, test de drift, documentación, entry en CHANGELOG.

## Antipatrones documentados

- **Deprecar y remover en patch.** Violación dura del semver. Si se
  detecta en review, la PR se bloquea sin discusión.
- **Anunciar deprecación sin reemplazo.** Cada deprecación debe apuntar
  a qué hacer en su lugar. Sin reemplazo, no es deprecación — es bug
  report al consumer.
- **Deprecar y no comunicar.** Si solo está en código (JSDoc) y no en
  CHANGELOG ni en regla ESLint, los consumers no se enteran. Los tres
  vehículos cuentan.
- **Codemods que reformatean.** Los reviewers se ahogan en diffs
  irrelevantes y el codemod pierde credibilidad. Si el formato es
  problema, abrir issue de formato aparte.
- **"Soft deprecation" indefinida.** Sin fecha de remoción concreta, la
  deprecación nunca se ejecuta y el código viejo se mantiene para
  siempre. Toda entry debe nombrar el major target.
