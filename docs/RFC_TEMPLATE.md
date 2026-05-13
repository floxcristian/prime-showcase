---
rfc: NNNN
title: Título corto e imperativo (max 60 chars)
author: Nombre Apellido <email@dominio> (+ co-autores con coma)
status: draft
created: YYYY-MM-DD
# accepted: YYYY-MM-DD          # rellenar al cambiar a status: accepted
# supersedes: NNNN               # rellenar si reemplaza un RFC previo
# superseded-by: NNNN            # rellenar si es reemplazado en el futuro
---

# RFC-NNNN: Título largo

> Plantilla para Request For Comments del proyecto `prime-showcase`.
> Inspirada en Rust RFCs (rust-lang/rfcs) y React RFCs (reactjs/rfcs),
> adaptada al scope de un design system + app Angular.
>
> **Antes de empezar:** leer [`CONTRIBUTING.md`](../CONTRIBUTING.md)
> sección "Cuándo se requiere un RFC" para confirmar que tu cambio lo
> necesita. La mayoría de las contribuciones NO requieren RFC.
>
> **Cómo usar esta plantilla:**
> 1. Copiar este archivo a `docs/rfc/NNNN-titulo.md` (placeholder N para
>    el número, asignado al merge).
> 2. Llenar todas las secciones obligatorias. Las opcionales se marcan.
> 3. Borrar este bloque de instrucciones antes de abrir la PR.
> 4. Seguir el flujo de RFC documentado en `CONTRIBUTING.md`.

## Resumen

Una a tres oraciones que un reviewer pueda escanear en 30 segundos para
entender qué propone el RFC. Si necesitás más de tres oraciones,
probablemente el resumen está mezclando motivación o diseño — moverlos a
sus secciones correspondientes.

Ejemplo bueno:
> Proponemos agregar una capa semántica `system.motion.*` al preset Aura
> que centralice los tokens de duración y easing actualmente hardcodeados
> en clases Tailwind. Habilita consumo desde ESLint, Figma y futuros
> repos sin tocar templates.

## Motivación

¿Qué problema resuelve este RFC? Tiene que estar grounded en evidencia
del repo:

- Citas a archivos concretos con `path:linea` donde el problema aparece.
- Métricas si las hay (bundle size, conteo de violaciones ESLint, time on
  task, etc.).
- Patrones existentes que demuestran la ausencia de la solución
  propuesta.

Si la motivación es "consistencia con la industria", citá qué hace Polaris,
Carbon, Primer o Lara — pero el caso debe pararse también sin esa cita,
porque copiar no es razón suficiente.

**Anti-pattern:** "queda más prolijo", "es buena práctica", "todos lo
hacen". Insuficiente.

## Diseño detallado

La sección más larga del RFC. Tiene que ser ejecutable: un implementador
debería poder convertir esto en código sin tener que tomar decisiones
adicionales de diseño.

Incluir según aplique:

### Token diffs

Si el RFC modifica `src/app/app.preset.ts` o
`design-tokens/tokens.json`, pegar el diff exacto en bloque ```diff:

```diff
   semantic: {
+    motion: {
+      duration: { fast: '120ms', base: '180ms', slow: '240ms' },
+      easing: {
+        standard: 'cubic-bezier(0.2, 0, 0, 1)',
+        decelerate: 'cubic-bezier(0, 0, 0.2, 1)',
+      },
+    },
     primary: { 500: '#0074c2', ... },
   }
```

Incluir el output esperado de `design-tokens/tokens.json` post-cambio.

### API pública

Si el RFC introduce un primitivo nuevo en `src/app/shared/components/`,
documentar:

- Inputs (tipo, default, required vs opcional, validación).
- Outputs (cuándo emiten, payload, frecuencia).
- Slots / templates (qué se proyecta, en qué orden).
- Variantes (props enum + ejemplos por variante).
- Estados internos (loading, disabled, invalid, focus).
- Comportamiento de accesibilidad (roles ARIA, navegación de teclado).

Mínimo un ejemplo de uso en cada variante.

### Reglas ESLint

Si el RFC agrega o modifica una regla en `tools/eslint/rules/`,
documentar:

- `messageId` y mensaje al usuario (en español, accionable).
- Casos `valid` (mínimo 5 ejemplos).
- Casos `invalid` (mínimo 5 ejemplos con la corrección esperada).
- Excepciones documentadas (scope files en `eslint.config.js`).
- Si la regla deprecar algo, link al `CHANGELOG.md` entry.

### Cambios en governance docs

Si el RFC modifica `CONTRIBUTING.md`, `GOVERNANCE.md` o `DEPRECATION.md`,
incluir el diff completo de la sección afectada. Cambios en governance
nunca van "aplicados directo" — se discuten en el RFC primero y se
aplican en el PR de implementación.

## Alternativas consideradas

Al menos dos alternativas viables, cada una con:

- Descripción de la alternativa.
- Por qué se rechazó (cita concreta, no genérica).

Si no se consideraron alternativas, el diseño probablemente está
prematuro o el problema no está bien entendido — pausar y pensar.

Una alternativa siempre válida y casi siempre rechazable: "no hacer
nada". Documentar por qué status quo no es aceptable.

## Drawbacks

Costos honestos de adoptar este RFC. No filtrar — un reviewer que
detecta un drawback no mencionado va a perder confianza en el resto del
análisis.

Categorías típicas:

- **Complejidad agregada** — más superficie API, más conceptos a
  aprender, más cosas que pueden fallar.
- **Maintenance burden** — quién mantiene esto, qué pasa si el autor se
  va.
- **Backward compatibility** — qué se rompe, qué APIs cambian.
- **Bundle size** — números concretos vía `bundle:check` si se puede
  estimar.
- **Migration cost** — cantidad estimada de touchpoints y horas humanas
  para adoptarlo.
- **Performance** — runtime cost, CLS impact, hydration cost.

## Adoption strategy

Cómo se rolea el cambio una vez aceptado. Plan ejecutable:

1. **Phase 0 (prep):** infra necesaria — codemod, helper, feature flag,
   nueva regla ESLint en `warn`.
2. **Phase 1 (opt-in):** disponible y documentado, pero no obligatorio.
   Storybook story de demo, sección en DESIGN.md.
3. **Phase 2 (default):** nuevo código usa el patrón nuevo. Reviewers
   piden migración en PRs que tocan código viejo.
4. **Phase 3 (enforced):** regla ESLint en `error`. Codemod corrido
   automatizado contra el repo entero (PR aparte).
5. **Phase 4 (clean-up):** deprecación del patrón viejo según
   [`DEPRECATION.md`](./DEPRECATION.md). Remoción en el siguiente major.

Cada phase con criterio de salida claro. Si un phase no tiene criterio,
es probable que sea un wishlist y no un plan.

## Migration path

Pasos concretos para mover código existente al patrón nuevo. Si la
migración tiene > 5 touchpoints, **debe shipearse un codemod en
`tools/codemods/`** (ver [`docs/DEPRECATION.md`](./DEPRECATION.md)
"Codemod expectations").

Incluir:

- Patrón viejo → patrón nuevo (snippet de antes/después).
- Comando de codemod: `node tools/codemods/<nombre>.mjs --dry-run`.
- Cantidad estimada de touchpoints en el repo actual (output de un
  `grep -r` cuenta).
- Cómo detectar regresiones post-migración (ESLint rule, visual test,
  unit test).

Si el cambio es backward-compatible con un alias o adapter, documentar
el plan para retirar el alias en el siguiente major.

## Unresolved questions

Lista numerada de decisiones que el RFC deja abiertas explícitamente.
Cada una con:

- Pregunta concreta (no "qué hacemos con X").
- Por qué no se decidió ahora (no hay datos suficientes, depende de otro
  RFC, etc.).
- Cuándo / cómo se va a decidir (siguiente RFC, post-mortem de la
  adopción, milestone X).

Es preferible una lista larga de unresolved questions explícitas que un
RFC que pretende cerrar todos los detalles y termina debatiendo lo no
discutido en PRs de implementación.

## Referencias (opcional)

- ADRs relacionados: `docs/adr/NNN-titulo.md`.
- RFCs previos relacionados o superseded.
- Issues o PRs externos del proyecto.
- Documentación de referencia industria: Polaris, Carbon, Primer, Lara,
  Material, etc.

---

## Apéndices (opcional)

Material de soporte que no entra en el flujo principal: benchmarks,
mockups, mediciones de adopción esperada, mapas de archivos afectados,
discusiones laterales que cerraron una alternativa.

Mantener acá lo que un reviewer NO necesita leer para aprobar, pero que
un implementador SÍ necesita para ejecutar.
