# ADR-001: SSR Hydration y configuracion de theming PrimeNG

- **Estado:** Aceptado
- **Fecha:** 2026-04-15
- **Ultima revision:** 2026-04-17 (fix en dos capas identificado — `allowedHosts` para primer paint SSR + `transitionDuration: '0s'` para inyeccion de estilos en navegacion client-side; ambos son necesarios. Workaround del bug AutoFocus migrado de CSS guard → monkey-patch runtime → `patch-package` declarativo — mismo fix de 2 chars del PR upstream, ahora auditable en code review via diff commiteado. §6a eliminado: el `<style>` inline manual en `index.html` era redundante — Beasties lo inlineaba automaticamente desde `styles.scss`. §8 actualizado: `transition-[background-color] duration-150` removido de los nav items del sidebar para alinear con `transitionDuration: '0s'` de §2b — el patron "instant hover" ahora aplica tambien a elementos custom-Tailwind del layout. §5 simplificado: regla defensiva `:focus:not(:focus-visible) { outline: none }` removida — era polyfill pre-2020 innecesario; browsers modernos ya usan `:focus-visible` en UA stylesheet y PrimeNG 21 define focus rings exclusivamente via `:focus-visible`.)
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

### 4. ~~`definePreset` — zero del box-shadow del focus ring~~ (consolidado en §5)

Anteriormente se usaba `definePreset(Aura, { semantic: { focusRing: { shadow: 'none' } } })` para zeroar el token `--p-focus-ring-shadow` de PrimeNG.

**Removido en auditoria 2026-04-16.** La definicion del focus ring se consolido en styles.scss (§5) para single source of truth — evitar que el focus ring viva partido entre `app.config.ts` (box-shadow) y `styles.scss` (outline).

### 5. Focus ring global en `styles.scss` (single source of truth)

```scss
:focus-visible {
  outline: 2px solid var(--p-primary-color, #10b981);
  outline-offset: -2px;
  box-shadow: none;
}
```

**Que hace:** establece un focus ring unico y consistente para toda la app. Es la definicion completa — no requiere overrides en el preset de PrimeNG.

- `:focus-visible` outline — verde (color primario del tema) solo para navegacion por teclado
- `outline-offset: -2px` — outline hacia adentro, evita que `overflow: hidden` de contenedores padres lo recorte (mismo patron que GitHub)
- `box-shadow: none` — **necesario**: PrimeNG emite `box-shadow: var(--p-focus-ring-shadow)` en `@layer primeng` para simular un halo alrededor del elemento focado. Sin este override, ese halo verde aparece en cada boton/input con foco.

**Por que funciona:** cssLayer (§3) hace que nuestras reglas un-layered ganen sobre PrimeNG (layered) por CSS cascade layers spec. Esto aplica a `outline` y a `box-shadow` por igual. Nuestro un-layered `box-shadow: none` pisa el `box-shadow: var(--p-focus-ring-shadow)` layered de PrimeNG.

**Es un parche?** No. Es el patron estandar de design systems (GitHub Primer, Radix). Un solo focus ring uniforme definido en un archivo.

**Por que NO se necesita `:focus:not(:focus-visible) { outline: none }`:** historicamente (pre-2020) los browsers pintaban outline en cualquier foco — mouse o teclado — usando `:focus` en su UA stylesheet. La regla `:focus:not(:focus-visible) { outline: none }` era el "polyfill manual" para suprimir outlines en mouse click. Desde Chrome 86 / Firefox 85 / Safari 15.4 (2020-2022), los UA stylesheets de todos los browsers soportados por Angular 21 usan `:focus-visible` directamente — no pintan outline en mouse click por default. Ademas, PrimeNG 21 define todos sus focus rings via `.p-component:focus-visible { outline: ... }` (verificado en `@primeuix/styles/dist/button/index.mjs`), no via `:focus`. Los selectores `:focus` que existen en PrimeNG (ej: inputtext) solo cambian `background`/`border`, no `outline`. Consecuencia: la regla defensiva era redundante. Removida 2026-04-17.

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

## Alternativas evaluadas y descartadas

Durante la auditoria 2026-04-16 se probaron tres refactors buscando una solucion menos "parche". Se documentan aqui para que futuros desarrolladores no repitan el experimento sin contexto.

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

### A3. Eliminar `focusRing.shadow: 'none'` del preset

**Hipotesis:** consolidar la definicion del focus ring en un solo archivo (`styles.scss`) en lugar de dividirla entre `app.config.ts` (box-shadow) y `styles.scss` (outline). Agregar `box-shadow: none` a la regla `:focus-visible` y eliminar el bloque `focusRing` del preset.

**Resultado:** EXITO. Aplicado 2026-04-16. Ver §5.

**Por que funciono:** las declaraciones normales (no `!important`) en cascade layers siguen la regla `un-layered > layered`. Nuestro `box-shadow: none` un-layered gana sobre el `box-shadow: var(--p-focus-ring-shadow)` layered de PrimeNG.

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
