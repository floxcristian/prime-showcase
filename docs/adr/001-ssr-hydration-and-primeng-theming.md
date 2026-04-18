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

### 4. Dark mode — cookie como single source of truth + Tailwind `@custom-variant`

**Objetivo:** que la preferencia de tema sea consistente entre SSR y CSR, sin FOUC, y sin que Tailwind y PrimeNG se desincronicen.

#### 4a. Cookie, no localStorage

```typescript
// src/app/core/services/app-config/theme-cookie.util.ts
export function serializeThemeCookie(theme, { secure }) {
  const base = `theme=${theme}; Path=/; Max-Age=31536000; SameSite=Lax`;
  return secure ? `${base}; Secure` : base;
}
```

**Por que cookie:**

| Requisito | Cookie | localStorage |
|---|---|---|
| Legible desde el servidor (SSR) | Sí (header `Cookie`) | No (solo existe en el browser) |
| Persistente entre sesiones | Sí (Max-Age=1 año) | Sí |
| Disponible antes del hydration | Sí | Solo despues de que corra JS |
| Tamano | <20 bytes | Sin limite practico |

SSR necesita conocer la preferencia ANTES de serializar el HTML. Sin esa informacion no puede emitir `<html class="p-dark">`, y el browser pinta en light primero → flash al re-render. localStorage es inutil para esto — el servidor no lo ve.

**Alternativa descartada — `Sec-CH-Prefers-Color-Scheme` (Client Hints):** el header existe y lo envia el browser automaticamente, pero (1) solo indica `prefers-color-scheme` del SO, no la preferencia explicita del usuario si la toggleo en la app, (2) no es Baseline (Chromium-only), (3) requiere `Accept-CH` handshake en la respuesta previa → primer render sin hint. Cookie cubre ambos casos (OS + override manual) y funciona cross-browser hoy.

**Atributos de la cookie — decisiones explicitas:**

- `Path=/` — la cookie aplica a todas las rutas. SSR la lee en cualquier endpoint, no solo `/`.
- `Max-Age=31536000` — un ano. Preferencia de tema rara vez cambia; caducarla antes obliga a re-detectar por cada sesion, lo cual degrada a light en cada visita.
- `SameSite=Lax` — sobrevive navegaciones top-level desde sitios externos (compartir link), no se envia en POST cross-site. Balance correcto para preferencia de UI.
- `Secure` condicional — solo sobre HTTPS. El util es puro (`{ secure: boolean }`) y el caller (`AppConfigService`) deriva el flag de `location.protocol === 'https:'`. Localhost sobre HTTP sigue funcionando; produccion HTTPS obtiene `Secure`.
- Sin `HttpOnly` — intencional. El pre-hydration inline script en `index.html` la lee via `document.cookie` para aplicar la clase `p-dark` antes de que cualquier CSS paint, evitando FOUC en sesiones donde el usuario ya toggleo el tema. Con `HttpOnly` no podriamos hacer eso y tendriamos que esperar al bootstrap de Angular.

**Header size bounding:** Node's HTTP parser caps total header size at `--max-http-header-size` (default 16 KiB) and rejects anything larger before user code ever runs. Un cookie string patologico llega acotado por la capa de transporte, asi que `parseThemeCookie` no lleva un cap redundante en el layer de aplicacion — el regex `[^;\s]+` sobre un input ya acotado es O(n) en bytes, y `n` esta acotado por Node. Defense-in-depth contra injection sigue en `serializeThemeCookie` (TypeError runtime en valores fuera de `dark`/`light`), que es donde una regresion de caller malicioso de verdad pondria bytes en la respuesta.

#### 4b. Tailwind v4 `@custom-variant dark`

```scss
/* src/styles.scss */
@custom-variant dark (&:where(.p-dark, .p-dark *));
```

**Problema que resuelve:** Tailwind v4 default es `dark:` variant driven by `prefers-color-scheme`. PrimeNG (via `darkModeSelector: '.p-dark'`) flipea sus tokens por CLASE, no por media query. Sin alineacion, `class="dark:bg-surface-950"` queda latente cuando el usuario esta en `.p-dark` si el OS dice light → PrimeNG dark pero Tailwind light → mitad de la UI en dark, mitad en light.

El plugin `tailwindcss-primeui` no registra la custom-variant automaticamente (verificado al diagnosticar el bug 2026-04-17). Hay que declararla explicitamente. `:where()` mantiene la especificidad en 0, evitando ganar accidentalmente a reglas con pseudoclases.

#### 4c. `provideAppInitializer` — bootstrap limpio

```typescript
// src/app/app.config.ts
provideAppInitializer(() => {
  inject(AppConfigService);
}),
```

**Por que no inyectar en `AppComponent`:**

- **Timing:** `provideAppInitializer` corre ANTES del primer render (CSR y SSR). Inyectar en el constructor de `AppComponent` funciona pero acopla el contrato "el servicio debe correr antes del paint" a un componente especifico — si alguien refactoriza el arbol, se pierde silenciosamente.
- **Zero-cost:** la llamada a `inject` activa el servicio via DI; el contrato es "resuelve y ejecuta constructor". No hay callback que esperar, no hay Promise que bloquee el bootstrap mas alla del `new AppConfigService()`.
- **Testabilidad:** el servicio es independiente del arbol de componentes. `TestBed.inject(AppConfigService)` funciona sin montar nada.

Patron usado por Angular core (ApplicationConfig examples), Nx, Spartan, y la mayoria de libraries enterprise.

#### 4d. Patron de mutacion — setter explicito, no `effect` para side effects

```typescript
// src/app/core/services/app-config/app-config.service.ts
setDarkTheme(dark: boolean): void {
  if (dark === this._darkTheme()) return;   // idempotencia
  this._darkTheme.set(dark);                // state
  this.persistTheme(dark);                  // cookie
  this.applyThemeTransition(dark);          // DOM + notify
}
```

**Por que no `effect` para persistencia:** revisiones anteriores envolvian `persistState` y `handleDarkModeTransition` en un `effect(() => {...})` con un flag `isFirstRun` que abortaba la primera ejecucion (porque el efecto corre al registrar, disparando cookie-write y View Transition en el bootstrap, cosas que solo queremos en respuesta a accion de usuario). Esto:

1. Mezcla semantica: "cambio de state" ≠ "accion de usuario". `effect` es para derivar state reactivo, no para side effects imperativos.
2. Requiere un flag mutable (`isFirstRun`) que es clasicamente un code-smell — es un workaround para que una API declarativa se comporte imperativamente.
3. No se puede auditar con grep — `appState.update(...)` desde cualquier parte del codigo dispara persistencia, sin una funcion concreta que lo explicite.

**Patron bigtech (Redux/Zustand/Jotai/Recoil):** estado reactivo + acciones explicitas que hacen la mutacion y sus side effects juntos. El single write path es `setDarkTheme` — greppable, testeable, idempotente. `darkTheme` se expone como `Signal<boolean>` de solo lectura (`asReadonly()`), bloqueando en tiempo de compilacion cualquier ruta de mutacion alternativa.

#### 4e. `themeChanged` counter — evento discreto sin pulse

```typescript
readonly themeChanged: Signal<number> = this._themeChanged.asReadonly();

private notifyThemeChanged(): void {
  this._themeChanged.update(v => v + 1);
}
```

**Por que counter y no boolean pulse:** la implementacion anterior (`transitionComplete`) setteaba `true` y luego resetea a `false` via `setTimeout(() => set(false))` para que la proxima transicion pudiera re-disparar. Eso implicaba:

- Ventana de carrera en el setTimeout (si consumidor lee antes de que resetea, ve `true`; despues, `false`).
- Dos estados donde logicamente hay uno ("ocurrio el evento").
- `setTimeout` defensivo solo por la mecanica del signal.

Counter monotonico resuelve todo: cada transicion es un valor nuevo (`N+1`), `effect` consumidor se re-ejecuta automaticamente por deteccion de cambio, no hay estado intermedio, no hay `setTimeout`. Patron inspirado en React `useReducer` con counter, y en el `tick` signal de Svelte. Cubierto por tests unitarios que verifican `themeChanged()` incrementa exactamente una vez por `setDarkTheme` cuando el valor cambia (y no incrementa en no-ops).

**Por que counter y no leer `darkTheme()` directamente en el effect consumer:** aparentemente seria mas simple — `effect(() => this.configService.darkTheme(); untracked(() => initChart()))` tiene la misma forma. Pero `document.startViewTransition(callback)` ejecuta el callback de forma asincrona (la spec lo describe como "next frame"); entre `_darkTheme.set(dark)` y la aplicacion real de la clase `.p-dark`, hay una ventana donde los signal effects ya corrieron (microtask) pero el DOM todavia tiene la clase vieja. Chart.js leeria CSS vars obsoletas. El counter se incrementa desde `transition.ready.then(...)` que por contrato resuelve despues de que el nuevo DOM esta paintable — elimina la race.

#### 4f. Pre-hydration inline script — fallback para OS preference

```html
<!-- src/index.html -->
<script>
(function () {
  try {
    var m = document.cookie.match(/(?:^|;\s*)theme=(dark|light)/);
    var theme = m ? m[1] : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    if (theme === 'dark') document.documentElement.classList.add('p-dark');
  } catch (e) { /* no-op: CSP / sandbox; SSR class will still apply */ }
})();
</script>
```

**Cuando actua:** solo en browser, solo en primer visit (sin cookie). SSR ya emitio la clase correcta cuando habia cookie — este script es para usuarios que nunca toggleron y cuya preferencia viene del SO.

**Regex alineado con el util TS:** el regex inline `/(?:^|;\s*)theme=(dark|light)/` usa la misma anchor prefix-safety que `parseThemeCookie` (evita false positive en `mytheme=dark`). Divergencia entre los dos parsers es un bug esperando a pasar — si se toca uno, tocar el otro y los tests de `theme-cookie.util.spec.ts` ambos casos.

#### 4g. CDN caching — `Vary: Cookie`

El SSR server emite `Vary: Cookie` explicitamente y `Cache-Control: public, max-age=3600, s-maxage=86400`; el middleware `compression` anexa `Accept-Encoding` al `Vary` cuando la respuesta viaja comprimida, por lo que el header observado es `Vary: Cookie, Accept-Encoding`. Sin `Vary: Cookie`, un proxy cache serviria HTML de un usuario dark a un usuario light → regresion visible.

**Fragmentacion de cache conocida:** `Vary: Cookie` hace que el CDN almacene una entry por valor unico del header `Cookie`. En practica, el valor completo de la cookie (incluyendo session tokens, analytics, etc.) varia por usuario → cache hit rate cercano a cero. Solucion big-tech (Cloudflare Workers, Fastly VCL, Akamai): normalizar el header a un subset antes del Vary (ej: un header sintetico `X-Theme: dark|light` derivado de la cookie). **No implementado** en este proyecto — ROI no justifica el overhead operacional hasta que el proyecto tenga trafico real que sature origen. Cuando sea relevante, la normalizacion vive en el edge, no en el server Node.

Ref: [MDN — Cache-Control and Vary](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Vary), [Cloudflare — Caching dynamic content](https://developers.cloudflare.com/cache/concepts/vary-header/).

#### 4h. Manual verification checklist

Para validar la SSR → hidratacion sin correr Playwright:

```bash
# 1. Build + arrancar SSR
npm run build && npm run serve:ssr:prime-showcase

# 2. Smoke test automatico (tools/smoke/ssr-theme.smoke.mjs)
npm run test:ssr:smoke

# 3. Verificar manualmente en DevTools
curl -H 'Cookie: theme=dark' http://localhost:4000/ | grep -o '<html[^>]*>'
# Expected: <html class="p-dark" lang="en" ...>

curl -H 'Cookie: theme=light' http://localhost:4000/ | grep -o '<html[^>]*>'
# Expected: <html lang="en" ...> (sin p-dark)

curl -I -H 'Cookie: theme=dark' http://localhost:4000/ | grep -i vary
# Expected: Vary: Cookie, Accept-Encoding
```

#### 4i. Alternativas descartadas

- **localStorage + cookie hibrido:** dos storages, dos sources of truth → mismatch cuando divergen. Descartado.
- **Client Hints (`Sec-CH-Prefers-Color-Scheme`):** Chromium-only, requiere `Accept-CH` handshake → primer render sin hint. Descartado.
- **Query string (`/?theme=dark`):** rompe URLs compartibles, ensucia analytics, no persiste. Descartado.
- **Subdomain por tema (`dark.app.com`):** overkill y rompe isolation de cookies. Descartado.

**Es un parche?** No. Es la arquitectura de theming canonica para stack Angular SSR + design token library (PrimeNG, Material, ng-zorro). El patron cookie + inline script + appInitializer es identico al usado por Vercel Analytics, GitHub, Linear, Radix UI Examples — todos publicados.

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

### 10. Incremental Hydration (`withIncrementalHydration` + `@defer hydrate`)

**Decision (2026-04-18):** activar `withIncrementalHydration()` en `provideClientHydration()` y aplicar `@defer (hydrate on viewport)` a 4 bloques heavy: chart de overview, carousel de movies, panel derecho de chat, file upload de cards.

**Por que ahora — el contexto del repo es enterprise-grade.** El proyecto es la base para sistemas con cards que cargan datos via HTTP en cada tarjeta (dashboards, paneles administrativos, vistas multi-widget). En ese contexto, la hidratacion eager del bootstrap es cara: Angular debe instanciar TODOS los componentes del arbol antes de que el usuario pueda interactuar con cualquier parte. Para una pagina como `/cards` con 10+ cards independientes, el TTI se estira por componentes que el usuario probablemente nunca vera (panel derecho oculto bajo xl, cards a 3 scrolls de distancia). Incremental Hydration corrige esto: el SSR sigue emitiendo el HTML completo (no hay flash), pero la hidratacion se posterga hasta que el bloque entra en viewport.

**Mecanica:**
1. `withIncrementalHydration()` cambia el contrato del SSR: cada `@defer (hydrate on <trigger>)` se serializa con markers `ngh=dN` (visibles como comentarios en el DOM).
2. El cliente lee esos markers al bootstrap y NO instancia los componentes diferidos. El DOM existe (renderizado por el server) pero no esta vivo — sin event listeners, sin reactividad de Angular.
3. Cuando el trigger del bloque se cumple (IntersectionObserver para `viewport`, `requestIdleCallback` para `idle`, etc.), Angular descarga el chunk de hydration y "promueve" el subtree a hidratado: registra event listeners, crea instancias de componentes, conecta signals.
4. Con `withEventReplay()` co-habitando, los clicks/focus que el usuario hizo durante la ventana pre-hidratacion se replayan automaticamente — el usuario nunca pierde una interaccion.

**Triggers seleccionados:**

| Bloque | Componente | Trigger | Razon |
|---|---|---|---|
| Crypto Analytics chart | `overview.component.html:47-77` | `viewport` | Chart.js es ~165 kB en chunk dedicado y ~80 ms de init JS — caro, baja prioridad si esta below-the-fold |
| Carousel "Seguir viendo" | `movies.component.html:30-117` | `viewport` | Primer card del modulo, suele estar in-viewport en desktop pero se beneficia de defer en mobile (height bajo) |
| Panel derecho de chat | `chat.component.html:216-351` | `viewport` | `xl:block hidden` — invisible bajo xl. Sin defer, se hidrata aunque nunca se muestre |
| File upload card | `cards.component.html:264-492` | `viewport` | Card mid-page con FileUpload + AutoComplete + RadioButton; usuario debe scroll para verla |

**Por que no `interaction` o `idle`:**
- `interaction` es para bloques que solo importan al click/hover (menus contextuales, modales). Los bloques diferidos aqui son contenido visual, no acciones.
- `idle` permite hidratar antes de viewport, util para below-the-fold de baja prioridad sin penalizar UX. Para bloques deliberadamente caros (chart, carousel) preferimos esperar a viewport para no consumir CPU en background mientras el usuario lee above-the-fold.

**`@placeholder` con `<p-skeleton>`:**
- Cada `@defer` lleva un `@placeholder` con `<p-skeleton>` que reproduce las dimensiones del bloque real. Esto cubre el CSR fallback (client-side route changes sin SSR) y previene CLS al hidratar.
- Decision de convencion (no del feature): cualquier loading state del proyecto (placeholder de defer, contenido HTTP pendiente, lista async) usa `<p-skeleton>` de PrimeNG. Razon: una sola primitive evita inconsistencia visual al escanear, hereda animacion `wave` del tema Aura, respeta dark mode automaticamente. Documentado en CLAUDE.md ("Loading states: `<p-skeleton>` always").

**Bundle deltas medidos (raw / transfer):**

| Chunk | Pre @defer | Post @defer | Delta |
|---|---|---|---|
| `cards-component` | 174.23 kB / 33.02 kB | 174.32 kB / 33.04 kB | +0.09 kB / +0.02 kB |
| `movies-component` | 38.30 kB / 8.80 kB | 39.34 kB / 9.13 kB | +1.04 kB / +0.33 kB |
| `chat-component` | 27.05 kB / 6.84 kB | 28.02 kB / 7.10 kB | +0.97 kB / +0.26 kB |
| `overview-component` | 26.82 kB / 7.45 kB | 27.30 kB / 7.57 kB | +0.48 kB / +0.12 kB |
| Initial total | 705.45 kB / 159.00 kB | 705.45 kB / 159.00 kB | 0 kB |

**Lectura honesta:** el chunk del componente padre crece marginalmente porque `Skeleton` debe estar en el chunk eager (el placeholder debe poder renderizarse antes que el bloque diferido). El initial total NO se mueve — los componentes son lazy (preloaded por `BrowserPreloadingStrategy`), asi que el "ahorro de bytes" no es la metrica relevante. **El beneficio es work scheduling**: la hidratacion de cada bloque (creacion de instancias, registro de listeners, init de Chart.js / Carousel / FileUpload) sale del critical path del bootstrap. En el caso del panel xl de chat, si la viewport es < xl nunca se hidrata.

**Verificacion:**
- `npm test` — 91/91 verde (sin cambios de tests, no hay nuevo behavior que validar mas alla del visual).
- `npm run lint` — 0 errores nuevos.
- `npm run build` — dentro del budget. Build time 16.3s vs 10.9s pre-feature; el aumento es el procesamiento adicional de markers en el SSR build.
- `npm run test:ssr:smoke` — 4/4 cookie cases siguen pasando. La feature no rompe el contrato de SSR.
- Browser inspection (Playwright): el HTML SSR contiene comentarios `ngh=d0` y `nghm` — markers de Angular para "deferred block + hydration manifest". Confirmacion empirica de que el contrato `withIncrementalHydration` esta en efecto.

**Cuando aplicar a futuro:**

| Trigger | Cuando usar | Ejemplo |
|---|---|---|
| `viewport` | Bloque pesado below-the-fold o condicionalmente visible (responsive hidden) | Charts, carousels, panels xl-only |
| `interaction` | Bloque que solo importa al click/hover | Menu contextual con muchos items |
| `idle` | Bloque secundario que puede esperar al main thread libre | Footer, "tambien podria interesarte" |
| `timer(Nms)` | Animacion diferida o efecto progresivo | Banner de newsletter 3s post-load |
| `never` | Solo SSR, nunca hidratar (estatico puro) | Footer legal, copyright |

**Cuando NO aplicar:**
- Componentes < 5 kB de JS — el overhead de IO + hydration scheduling no compensa.
- Bloques above-the-fold critical (header, primer card visible) — siempre hidratan instantly de todos modos.
- Bloques con `effect()` que reaccionan a estado externo desde el primer frame (ej: theme switcher).

**Limitacion conocida — code splitting parcial:** el `@defer` de Angular intenta extraer los componentes diferidos a chunks separados, pero solo si esos componentes NO son referenciados eagerly en el componente padre. Si `FileUpload` esta en `PRIME_MODULES = [..., FileUpload]` del componente, Angular lo bundlea en el chunk del padre — el split no ocurre. Para code splitting completo habria que mover el import del componente diferido a un componente standalone separado y referenciarlo solo desde dentro del `@defer`. Aceptable trade-off por ahora: la mayor parte del beneficio de Incremental Hydration es work scheduling, no bytes.

**Co-habitacion con `withEventReplay()`:** ambas features se invocan en el mismo `provideClientHydration(withEventReplay(), withIncrementalHydration())`. EventReplay captura clicks/focus que el usuario hace durante la ventana pre-hidratacion y los replayea al hidratar — esencial para no perder interacciones cuando el usuario click-ea un boton dentro de un bloque diferido antes de que se hidrate. Sin EventReplay, esos clicks se perderian silenciosamente.

**Compatibilidad con zoneless:** validado. Incremental Hydration es independiente del CD strategy. Funciona con `provideZonelessChangeDetection()` activo.

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

### 2026-04-18 — §10 Incremental Hydration P1: tabla de transacciones de Overview

- **Quinto bloque `@defer (hydrate on viewport)` aplicado.** Triage P1 evaluo 7 candidatos secundarios; solo uno paso el corte enterprise-grade ("defer the cost, not the content"):

  | Componente | Bloque diferido | Razon | Trigger |
  |---|---|---|---|
  | `overview.component.html:91-186` | Card "Transacciones" (`p-table` + paginator + `p-menu` popover por fila + avatares + tags) | Below-fold bajo el chart de Crypto Analytics; el `p-table` con paginator y menus per-row carga state machinery moderada que no es critica al bootstrap | viewport |

- **Rechazados con razon (no todos los P1 evaluados se merecen defer).**
  - **`overview.component.html` "Mi Billetera" (`p-metergroup`)** — visualizacion standalone liviana; el overhead de un IntersectionObserver adicional + skeleton placeholder no compensa el ahorro marginal de hidratacion. Big-tech principle: un widget pequeno aislado no justifica un defer dedicado.
  - **`cards.component.html` price range slider + OTP** — fragmentos pequenos individuales. Dos defers separados meterian dos IO + dos skeletons por ahorrar ~1 kB de hidratacion combinada. Si fueran una seccion contigua larga, si; sueltos, no.
  - **`customers.component.html` y `inbox.component.html` tablas** — son el contenido **principal** de su ruta, above-fold. Diferir contenido principal castiga LCP y mete flash de skeleton. Big-tech lo paginaria server-side, no lo diferiria.

- **`@placeholder` con `<p-skeleton>` dimensionado para zero CLS.** Header (1.5rem) + table-header strip (2.5rem) + 5 row strips (3.5rem c/u con mb-2) + paginator (2rem con mt-4). Total ~30rem de interior — coincide con la altura real del card al hidratar.
- **Bundle delta medido (vs post-P0 baseline registrado en entry anterior):**

  | Chunk | Pre P1 | Post P1 | Delta |
  |---|---|---|---|
  | `overview-component` (browser) | 27.30 kB / 7.57 kB | 28.08 kB / 7.76 kB | +0.78 kB / +0.19 kB |
  | Initial total | 705.45 kB | 740.99 kB | +35.54 kB (atribuible al font Inter Variable bundlado en commit 4919bc6, no al P1) |
  | Initial total post-cleanup | — | 714.29 kB | -26.70 kB vs medicion previa, tras migrar 49 atributos `styleClass` deprecados a `class` y extraer constantes de skeleton rows |

  El delta puro del defer en overview es ~0.78 kB raw — costo del bloque condicional + skeleton placeholder. Auditoria honesta del initial total (`git show 4919bc6 -- angular.json package.json`): el commit P0 anadio `@fontsource-variable/inter` a `package.json` y la linea `node_modules/@fontsource-variable/inter/index.css` a `angular.json` styles. La medicion "post-P0" 705 kB del entry anterior subestimo este peso; la baseline real post-P0 es ~740 kB. **El P1 mismo no mueve el initial total** — solo el chunk lazy del overview (+0.78 kB). Tras el cleanup enterprise-grade (PrimeNG 21 deprecation de `styleClass`, codemod 49→0 ocurrencias, indentacion normalizada en overview, constantes `transactionsRowsPerPage` / `carouselSkeletonSlots` extraidas), el initial total cae a 714.29 kB — 35 kB de margen sobre el warn budget de 750 kB. El siguiente trabajo de tipografia (subset Latin-only, swap-to-system pre-load) sigue siendo la palanca mas grande de aqui en adelante.

- **Verificacion en SSR.** `curl http://localhost:4000/` (overview es la ruta default) devuelve 2 markers de defer en el HTML: `<!--ngh=d0-->` (P0 chart) + `<!--ngh=d1-->` (P1 transactions table). Confirma que ambos bloques se SSR-renderizan completos y posponen hidratacion hasta IntersectionObserver disparar.
- **No regresiones.** `npm test` 91/91 verde. `npm run lint` 0 errores. `npm run build` exit 0, dentro de budget. `npm run test:ssr:smoke` 4/4 cookie cases verde.
- **Wallet meter (`p-metergroup`) queda como sibling fuera del defer.** El layout `<div class="flex gap-6 xl:flex-row flex-col">` envuelve ambos cards; el `@defer` se aplica solo al primero (transactions), preservando el layout flex sin colapsar el segundo card cuando el placeholder se renderiza.

### 2026-04-18 — §10 Incremental Hydration aplicada a 4 bloques heavy

- **`withIncrementalHydration()` activado en `app.config.ts`.** Sin esta feature, `@defer (hydrate on <trigger>)` se trata como `@defer` normal (CSR) y la hidratacion ocurre eager en el bootstrap. Activarla cambia el contrato del SSR: el server emite el HTML completo del bloque diferido, anota markers `ngh=dN` (visibles en DOM como comentarios), y la hidratacion (registro de event listeners + creacion de instancias de componentes Angular) se posterga hasta que el trigger se cumple. Co-existencia con `withEventReplay()` validada — se usan en el mismo `provideClientHydration()`.
- **4 bloques `@defer (hydrate on viewport)` aplicados.** Triage P0 priorizo bloques con peso JS alto y baja probabilidad de visibilidad inmediata:

  | Componente | Bloque diferido | Razon | Trigger |
  |---|---|---|---|
  | `overview.component.html:47-77` | Card "Crypto Analytics" (Chart.js bar chart) | Chart.js ~165 kB en chunk dedicado, pesado de inicializar; usuario puede no scrollear hasta verlo | viewport |
  | `movies.component.html:30-117` | Card "Seguir viendo" (Carousel multi-item) | PrimeNG Carousel ~28 kB + 5 items con imagenes; primer card del modulo | viewport |
  | `chat.component.html:216-351` | Panel derecho (perfil + miembros + media) | `xl:block hidden` — invisible bajo viewport xl, costoso hidratar para no mostrarse | viewport |
  | `cards.component.html:264-492` | Card "Subir archivos" (FileUpload + AutoComplete + RadioButton) | FileUpload ~12 kB de logica + DOM denso; mid-page scroll-into | viewport |

- **`@placeholder` con `<p-skeleton>` en cada bloque.** Convencion enterprise: cualquier loading state (placeholder de defer, contenido pendiente de HTTP, lista async) usa `<p-skeleton>` de PrimeNG. Razon: una sola primitive evita inconsistencia visual al escanear, hereda la animacion `wave` del tema Aura sin escribir keyframes, respeta dark mode, y mantiene el design system limpio. Documentado en CLAUDE.md bajo "Loading states: `<p-skeleton>` always". Cada placeholder reproduce las dimensiones del componente real para zero CLS al hidratar.
- **Bundle deltas medidos (raw / transfer):**

  | Chunk | Pre @defer | Post @defer | Delta |
  |---|---|---|---|
  | `cards-component` | 174.23 kB / 33.02 kB | 174.32 kB / 33.04 kB | +0.09 kB / +0.02 kB |
  | `movies-component` | 38.30 kB / 8.80 kB | 39.34 kB / 9.13 kB | +1.04 kB / +0.33 kB |
  | `chat-component` | 27.05 kB / 6.84 kB | 28.02 kB / 7.10 kB | +0.97 kB / +0.26 kB |
  | `overview-component` | 26.82 kB / 7.45 kB | 27.30 kB / 7.57 kB | +0.48 kB / +0.12 kB |
  | Initial total | 705.45 kB / 159.00 kB | 705.45 kB / 159.00 kB | 0 kB |

  **Lectura honesta del delta:** el chunk del componente padre crece marginalmente porque `Skeleton` tiene que estar en el chunk eager (el placeholder debe poder renderizarse antes que el bloque diferido). El initial total no se mueve porque los componentes son lazy (preloaded por `BrowserPreloadingStrategy`, no eager). El beneficio NO es bytes — es **work scheduling**: la hidratacion de cada bloque diferido (creacion de instancias, registro de DOM listeners, inicializacion de Chart.js / Carousel / FileUpload) sale del critical path del bootstrap y se difiere hasta que el bloque entra en viewport. En el caso del panel xl de chat, si la viewport es < xl nunca se hidrata.

- **Verificacion en SSR.** Smoke test (`npm run test:ssr:smoke`) sigue pasando los 4 casos de cookie. SSR HTML inspeccionado en browser via Playwright contiene comentarios `ngh=d0` y `nghm` — markers de Angular para "bloque diferido + metadata de hydration manifest". Confirmacion de que el server-side rendering incluye los markers que el cliente lee para gating.
- **No regresiones.** `npm test` 91/91 verde. `npm run lint` 0 errores nuevos. `npm run build` dentro del budget (705 kB initial < 750 kB warn). Build time 16.3s (vs 10.9s pre-feature; el aumento es por el procesamiento adicional de los markers en el SSR build, aceptable).
- **Patron de aplicacion futuro.** Documentado en CLAUDE.md bajo "Incremental Hydration (`@defer hydrate`)" — incluye tabla de cuando usar cada trigger (viewport / interaction / idle / timer / never), reglas de cuando NO aplicar (componentes `< 5 kB`, above-the-fold critical, bloques con `effect()` desde primer frame), y obligatoriedad del `@placeholder` con `<p-skeleton>` para CSR fallback en client-side route changes.

### 2026-04-17 (noche — ronda 3 de revision, anti-parche)

- **`AppConfigService.applyThemeTransition` recortado.** Removido el tracking de `activeTransition`, las llamadas a `skipTransition()` y el `try/catch` defensivo alrededor de `startViewTransition`. La implementacion final es la minima: feature-detect → llamar → suscribirse a `ready` para notificar. Los big-tech de referencia (GitHub, Vercel, Stripe) no orquestan concurrencia manual sobre View Transitions — la semantica de `ready`/`finished` del browser ya cubre el skip implicito, y los polyfills que prometen la API pero tiran en invocacion no son un caso observado. YAGNI aplicado sobre codigo que parecia defensivo pero no cubria ningun failure real.
- **`parseThemeCookie` sin length cap.** El cap de 8 KB a nivel aplicacion era redundante: el parser HTTP de Node (`--max-http-header-size`, default 16 KiB) rechaza headers sobredimensionados antes de que el request llegue al handler. Mantener un cap a la capa de aplicacion solo duplicaba la defense y confundia el modelo mental — "quien acota?" tenia dos respuestas. Eliminado junto a sus dos tests.
- **Specs podados de tautologias.** (a) El test "darkTheme is read-only" validaba el tipo `Signal<T>` en runtime — lo que TypeScript ya garantiza en compile time; el test no podia fallar. (b) Los tests de `skipTransition` y "throws fallback" dejaron de aplicar al simplificar `applyThemeTransition`. (c) El test SSR "no cookie write" se compactado a `~5` lineas (era 26) sin perder la assertion de setter-spy.
- **`overview.component` — field initializer → constructor effect.** `themeEffect = effect(...)` a nivel de campo quedaba huerfano: el `EffectRef` no se usa en ningun lado. Movido al constructor como `effect(...)` anonimo, que es el patron idiomatico de Angular v21 cuando no necesitas el handle.
- **`server.ts` — polaridad NODE_ENV fail-closed.** Cambio de `isProduction = NODE_ENV === 'production'` a `isDev = NODE_ENV === 'development'`. Si el deploy olvida el env var o lo configura como `staging`, la CSP degrada a la version estricta (sin `ws:` plaintext) en vez de a la permisiva. Pequeno pero es la diferencia entre un SRE tranquilo y un post-mortem.
- **`server.ts` — `frame-ancestors 'none'`.** Esta app es una SPA standalone, nunca deberia embebes en un iframe — ni de terceros ni de si misma. `'none'` endurece mas que `'self'` y bloquea clickjacking self-frame tambien.
- **`server.ts` — `PORT || 4000` → `PORT ?? 4000`.** Edge case: `PORT=0` (que algunos orchestrators usan para "binde cualquier puerto libre") era tratado como falsy y sobreescrito al 4000. Nullish coalescing respeta el `0` intencional.

### 2026-04-17 (tarde — cleanup enterprise-grade post-revision critica)

- **§4 expandido — Dark mode architecture formalizada.** El marker "~~reemplazado por §5~~" era obsoleto desde que la seccion se volvio sobre focus ring. Nuevo §4 documenta las decisiones completas: cookie como SSOT (vs localStorage / Client Hints), Tailwind v4 `@custom-variant dark` alineado con `darkModeSelector: '.p-dark'` de PrimeNG, `provideAppInitializer` para bootstrap tree-independent, patron setter explicito (vs `effect` + `isFirstRun` skip-flag), counter signal `themeChanged` para eventos discretos (vs pulse booleano con `setTimeout`), pre-hydration inline script con regex alineado al util TS, `Vary: Cookie` + fragmentacion de cache en CDNs con big-tech workaround (edge normalization), y checklist de verificacion manual. Cada subseccion incluye alternativas descartadas con rationale.
- **`AppState` interface eliminada.** Campos `preset`, `primary`, `surface` nunca fueron consumidos — eran scaffolding del PrimeNG template original. YAGNI: se reintroducen cuando exista un theme picker runtime, no antes. Shape del state reducido a `darkTheme: boolean` via signal directo (`_darkTheme`) expuesto read-only.
- **`AppConfigService` refactorizado a patron bigtech.** (a) API mutation reducida a `setDarkTheme(dark: boolean)` — single write path, greppable, idempotente, sin `effect` para side effects. (b) `darkTheme` expuesto como `Signal<boolean>` read-only via `asReadonly()` — mutacion directa bloqueada en tiempo de compilacion. (c) `themeChanged` como counter monotonico reemplaza `transitionComplete` pulse — elimina ventana de carrera de `setTimeout` y estado intermedio. (d) localStorage eliminado — cookie es el unico storage, fin de la divergencia entre dos sources of truth. (e) Rama inalcanzable `return false` en `readInitialTheme` removida (platformId es server o browser, no hay tercer caso).
- **`theme-cookie.util.ts` purificado.** `serializeThemeCookie(theme, { secure })` ahora acepta el flag HTTPS como parametro en vez de sniffear `typeof location !== 'undefined'`. Funciones puras son testeable sin mockear globals; el caller (service) deriva el flag de su propio contexto. Cobertura 100% via test cases en Vitest cubriendo falsy inputs, prefix-safety (`mytheme=dark`), case-sensitivity, duplicados, runtime validation defense-in-depth (cookie-injection), y round-trip parse/serialize.
- **Tests enterprise-grade agregados.** (a) `theme-cookie.util.spec.ts` — parsing y serializacion, edge cases del regex. (b) `app-config.service.spec.ts` expandido de smoke (1 test) a suite completa (16 tests) cubriendo bootstrap con/sin cookie, prioridad cookie-over-class, `setDarkTheme` idempotencia, contador `themeChanged` monotonico, SSR path con `REQUEST` mockeado, y verificacion de que el servicio no escribe cookies en SSR. (c) Smoke test SSR `tools/smoke/ssr-theme.smoke.mjs` — curl real contra el server en ejecucion validando `<html class="p-dark">` + `Vary: Cookie` header para 4 escenarios (no cookie, theme=dark, theme=light, valor invalido). Invocable via `npm run test:ssr:smoke`.

### 2026-04-17

- **Skip-to-content link agregado en `main.component` (WCAG 2.4.1 bypass block).** Link con `sr-only focus:not-sr-only` como primer elemento focable del DOM, con `href="#main-content"` + click handler que llama `.focus()` explicito en el `<main tabindex="-1">`. Rationale del handler: fragment navigation (`#hash`) scrollea al target consistentemente, pero NO foca en Safari/Firefox (Chrome si, intermitente) — WebAIM lo confirma. Patron big-tech (GitHub, Linear, Vercel): preventDefault + focus manual para portabilidad. Conecta con §7 focus management SPA: skip link cubre el tabstop inicial (primera carga) mientras que el focus programatico cubre navegaciones subsecuentes.
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
