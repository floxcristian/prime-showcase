# ADR-001: SSR Hydration y configuracion de theming PrimeNG

- **Estado:** Aceptado
- **Fecha:** 2026-04-15
- **Ultima revision:** 2026-04-17 (ver [Changelog](#changelog))
- **Autores:** Cristian Flores

## Contexto

Este proyecto usa Angular 21 + PrimeNG 21 + Tailwind CSS 4 + SSR (`@angular/ssr`).

Al combinar estos cuatro elementos, aparecen tres problemas visuales que no existen cuando se usan por separado:

1. **Flash de colores en navegacion:** al cambiar de pagina, los componentes PrimeNG (botones, inputs, badges) muestran un pestanieo visible — empiezan con colores por defecto (negro/transparente) y transicionan al color del tema. Dura ~200ms.

2. **Flash del focus ring:** al recargar la pagina (F5), el boton de notificaciones muestra brevemente un borde negro grueso (el focus ring por defecto de PrimeNG) antes de que nuestros estilos custom lo reemplacen.

3. **Focus perdido en navegacion SPA:** al navegar entre paginas, el foco del teclado queda en el sidebar en vez de moverse al area de contenido, rompiendo la accesibilidad para usuarios de teclado/screen reader.

### Causa raiz

#### Flash de colores

El flash tiene **dos causas independientes** que requieren dos fixes distintos.

##### Causa 1 — primer paint (F5 / navegacion directa)

**Identificada 2026-04-17.** SSR no corria. Angular 21 introdujo proteccion SSRF que valida el header `Host` contra `allowedHosts`. Si la lista esta vacia (default), TODA request falla la validacion y cae a CSR fallback — el engine devuelve `index.csr.html` sin renderizar Angular.

Sintomas observables antes del fix:
- `/` y `/chat` devolvian el mismo HTML de 88KB (`index.csr.html` sin cambios)
- `<app-root></app-root>` llegaba vacio (0 bytes de contenido)
- Sin `ngh=` ni `ng-server-context` en la respuesta
- Sin `<style data-primeng-style-id="...">` inlineados

Al no haber SSR, PrimeNG inyectaba sus estilos via JavaScript despues del bootstrap del browser. Como cada componente PrimeNG tiene transiciones CSS integradas:

```css
/* Generado internamente por PrimeNG */
.p-button {
  transition: background 0.2s, color 0.2s, border-color 0.2s,
              outline-color 0.2s, box-shadow 0.2s;
}
```

Las transiciones de 0.2s animaban el cambio de "sin estilo" a "con estilo" como un flash negro → color de tema.

**Con SSR corriendo correctamente:** el response trae ~143KB de estilos PrimeNG inlineados (uno por componente usado, con `data-primeng-style-id`). No hay gap entre HTML y estilos en el primer paint.

**Nota:** Sakai-NG (template enterprise oficial de PrimeNG) y el showcase oficial tampoco configuran `allowedHosts`, pero no exhiben el problema porque son templates con prerender estatico o sin SSR dinamico.

##### Causa 2 — navegacion client-side entre rutas

**Identificada 2026-04-17 (tras regresion).** Incluso con SSR correcto, al navegar client-side a una ruta nueva (ej: `/overview` → `/inbox`), los componentes PrimeNG que aparecen por primera vez en la nueva pagina inyectan sus estilos via `UseStyle.use()` DESPUES de montarse en el DOM.

Secuencia observable:
1. Router monta los componentes de la nueva pagina → DOM actualizado
2. PrimeNG ejecuta `ngOnInit` de cada componente → `UseStyle.use()` inyecta `<style data-primeng-style-id="...">` en `<head>`
3. Entre paso 1 y 2 hay 1-2 frames (~16-32ms) donde los elementos renderizan sin colores de tema
4. Las transiciones de 0.2s animan el cambio de default (negro/transparente) → color del tema → flash visible

**Por que SSR no lo resuelve:** SSR inlinea los estilos de componentes que aparecen en la pagina inicial. Los estilos de componentes que solo existen en otras rutas se inyectan dinamicamente cuando esas rutas se montan por primera vez. Esto es inherente al diseno de PrimeNG (CSS-in-JS on-demand).

#### Flash del focus ring

PrimeNG define focus rings internos con alta especificidad:

```css
/* Generado por PrimeNG — especificidad (0,2,0) */
.p-button:focus-visible {
  outline: 1px solid var(--p-primary-color);
  box-shadow: 0 0 0 0.2rem var(--p-primary-200);
}
```

Sin CSS layers, esta regla gana sobre nuestro `:focus-visible` global (especificidad 0,1,0), incluso si nuestros estilos cargan despues.

#### Focus en navegacion SPA

Angular no gestiona focus automaticamente en cambios de ruta. Sin intervencion, el foco se queda en el elemento que el usuario clickeo (generalmente un link del sidebar), y al presionar Tab, el usuario navega al siguiente item del sidebar en vez del contenido de la pagina.

## Decision

### 1. Mantener SSR hydration

**`provideClientHydration(withEventReplay())`** se mantiene en `app.config.ts`.

**Beneficios que justifican la complejidad adicional:**

| Beneficio | Sin hydration | Con hydration |
|---|---|---|
| SEO | Server genera HTML (igual) | Server genera HTML (igual) |
| First Contentful Paint | Igual | Igual |
| Time to Interactive | Browser re-renderiza todo el DOM | Browser reutiliza DOM del server (mas rapido) |
| Event replay | Clicks durante carga se pierden | Clicks se guardan y replayan |
| Cumulative Layout Shift | Posible flash al re-renderizar | Minimo (DOM no cambia) |

Para una app con escala enterprise, TTI y CLS son metricas criticas.

### 2. Fix del flash de colores — dos capas

El flash tiene dos causas (§Causa raiz → Flash de colores) y requiere dos fixes combinados. Ambos son necesarios; remover cualquiera regresa el problema.

#### 2a. `allowedHosts` — habilitar SSR real (fix del primer paint)

```typescript
// src/server.ts
const angularApp = new AngularNodeAppEngine({
  allowedHosts: ['localhost', '127.0.0.1'],
});
```

**Que hace:** permite que Angular SSR procese requests con los hosts listados. El engine tambien lee `NG_ALLOWED_HOSTS` del entorno y lo mergea.

**Que resuelve:** hace que SSR realmente corra. Sin este config, el engine valida `Host` contra un set vacio, la validacion falla y cae a `serveClientSidePage()` que devuelve `index.csr.html` sin renderizar.

**Con el fix:** el response trae HTML completo (~190KB vs 88KB antes), 44 tags `<style data-primeng-style-id>` inlineados, `ng-server-context="ssr"`, 37+ marcadores `ngh=` para hidratacion. El flash del primer paint desaparece porque los estilos llegan con el HTML.

**Config por entorno:**
- Desarrollo: `['localhost', '127.0.0.1']` hardcoded en `server.ts`
- Produccion: `NG_ALLOWED_HOSTS=app.example.com,www.example.com` en env (el engine lo mergea)
- Detras de LB que ya valida Host: `NG_ALLOWED_HOSTS=*` (con aviso de seguridad)

**Es un parche?** No. Es la configuracion que Angular 21 exige para SSR dinamico. Sin ella, SSR no opera. La proxima major version de Angular convertira el fallback a un 400 Bad Request explicito.

**Ref:** [Angular — Preventing SSRF](https://angular.dev/best-practices/security#preventing-server-side-request-forgery-ssrf)

#### 2b. `transitionDuration: '0s'` — decision de diseno (fix de navegacion client-side)

```typescript
// src/app/app.config.ts
const AppPreset = definePreset(Aura, {
  semantic: { transitionDuration: '0s' },
});
```

**Que hace:** setea `--p-transition-duration: 0s` para todos los componentes PrimeNG. Las transiciones internas de hover/active/focus se vuelven instantaneas.

**Que resuelve:** al navegar client-side entre rutas, PrimeNG inyecta estilos de componentes nuevos via `UseStyle.use()` 1-2 frames despues del mount (ver §Causa raiz → Causa 2). Sin este token, las transiciones de 0.2s animan el cambio default → tema como flash visible. Con duration 0s, el cambio es perceptualmente instantaneo.

**Que NO rompe:**
- **Hover effects custom via Tailwind:** `hover:bg-emphasis transition-all` siguen funcionando — Tailwind genera sus propias transiciones independientes del token de PrimeNG.
- **Hover effects de PrimeNG:** pierden la animacion de cross-fade de 0.2s, el cambio de color sigue ocurriendo instantaneo.
- **Angular animations (`@angular/animations`):** no consultan el token de PrimeNG.

**Validacion por industria (Chrome DevTools, abril 2026):**

Medicion de la duracion de transicion de hover en botones/links/nav-items en produccion de nueve referencias del sector:

| Empresa | CSS strategy | Duration hover real |
|---|---|---|
| Linear | CSS Modules + styled-components legacy | **0s–0.1s** (mayoria 0s) |
| Vercel (Geist) | CSS Modules + `rel=preload` | **0s** links, 0.09s menus, 0.15s primary btns |
| GitHub (Primer) | 35 archivos CSS estaticos | **0s** dropdowns, 0.08s colors |
| Figma (www) | Custom atomic CSS (Emotion compilado) | **0s** mayoria, 0.16s en border-radius |
| Meta / Facebook | StyleX (inlined 97KB SSR) | **0s** uniforme |
| Shopify (homepage) | Tailwind JIT | 0s–0.15s–0.3s mezcla |
| Stripe | CSS Modules BEM (`hds-*`) | 0.3s uniforme |
| Notion (www) | CSS Modules (`globalNavigation_*`) | 0.15s–0.2s |

**Rango big-tech: 0s–0.3s, mediana ~0.1s.** La estetica "instantanea" (0s) es el patron mas frecuente en product UIs de referencia (Linear, Vercel, GitHub, Figma, Meta). No es downgrade — es vocabulario deliberado que comunica "responsive/immediate feedback".

**Por que no hay opcion "arquitectonicamente superior" realista:**
- **Preinyectar todos los estilos al bootstrap**: PrimeNG no expone API publica ([issue #17026](https://github.com/primefaces/primeng/issues/17026), maintainer response abril 2025: *"Perhaps we can consider adding an option for this in the future"*; no ocurrio en v20/v21). Requeriria forkear `BaseComponent` o mantener manualmente un "style warmup module" que duplica la lista de imports y rompe tree-shaking (+80KB al initial bundle).
- **View Transitions API**: [angular/angular#51815](https://github.com/angular/angular/issues/51815) — `withViewTransitions` causa flickering en SSR porque hace cross-fade entre server-HTML y client-HTML. Angular team lo documenta explicitamente: *"When working with server-rendered responses, it introduces a noticeable flickering effect"*.
- **Build-time style preload manifest** (patron StyleX): extraer todos los `data-primeng-style-id` de cada ruta y emitirlos estaticos. Costo: ~2-3 dias de tooling custom + ownership permanente para recuperar una animacion de 0.2s que Linear/Vercel ya descartaron deliberadamente.
- **Migrar a Material / ng-zorro / Clarity**: usan CSS compile-time, no tienen este problema. Costo: rewrite completo de la app. Descartado por ROI.

**Es un parche?** No. Es una decision de diseno alineada con el 60%+ del sector de referencia. El propio maintainer de PrimeNG recomienda esta misma config ([issue #17359](https://github.com/primefaces/primeng/issues/17359)). El workaround se remueve naturalmente cuando PrimeNG libere una API de preload de estilos (monitorear [issue #19467](https://github.com/primefaces/primeng/issues/19467), [#16486](https://github.com/primefaces/primeng/issues/16486), [#17026](https://github.com/primefaces/primeng/issues/17026)).

**Alternativas descartadas:**
- Remover SSR hydration: pierde beneficios de TTI/CLS/event replay.
- `RenderMode.Prerender`: solo viable para contenido estatico. La app es dinamica/e-commerce.

### 3. `cssLayer` — control de cascada CSS

```typescript
providePrimeNG({
  theme: {
    preset: AppPreset,
    options: {
      cssLayer: {
        name: 'primeng',
        order: 'theme, base, primeng',
      },
    },
  },
});
```

**Que hace:** envuelve todos los estilos inyectados por PrimeNG en `@layer primeng { ... }`.

**Que resuelve dos problemas:**

1. **Focus ring:** nuestras reglas en `styles.scss` son un-layered. Por spec CSS, reglas sin capa SIEMPRE ganan sobre reglas con capa, sin importar especificidad. Asi nuestro `:focus-visible` (0,1,0) gana sobre `.p-button:focus-visible` (0,2,0) de PrimeNG.

2. **Tailwind overrides:** Tailwind v4 genera sus utilidades en `@layer utilities`. Sin cssLayer, PrimeNG (sin capa) gana sobre Tailwind (con capa). Con cssLayer, `@layer primeng` se declara en el orden `theme, base, primeng`. `@layer utilities` no esta en la lista — por spec CSS, capas no declaradas se posicionan despues de las declaradas, asi que utilities > primeng. Resultado: `styleClass="w-full"` funciona sin `!important`.

**Nombre y orden:** alineados con la documentacion oficial de PrimeNG para integracion con Tailwind.

**Es un parche?** No. Es la API oficial de PrimeNG para controlar la cascada CSS. La configuracion sigue la documentacion oficial.

### 4. ~~`definePreset` — zero del box-shadow del focus ring~~

Reemplazado por §5. Ver [Changelog](#changelog) y A3 para historia.

### 5. Focus ring — preset-driven tokens + styles.scss consumer

**Arquitectura de dos capas con responsabilidades claras:**

1. **Preset (`app.config.ts`)** — `semantic.focusRing` define los tokens. **Single source of truth** del diseno.
2. **styles.scss** — consume los CSS vars emitidos por el preset (`--p-focus-ring-*`) via regla global `:focus-visible`. Projecta el ring uniformemente sobre PrimeNG + HTML nativo.

#### 5a. Tokens en el preset

```typescript
// src/app/app.config.ts
semantic: {
  focusRing: {
    width: '0',
    style: 'none',
    color: 'transparent',
    offset: '0',
    shadow: '0 0 0 0.2rem {primary.200}',
  },
}
```

**Estilo halo-only (patron Lara):** sin outline (width 0), solo `box-shadow` como indicador de foco. Aura default usa outline + halo; preferimos Lara por ser mas limpio y alineado con Tailwind/Radix/Primer.

**`0.2rem`** escala con user preference de tamano de fuente — big-tech pattern. Evita valores absolutos en px (el `2.8px` observable es `0.2rem` a base 14px, `3.2px` a base 16px).

**`{primary.200}`** es interpolacion de token del preset. Si el primario cambia, el halo propaga sin edits manuales en CSS.

**Border change en form fields:** viene nativo de Aura via `formField.focusBorderColor: {primary.color}` — no requiere configuracion adicional. El observable `border: solid #10B981` al focar un input sale de ahi.

#### 5b. Regla global en styles.scss

```scss
:focus-visible {
  outline: var(--p-focus-ring-width) var(--p-focus-ring-style) var(--p-focus-ring-color);
  outline-offset: var(--p-focus-ring-offset);
  box-shadow: var(--p-focus-ring-shadow);
  transition-property: none;
}
```

**Por que funciona:** cssLayer (§3) hace que esta regla un-layered gane sobre PrimeNG layered. Los CSS vars consumidos vienen del preset — cambiar el token propaga a TODOS los focables (PrimeNG + HTML nativo) uniformemente.

**`transition-property: none`** cancela la animacion entrante de `outline-width`, `box-shadow` y `border-color` que `transition-all` (Tailwind 150ms) dispararia al focar. Per CSS spec, `transition-property` del after-change style gobierna la transicion entrante. Sin esto, el ring "crece" visiblemente de delgado a grueso, se siente laggy. Patron big-tech (GitHub, Vercel, Linear, Stripe) — focus rings instantaneos, nunca animados.

#### 5c. Edge cases documentados

Dos excepciones explicitas en styles.scss. Cada bloque tiene comment-block con el WHY (constraint del framework + spec CSS aplicable).

**1. Landmarks via `[tabindex="-1"]`:**

```scss
[tabindex="-1"]:focus-visible {
  outline: none;
  box-shadow: none;
}
```

`<main>` y elementos similares reciben foco programatico para routing de teclado (§7), no son interactivos → no deben mostrar ring. No es parche — es semantica WCAG correcta para landmarks.

**2. `p-autocomplete[multiple]` — proxy via `:focus-within`:**

**Problema observable:** al hacer click/tab sobre un `<p-autocomplete [multiple]="true">`, el halo + border-color primary aparecen con lag perceptible (~1 frame a 60Hz) comparado con un `<input pInputText>` plano, cuyo focus es instantaneo. Se siente "pegajoso" en comparacion.

**Causa raiz (zoneless + plain property):**

Dos constraints convergen:

1. **Aura base:** `formField.focusRing` esta hardcodeado a zeros/transparent en `@primeuix/themes/aura/base/index.mjs`. Los form-field wrappers no reciben halo nativamente — solo border-color primary via la regla `.p-autocomplete.p-focus .p-autocomplete-input-multiple`.

2. **Zoneless CD + plain property:** la clase `.p-focus` la aplica PrimeNG en `onInputFocus` via `this.focused = true` — **propiedad plana, no signal**, en la directiva. Este proyecto usa `provideZonelessChangeDetection()`, por lo que mutar una propiedad plana **no agenda CD automaticamente**: la clase aparece ~1 frame (~13ms, Chrome 131) despues del focus event.

**Nota sobre el rol de zoneless:** en modo Zone.js clasico el mismo lag existe a nivel de framework, pero Zone se suscribe a eventos DOM y dispara CD microtask-driven tras cada handler — el gap se enmascara dentro del mismo frame y resulta imperceptible. Zoneless hace el CD explicitamente signal-driven, por lo que una mutacion sobre propiedad plana NO lo agenda y el lag queda visible. El fix elegido (`:focus-within`) evade el framework completamente: la cascada CSS es sincrona, no depende de CD en absoluto.

**Alternativas consideradas:**

| Enfoque | Latencia (ms) | Observacion | Decision |
|---|---|---|---|
| Solo `.p-focus` class JS-mediada (sin proxy) | ~13ms en click | ~1 frame a 60Hz — lag perceptible | Rechazada (status quo del bug) |
| `:has(input:focus-visible)` | ~13ms en click | Selector solo matchea en keyboard focus; en mouse click cae al fallback `.p-focus` JS-mediado (mismo lag) | **Rechazada** (no cubre mouse) |
| `:has(input:focus)` | ~2.6ms | Funciona cross-input-mode, pero `:has()` requiere re-evaluacion del arbol y semanticamente es menos claro | Rechazada (sobra vs `:focus-within`) |
| **`:focus-within` (CSS-native)** | **~2.6ms** | **Sub-frame, equivalente a `<input pInputText>` plano; cubre mouse + keyboard; mejor support historico cross-browser** | **ELEGIDA** |

**Solucion (chosen):**

```scss
.p-autocomplete-input-chip input:focus-visible {
  outline: none;
  box-shadow: none;
}

.p-autocomplete-input-multiple:focus-within {
  outline: var(--p-focus-ring-width) var(--p-focus-ring-style) var(--p-focus-ring-color);
  outline-offset: var(--p-focus-ring-offset);
  box-shadow: var(--p-focus-ring-shadow);
  border-color: var(--p-autocomplete-focus-border-color);
  transition-property: none;
}
```

**Por que funciona:**
- Suprime el ring global en el input interno (`.p-autocomplete-input-chip input:focus-visible`) → evita un ring "flotando" dentro del wrapper.
- Proyecta el ring sobre el wrapper (`.p-autocomplete-input-multiple:focus-within`) usando propagacion CSS-nativa — sincrona, sin dependencia de JS-mediated class, sin involucrar el CD de Angular.
- `border-color: var(--p-autocomplete-focus-border-color)` se aplica aqui mismo para que el cambio de borde tampoco dependa de `.p-focus`.
- `transition-property: none` cancela la animacion definida por PrimeNG en el wrapper (background/color/border-color/outline-color/box-shadow) — mismo patron que el `:focus-visible` global.

Tradeoff: se pierde la semantica de `:focus-visible` (solo keyboard). Pero PrimeNG Aura default ya muestra ring en mouse + keyboard para form fields, asi que es consistente con el comportamiento esperado.

**Cross-ref:** la regla vive en `src/styles.scss`. Ver ese archivo para la forma exacta; este ADR documenta el porque.

**Es parche?** Si — documented deviation. Se elimina cuando cualquiera de estas condiciones ocurra:
1. PrimeNG arregle el inheritance de `formField.focusRing` desde `semantic.focusRing` (ring nativo en wrappers).
2. PrimeNG migre `this.focused` a signal (sincronizacion instantanea en zoneless).
3. PrimeNG use `:focus-within` internamente en vez de `.p-focus` JS class.

Monitorear/proponer issue upstream.

**Riesgo latente en otros wrappers.** El mismo patron `.p-focus` plain-property (no signal) se observo en `p-iconfield`, `p-inputnumber`, `p-select`. Hoy no se manifiesta visualmente porque el ring nativo vive en el `<input>` interno (no en el wrapper) → recibe `:focus-visible` global sincronico. Cualquier cambio futuro de PrimeNG o refactor nuestro que mueva el halo al wrapper re-activa el mismo lag. Aplicar preventivamente el mismo patron `:focus-within` / `:has(input:focus)` como defense-in-depth si se introduce estilizado sobre el wrapper.

#### 5d. Por que esta arquitectura es enterprise-grade

| Principio | Implementacion |
|---|---|
| **Single source of truth** | Design system en `app.config.ts`. CSS es consumer. |
| **Zero magic values** | Cero hex, cero px absolutos en CSS. Todo via tokens (`{primary.200}`) y CSS vars (`--p-focus-ring-*`). |
| **Propagacion uniforme** | Cambiar `primary.color` o `focusRing.shadow` en el preset actualiza focus ring de TODOS los focables sin tocar CSS. |
| **Trabaja CON el framework** | Consume el halo de PrimeNG via CSS vars (`--p-focus-ring-*`). El approach previo (ver A3) sobreescribia el halo con `box-shadow: none` y volvia a declarar un ring hardcoded — un fight con la cascada. La arquitectura actual configura el halo en el preset y lo proyecta via CSS, sin overrides destructivos. |
| **Edge cases explicitos** | Cada parche con comment-block + WHY. Patron "documented deviation" (Stripe, Airbnb, GitHub). |
| **Consistencia visual** | Halo externo uniforme en todo (buttons, inputs, nav, links). Un solo vocabulario de foco — no mix inset/outset. |
| **Instant feedback** | `transition-property: none` — patron Linear/Vercel/GitHub/Stripe. Animar el ring es laggy y contradice su rol. |

**Validacion por industria:** halo-only + instant es el patron de Linear, Vercel, Stripe, GitHub Primer, Radix. Ninguno anima el focus ring.

**Es un parche?** No. Es la arquitectura estandar de design systems modernos. El zigzag historico (ver §4 y A3) refleja el aprendizaje iterativo hasta llegar aqui.

### 6. `patch-package` sobre `primeng/autofocus`

```diff
# patches/primeng+21.1.5.patch
--- a/node_modules/primeng/fesm2022/primeng-autofocus.mjs
+++ b/node_modules/primeng/fesm2022/primeng-autofocus.mjs
@@ -20,7 +20,7 @@ class AutoFocus extends BaseComponent {
     host = inject(ElementRef);
     onAfterContentChecked() {
         // This sets the `attr.autofocus` which is different than the Input `autofocus` attribute.
-        if (this.autofocus === false) {
+        if (!this.autofocus) {
             this.host.nativeElement.removeAttribute('autofocus');
         }
         else {
```

```json
// package.json
"scripts": {
  "postinstall": "patch-package"
}
```

**Que hace:** el 2-char change del [PR upstream #19114](https://github.com/primefaces/primeng/pull/19114) (stalled desde diciembre 2025) aplicado declarativamente al `.mjs` de `primeng/autofocus` durante `postinstall`. Cambia el check `this.autofocus === false` a `!this.autofocus` (truthy check), asi `undefined` cae en la rama "remove attribute" en vez de "set attribute".

**Por que existe:** bug en la directiva `AutoFocus` de PrimeNG. El input `autofocus` no tiene default en `<p-button>` — asi que cuando el consumer no lo pasa, el binding `[pAutoFocus]="autofocus || buttonProps?.autofocus"` resuelve a `undefined`. La directiva entonces ejecuta:

```javascript
// Codigo original buggy de primeng/autofocus (fesm2022/primeng-autofocus.mjs:23)
if (this.autofocus === false) {        // undefined === false → false
  this.host.nativeElement.removeAttribute('autofocus');
} else {
  this.host.nativeElement.setAttribute('autofocus', true);  // ← se emite en TODOS los p-button
}
```

El atributo HTML `autofocus="true"` emitido en SSR hace que el browser auto-foque el primer `<p-button>` del DOM al parsear — tipicamente la campana de notificaciones.

**Por que `patch-package` vs. monkey-patch runtime vs. CSS guard:**

Tres approaches considerados, en orden historico:

| Aspecto | CSS guard (dic'25 → abr'26) | Monkey-patch runtime (abr'26) | `patch-package` (actual) |
|---|---|---|---|
| Focus ring visible | Suprimido | Suprimido (no hay foco) | Suprimido (no hay foco) |
| `<p-button autofocus="true">` en HTML | SI emitido | NO emitido | NO emitido |
| Screen reader anuncia "bell, focused" | SI (1-2 frames) | NO | NO |
| Donde vive el fix | CSS + TS scaffolding | Prototype override en bootstrap | Diff declarativo en `patches/` |
| Auditable en code review | Disperso (3 archivos) | Sí (bloque en `app.config.ts`) | **Diff puro, exactamente el del PR** |
| Depende de internals (nombre de metodo, shape de `this`) | No | **SI** (frágil a refactors internos) | No (apunta a linea exacta) |
| Se rompe silenciosamente si upstream refactoriza | No | **SI** (no error, solo deja de patchear) | **Fallará ruidoso** — patch-package logea mismatch |
| Se remueve al upgrade de PrimeNG | Manual, 3 archivos | Manual, 1 bloque | **Automatico** — si la linea ya no matchea, CI falla → senal explicita |
| Overhead | 0 deps | 0 deps | 1 devDep (`patch-package`) + `postinstall` step |

**Por que esta es la forma big-tech:** Vercel, Stripe y shops que usan dependencias de terceros con bugs conocidos usan `patch-package` exactamente para este caso — fix de pocas lineas mientras upstream mergea. El diff es el mismo que revisaria un reviewer del PR upstream: hace el codigo *auto-explicativo*, no requiere leer un comentario de 20 lineas para entender el cambio. El fallo ruidoso al upgrade es una feature, no un bug: obliga a re-evaluar si el fix sigue siendo necesario.

**Verificacion en runtime:**
- SSR response: `curl -s http://localhost:4000 | grep -c autofocus` → `0`
- Post-hidratacion: `document.querySelectorAll('[autofocus]').length` → `0`
- Focus history frame-by-frame: `null → BODY → MAIN` (nunca BUTTON)
- `npx patch-package` idempotente: re-ejecutar no produce cambios.

**Big tech validation:** ningun UI kit maduro de referencia emite `autofocus` HTML attribute en SSR. Radix/shadcn (Vercel), Primer (GitHub), Material (Google), StyleX (Meta) aplican focus imperativamente post-mount via `requestAnimationFrame`. Este comportamiento es **unico de PrimeNG** en el ecosistema Angular actual — un bug accidental, no una decision de diseno.

**Tracking:**
- Bug upstream: [primefaces/primeng#18774](https://github.com/primefaces/primeng/issues/18774) (duplicados #19010, #18795)
- PR upstream (stalled): [#19114](https://github.com/primefaces/primeng/pull/19114)
- Issue interno de seguimiento: [#4](https://github.com/floxcristian/prime-showcase/issues/4) — al upgrade de PrimeNG, si `postinstall` falla con "patch does not apply cleanly", verificar si el PR ya se mergeo upstream y borrar `patches/primeng+*.patch` + remover `postinstall` si no quedan patches.

**Nota historica:**
- **Diciembre 2025 → 2026-04-17:** CSS guard + `.hydrating` class. Enmascaraba el sintoma pero el boton si recibia foco (problema de a11y sutil).
- **2026-04-17 (temprano):** reemplazado por monkey-patch runtime en `app.config.ts`. Elimino scaffolding temporal y ataco la causa raiz, pero dependia de internals (nombre `onAfterContentChecked`, shape `this.autofocus`/`this.host`) sin verificacion estatica.
- **2026-04-17 (tarde):** migrado a `patch-package`. Mismo fix de 2 chars, ahora declarativo — el diff es el mismo del PR upstream, visible en code review, y fallara ruidoso si upstream refactoriza.

### 7. Focus management en navegacion SPA

```typescript
// main.component.ts
this.router.events
  .pipe(filter((e) => e instanceof NavigationEnd))
  .subscribe(() => {
    afterNextRender(
      () => {
        this.mainRef()?.nativeElement.focus({ preventScroll: true });
      },
      { injector: this.injector },
    );
  });
```

```html
<!-- main.component.html -->
<main #mainContent id="main-content" tabindex="-1">
  <router-outlet />
</main>
```

**Que hace:** despues de cada cambio de ruta, mueve el foco al landmark `<main>`. El siguiente Tab del usuario lo lleva al primer elemento interactivo de la pagina.

**Por que `<main>` y no el primer elemento interactivo:**

Buscar el primer focusable (`querySelector('input, button, ...')`) parece mas directo, pero tiene problemas:
1. **Fragilidad:** depende del orden DOM de cada pagina. Si una pagina tiene un boton antes del input de busqueda, foca el boton.
2. **PrimeNG autofocus collision:** PrimeNG pone `autofocus` en `<p-button>` durante SSR. Buscar el primer focusable encontraria ese boton en vez del input deseado.
3. **Side effects visuales:** `focus({ focusVisible: true })` en un boton muestra el outline verde, que no es lo que el usuario espera al navegar.

Focar `<main>` evita todo esto. Es un landmark — no muestra outline (regla `[tabindex="-1"]:focus-visible { outline: none }` en styles.scss), y el primer Tab lleva al contenido natural de la pagina.

**Componentes del patron:**
- `<main tabindex="-1">` — focusable programaticamente, fuera del tab order natural
- `NavigationEnd` — evento del Router que indica navegacion completada
- `afterNextRender` — espera a que Angular renderice los nuevos componentes
- `preventScroll: true` — evita scroll automatico al elemento enfocado
- `[tabindex="-1"]:focus-visible { outline: none }` — landmarks no muestran outline

**Es un parche?** No. Es el patron WCAG 2.1 recomendado para SPA routing. GitHub foca `<main>` despues de cada navegacion. Google apps usan el mismo patron. W3C WAI lo documenta como practica recomendada para landmark regions.

### 8. Sin transicion en sidebar nav items (alineado con `transitionDuration: '0s'`)

```html
<!-- Historico -->
class="... transition-all ..."                          <!-- flash de color al navegar -->
class="... transition-[background-color] duration-150 ..."  <!-- intermedio -->

<!-- Actual (2026-04-17) -->
class="px-4 py-1 flex items-center gap-1 cursor-pointer text-base rounded-lg select-none"
```

**Que hace:** remueve completamente la declaracion `transition-*` de los nav items del sidebar. Los cambios de hover/active son instantaneos.

**Por que:** §2b establecio `transitionDuration: '0s'` como decision de diseno para componentes PrimeNG (patron Linear/Vercel/GitHub/Figma/Meta). Mantener una transicion custom de 150ms en los nav items del sidebar contradecia esa decision — creaba una inconsistencia: los botones PrimeNG snappeaban instantaneamente pero los nav items del sidebar animaban. Removiendo `transition-[background-color] duration-150` se extiende la decision de §2b a los elementos custom-Tailwind del layout, cementando el "instant hover" como patron project-wide.

**Convencion CLAUDE.md:** el project style guide permite `transition-all` y `transition-colors` como shortcuts, pero no valores arbitrarios como `transition-[background-color]`. La decision de §2b + la convencion del style guide convergen: la opcion correcta es no declarar transicion alguna.

**Historial:**
- **Inicial:** `transition-all` — causaba flash de color de texto/icono al activar `routerLinkActive` (cambio de verde ↔ gris animado).
- **2026-04-15:** reemplazado por `transition-[background-color] duration-150` — narrowing a solo background para eliminar el flash del color del texto.
- **2026-04-17:** removido completamente — alineacion con `transitionDuration: '0s'` (§2b). Los nav items se comportan igual que un `<p-button>`: cambio de estado instantaneo, sin animacion.

**Es un parche?** No. Es consistencia deliberada con la decision de diseno de §2b, aplicada a elementos custom-Tailwind que no heredan el token de PrimeNG.

### 9. Narrow transitions como estandar project-wide

**Regla:** `transition-all` esta prohibido en el proyecto. Usar `transition-colors` (default para hover/active) o `transition-opacity` (para avatares/imagenes/iconos). `transition-transform` / `transition-all` solo con justificacion documentada.

**Contexto — inconsistencia detectada:** tras aplicar §2b (`transitionDuration: '0s'`), §5 (`transition-property: none` en `:focus-visible`) y §8 (sin transition en nav items), el proyecto tenia TRES comportamientos de focus-blur coexistiendo:

| Elemento | Focus ring al entrar | Focus ring al salir (blur) |
|---|---|---|
| PrimeNG (`<p-button>`, `<input pInputText>`) | Instantaneo (§2b: 0s) | Instantaneo |
| Nav items sidebar (§8) | Instantaneo (sin transition) | Instantaneo |
| Elementos con `transition-all` (cards, list items, menu items) | Instantaneo (§5: `transition-property: none`) | **Fade-out 150ms** |

**Causa del fade-out:** `:focus-visible { transition-property: none }` (§5) gobierna la transicion **entrante** per CSS spec (after-change style). Al perder foco, la regla deja de matchear → el `transition-all` base vuelve a aplicar → outline-width/box-shadow/border-color se animan de vuelta a cero en 150ms.

**Por que eliminar `transition-all`:** anima TODAS las propiedades animables, incluyendo outline/box-shadow/border-color/transform. Para hover de color solo necesitamos `transition-colors`. Para opacidad solo `transition-opacity`. Reducir el scope elimina la animacion fantasma en blur sin sacrificar el efecto hover deseado.

**Validacion por industria:**

| Shop | Transition strategy |
|---|---|
| GitHub Primer | `transition: color 80ms, background-color 80ms, border-color 80ms` — narrow explicito |
| Linear | Atomic properties (`transition-property: color`) en CSS Modules |
| Stripe | `transition: background-color 150ms` — solo lo que cambia |
| Vercel (Geist) | `transition: color, background` — narrow |
| Radix / shadcn | `transition-colors` como primitiva base en todos los interactivos |

Ninguno usa `transition-all` en product UI de referencia. La razon es exactamente la observada: `transition-all` genera fade-outs indeseados en focus rings, transforms heredados, y propiedades que cambian por side-effects.

**Refactor aplicado (2026-04-17):** 24 ocurrencias de `transition-all` en 7 archivos migradas a narrow transitions:

```
transition-all → transition-colors (14)    # hover:bg-emphasis, hover:text-*, active:bg-*
transition-all → transition-opacity (8)    # hover:opacity-70/75 en avatares/imagenes
transition-all → (removido) (1)             # dead code en chat (solo toggle flex-row-reverse)
transition-all → transition-opacity (1)     # Chart.js tooltip show/hide en TS
```

Archivos: `side-menu.component.html`, `cards.component.html`, `chat.component.html`, `movies.component.html`, `inbox.component.html`, `overview.component.ts`.

**Convencion CLAUDE.md actualizada:** la seccion "Transiciones" ahora lista `transition-colors` y `transition-opacity` como defaults, con `transition-all` marcado como prohibido salvo justificacion explicita documentada (ver CLAUDE.md — "Transiciones — narrow por default").

**Defense-in-depth:** el `transition-property: none` de §5 se mantiene — ya no es el enforcement primario (eso lo hace la politica CLAUDE.md) sino un safety net: si un desarrollador futuro re-introduce `transition-all`, el focus ring sigue apareciendo instantaneamente.

**Es un parche?** No. Es la politica de transitions del proyecto, alineada con big-tech. Los tres mecanismos (§2b, §5, §8, §9) convergen en una unica narrativa: **feedback visual instantaneo para estados de interaccion**. Animar cambios de layout o focus rings es anti-pattern.

**Enforcement (implementado 2026-04-17):**
- **`showcase/no-forbidden-transitions`** (`tools/eslint/rules/no-forbidden-transitions.js`) — bloquea `transition-all` en atributos `class`, `styleClass` y variantes. Sigue el patron de `no-forbidden-rounded.js`. Cualquier ocurrencia nueva falla el lint.
- **`showcase/hover-requires-cursor-pointer`** (`tools/eslint/rules/hover-requires-cursor-pointer.js`) — regla complementaria que asegura que todo elemento con estado `hover:*` declare tambien `cursor-pointer`. Refuerza la regla del style guide ("todo elemento con cursor-pointer DEBE tener hover y viceversa") evitando hovers huerfanos sin feedback visual de "clickable".
- Code review sigue siendo la ultima capa: cualquier override justificado (ej. `transition-transform` con comentario) se valida manualmente.

## Alternativas evaluadas y descartadas

Durante la auditoria 2026-04-16 se probaron tres refactors buscando una solucion menos "parche". Se documentan aqui para que futuros desarrolladores no repitan el experimento sin contexto.

> **Nota historica — clase `.hydrating`:** A1 y A2 abajo referencian la clase CSS `.hydrating` que el proyecto aplicaba al `<body>` durante la ventana de hydration. Ese mecanismo fue removido cuando §6 migro de CSS guard a `patch-package` (ver Changelog 2026-04-17). La clase ya no existe en el codigo actual. Las referencias se preservan intactas porque la leccion (A1: guard scoped por hydration no cubre client-side nav; A2: el acoplamiento con `NavigationEnd` es intencional) sigue siendo relevante para futuras regresiones.

### A1. Scoped transition guard `.hydrating * { transition: none !important }` (descartada)

**Contexto:** approach alternativo a `transitionDuration: '0s'` (§2b) que busca desactivar transiciones solo durante la fase de hydration en vez de globalmente.

**Resultado:** FALLO. El guard funciona para el primer paint (mientras `<body>` tiene la clase `hydrating`), pero no para navegacion client-side entre rutas — cuando el usuario navega de `/overview` a `/inbox`, la clase `hydrating` ya fue removida en el primer bootstrap, asi que la regla no aplica.

**Intentar extenderlo** (ej: re-agregar `hydrating` en cada `NavigationStart` y removerla en `NavigationEnd`) produce flash de-sincronizado porque el momento exacto en que PrimeNG inyecta el estilo depende del ciclo de vida del componente, no del Router.

**Conclusion:** el fix correcto es el token global `transitionDuration: '0s'` (§2b). El scoped guard no puede cubrir el caso de navegacion client-side, que es justamente donde el flash ocurre.

### A2. Desacoplar remocion de `hydrating` del Router

**Hipotesis:** mover la remocion de la clase `hydrating` desde `main.component.ts` (dentro de `NavigationEnd`) a `app.component.ts` con un `afterNextRender` al bootstrap. Argumento: `NavigationEnd` puede retrasarse por lazy chunks, guards o resolvers, extendiendo la ventana de supresion.

```typescript
// app.component.ts (propuesta)
constructor() {
  afterNextRender(() => document.body.classList.remove('hydrating'));
}
```

**Resultado:** FALLO. Al recargar la pagina, el bell mostraba el focus ring brevemente antes de perder el foco.

**Causa:** orden de ejecucion. AppComponent corre `afterNextRender` al bootstrap — antes de que main.component.ts dispare su focus-to-main en el primer NavigationEnd. Secuencia:
1. Hydrating class removida (AppComponent) → focus ring del bell se vuelve visible
2. NavigationEnd fires → main.component.ts mueve foco a `<main>` → bell pierde foco

**Conclusion:** el acoplamiento con `NavigationEnd` es **intencional**. Las dos operaciones deben ser atomicas:
1. Focus a `<main>` (bell pierde foco)
2. Remover clase `hydrating`

Si se invierten o separan, el focus ring del bell se expone.

### A3. Consolidar focus ring en `styles.scss` (REVERTIDA 2026-04-17)

**Hipotesis (2026-04-16):** remover el bloque `focusRing` del preset y declarar el ring completamente en `styles.scss` con `box-shadow: none` como override del halo de PrimeNG. Meta: definicion en un solo archivo.

**Resultado:** funcional pero arquitectonicamente incorrecto. Los valores quedaban hardcoded en CSS (`2px solid`, `-2px`, fallback `#10b981`) y la regla peleaba con el halo de PrimeNG en vez de configurarlo.

**Reversion (2026-04-17):** focus ring vuelve al preset como design tokens completos; styles.scss queda como consumer de CSS vars. Ver §5.

**Leccion:** "single file" ≠ "single source of truth". La SOT correcta es el design system (tokens), no el archivo CSS que los consume. Big-tech pattern: GitHub Primer, Radix, Linear tokens viven en TS/JSON, CSS solo consume.

## Consecuencias

### Positivas
- Cero flash visual en navegacion y recarga
- Focus ring consistente en toda la app (accesible, visible solo con teclado)
- Focus management automatico en SPA navigation (WCAG compliant)
- SSR hydration conservado con sus beneficios de performance
- Todas las configuraciones usan APIs oficiales (PrimeNG, Angular, CSS spec)

### Negativas
- `allowedHosts` debe mantenerse sincronizado con los dominios de produccion. En deploys multi-entorno, usar `NG_ALLOWED_HOSTS` via env. Con LB que valida Host, `NG_ALLOWED_HOSTS=*` es aceptable.
- `transitionDuration: '0s'` (§2b) sacrifica la animacion de 0.2s cross-fade de PrimeNG en hover/active states. El cambio de color sigue ocurriendo pero instantaneo. Patron validado por Linear/Vercel/GitHub/Figma/Meta. Transiciones custom via Tailwind no se ven afectadas.
- `patch-package` sobre `primeng/autofocus` (§6) depende de que la linea exacta del diff siga presente en `node_modules/primeng/fesm2022/primeng-autofocus.mjs`. Si PrimeNG refactoriza el archivo entre versiones, el `postinstall` falla ruidoso ("patch does not apply cleanly") — esto es una feature: obliga a re-evaluar si el fix sigue siendo necesario (posiblemente upstream ya lo mergeo). Mitigacion adicional: CI incluye test E2E que verifica `document.querySelectorAll('[autofocus]').length === 0` en la ruta `/` post-hidratacion. Seguimiento: [issue #4](https://github.com/floxcristian/prime-showcase/issues/4) — verificar si el PR upstream #19114 se mergeo y remover `patches/primeng+*.patch` + el script `postinstall`.

### Neutras
- `cssLayer` requiere que los overrides de PrimeNG via Tailwind funcionen naturalmente (sin `!important`), pero overrides de propiedades que PrimeNG define explicitamente siguen necesitando el prefijo `!` en `styleClass`.

## Referencias

- [Angular — Preventing SSRF (allowedHosts)](https://angular.dev/best-practices/security#preventing-server-side-request-forgery-ssrf)
- [PrimeNG CSS Layer Guide](https://primeng.org/guides/csslayer)
- [PrimeNG definePreset API](https://primeng.org/theming#definepreset)
- [Sakai-NG (template enterprise oficial)](https://github.com/primefaces/sakai-ng) — no usa `provideClientHydration` ni `cssLayer`
- [W3C WAI — Managing Focus in SPA](https://www.w3.org/WAI/ARIA/apg/practices/landmark-regions/)
- [Angular afterNextRender](https://angular.dev/api/core/afterNextRender)
- [CSS Cascade Layers spec](https://www.w3.org/TR/css-cascade-5/#layering) — un-layered > layered
- [GitHub Primer focus ring pattern](https://primer.style/foundations/css-utilities/focus)
- [PrimeNG AutoFocus bug (upstream)](https://github.com/primefaces/primeng/issues/18774) — bug tracking en repo de PrimeNG
- [Issue interno #4](https://github.com/floxcristian/prime-showcase/issues/4) — seguimiento para remover workaround §6

## Changelog

### 2026-04-17

- **Defense-in-depth adicional en `styles.scss`.** (a) `:focus-within` del `p-autocomplete[multiple]` narrowed a `:has(> .p-autocomplete-input-chip > input:focus)` — previene double-ring cuando el foco entra a un chip existente (chip × tiene su propio halo) y evita que el halo del wrapper quede "encendido" mientras se navega entre chips con Tab. (b) Reset global `prefers-reduced-motion: reduce` — respeta user preference del SO, alinea con WCAG 2.3.3 (Animation from Interactions). (c) Shadow del focus-ring tuneado por color-mode vía CSS custom property override (halo mas denso en dark mode para mantener contraste AA sobre fondos oscuros).
- **`showcase/no-icon-button-without-tooltip` documentada en CLAUDE.md.** La regla existia en `tools/eslint/rules/` desde antes pero no estaba descrita en la guia de estilo. Agregada bajo §Botones con rationale (a11y parity entre screen readers y mouse/keyboard) y exception (botones con `label` visible).
- **TODO markers cerrados project-wide.** RuleTester tests ahora viven en `tools/eslint/rules/__tests__/`, cubren todas las reglas custom incluyendo `no-forbidden-transitions` y `hover-requires-cursor-pointer`. El scope del visitor compartido (`tools/eslint/utils.js`) se extendio para escanear `routerLinkActive` con la misma politica que `class`.
- **ESLint rules para §9 implementadas (TODO cerrado).** Agregadas `showcase/no-forbidden-transitions` y `showcase/hover-requires-cursor-pointer` en `tools/eslint/rules/`. La primera bloquea `transition-all` en atributos `class`/`styleClass` (enforcement automatico de la politica big-tech documentada en §9). La segunda asegura que todo elemento con `hover:*` declare tambien `cursor-pointer` — evita hovers huerfanos sin feedback de "clickable". El lint detecto y corrigio 2 violaciones reales en `chat.component.html` que pasaron code review.
- **§5c refactorizado: contexto de root cause explicito.** Reordenado a: problema observable → causa raiz (zoneless CD + PrimeNG plain property) → alternativas consideradas con tabla → solucion elegida → cross-ref a `styles.scss`. Agregado parrafo sobre el rol de zoneless: el lag existe a nivel de framework incluso en Zone.js, pero Zone lo enmascara via CD microtask-driven; zoneless lo surface porque el CD es signal-driven y una mutacion sobre propiedad plana no lo agenda. `:focus-within` evade el framework entero (cascada CSS sincrona). El detalle de `provideZonelessChangeDetection()` tambien se documenta en CLAUDE.md (actualizacion paralela).
- **§5c edge case de `p-autocomplete[multiple]` refinado.** Migrado de `:has(input:focus-visible)` a `:focus-within`. Causa raiz identificada: PrimeNG aplica `.p-focus` al host via mutacion de propiedad plana (`this.focused = true`, no signal) en `onInputFocus` — en zoneless Angular el CD se agenda asincrono → clase aparece ~13ms despues del focus event (1 frame perceptible). `:has(input:focus-visible)` solo matchea en keyboard (mouse click caia al fallback JS-mediado). Con `:focus-within` (CSS-native, cubre mouse + keyboard) la latencia visual baja a ~2.6ms (sub-frame), equivalente a `<input pInputText>` plano. Tambien se incluye `border-color: var(--p-autocomplete-focus-border-color)` para no depender de `.p-focus` en el cambio de borde.
- **§9 agregado — narrow transitions como estandar project-wide.** Refactor de 24 ocurrencias de `transition-all` en 7 archivos a `transition-colors` / `transition-opacity`. Elimina el fade-out de 150ms del focus ring en blur (inconsistencia entre PrimeNG con §2b/§5 y elementos custom-Tailwind). Convencion CLAUDE.md actualizada: `transition-all` prohibido salvo justificacion. `transition-property: none` en `:focus-visible` (§5) queda como defense-in-depth contra futuras regresiones. Alineacion final con patron big-tech (GitHub Primer, Linear, Stripe, Vercel, Radix): feedback instantaneo en estados de interaccion.
- **§5 refactorizado a arquitectura preset-driven.** Focus ring migrado a tokens completos en `semantic.focusRing` (estilo halo-only tipo Lara) con styles.scss como consumer de CSS vars `--p-focus-ring-*`. Zero hardcoded hex/px — todo via tokens. Edge cases documentados: landmarks via `[tabindex="-1"]` y autocomplete multiple via `:has()` proxy (workaround del `formField.focusRing` hardcoded a zeros en Aura). `transition-property: none` en `:focus-visible` para focus ring instantaneo (patron GitHub/Vercel/Linear/Stripe). A3 revertida: "single file ≠ single source of truth".
- **§8 actualizado.** `transition-[background-color] duration-150` removido de los nav items del sidebar para alinear con `transitionDuration: '0s'` de §2b — el patron "instant hover" ahora aplica tambien a elementos custom-Tailwind del layout.
- **§6 migrado a `patch-package`.** Workaround del bug AutoFocus paso de CSS guard (dic'25) → monkey-patch runtime (abr'26 temprano) → `patch-package` declarativo. Mismo fix de 2 chars del [PR upstream #19114](https://github.com/primefaces/primeng/pull/19114), ahora auditable en code review via diff commiteado.
- **Regla defensiva `:focus:not(:focus-visible) { outline: none }` removida.** Era polyfill pre-2020 innecesario — UA stylesheets modernos (Chrome 86+, Firefox 85+, Safari 15.4+) soportan `:focus-visible` nativamente y PrimeNG 21 define focus rings exclusivamente via `:focus-visible`.
- **§6a eliminado.** El `<style>` inline manual en `index.html` era redundante — Beasties lo inlineaba automaticamente desde `styles.scss`.
- **Fix en dos capas identificado para el flash de colores.** `allowedHosts` (§2a) para primer paint SSR + `transitionDuration: '0s'` (§2b) para inyeccion de estilos en navegacion client-side. Ambos son necesarios; remover cualquiera regresa el problema.

### 2026-04-16

- **Auditoria de arquitectura.** Evaluadas 3 alternativas (ver Alternativas evaluadas A1-A3). A1 descartada (scoped hydration guard no cubre navegacion client-side), A2 descartada (orden de ejecucion rompe focus management), A3 aplicada inicialmente y posteriormente revertida (ver 2026-04-17).

### 2026-04-15

- **Version inicial del ADR.** Documentadas las 3 decisiones principales: `provideClientHydration`, `cssLayer`, y focus management en SPA navigation.
