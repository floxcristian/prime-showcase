/**
 * @fileoverview Single source of truth for the PrimeNG Aura preset.
 *
 * Consumed by:
 *   - src/app/app.config.ts        → application bootstrap (production runtime)
 *   - .storybook/preview.ts        → Storybook decorator (component catalog)
 *   - tools/design-tokens/sync.mjs → drift check vs DESIGN.md
 *
 * Why a separate file:
 *   Embedding the preset inside `app.config.ts` couples the runtime
 *   provider tree to the theme definition. Storybook needs the theme but
 *   not the provider tree (no router, no SSR, no auth init), so importing
 *   `app.config.ts` from Storybook leaks orthogonal providers. Extracting
 *   the preset isolates "what the design system IS" from "how the app
 *   wires it up" — same separation Polaris / Primer / Carbon enforce.
 */

import Aura from '@primeuix/themes/aura';
import { definePreset } from '@primeuix/themes';

/**
 * Neutro corporativo Implementos — anclado en PANTONE Cool Gray 10 C
 * (`#636569`, shade 500), el tercer color de la paleta primaria del brand
 * book 2026.
 *
 * Reemplaza los dos ramps que veniamos heredando de Aura sin declararlos:
 * `slate` en light y `zinc` en dark. Eso no era una decision, era un default
 * — y traia dos problemas. Uno de marca: el gris del producto no era el gris
 * de Implementos (slate tira azul, hue OKLCH 257 con C≈0.04; Cool Gray 10 C
 * es casi acromatico, C≈0.007). Y uno de coherencia: light y dark corrian
 * familias distintas, asi que una superficie gris cambiaba de temperatura al
 * togglear el tema.
 *
 * Un solo ramp para ambos modos. La marca declara UN gris.
 *
 * La curva de luminancia reproduce la de slate/zinc casi punto por punto
 * (medida, no inventada — ver `NEUTRAL_L_TARGETS` en tools/design-tokens/
 * color.mjs). Solo cambian hue y croma. Eso mantiene intactos el ritmo
 * visual y los ratios de contraste: es un recolor de marca, no un rediseño
 * de superficies.
 *
 * Derivado en OKLCH — un paso constante de L es un paso constante de
 * lightness percibida, cosa que HSL no garantiza. Regenerable con
 * `node tools/design-tokens/derive-brand-ramps.mjs`.
 */
const IMPLEMENTOS_NEUTRAL = {
  0: '#ffffff', //  blanco — cuarto color de la paleta primaria
  50: '#f9fafb',
  100: '#f2f3f6',
  200: '#e2e4e7',
  300: '#ced0d4',
  400: '#97999d',
  500: '#636569', //  ← PANTONE Cool Gray 10 C, exacto
  600: '#484a4e',
  700: '#37393d',
  800: '#232427',
  900: '#151619',
  950: '#07080a',
} as const;

// Desactiva las transiciones internas de PrimeNG (button, input, select, etc.).
// Razon: en navegacion client-side entre rutas, los componentes PrimeNG nuevos inyectan
// sus estilos via JS (UseStyle) despues de montarse. Durante ese gap de 1-2 frames,
// los elementos renderizan sin colores de tema y las transiciones de 0.2s animan el
// cambio de negro/default → color de tema como un flash visible.
//
// El fix de SSR (allowedHosts) resuelve el primer paint (todos los estilos vienen inlineados),
// pero no la inyeccion posterior en navegacion. Por eso el token es necesario.
//
// Resultado: cambios de color instantaneos en componentes PrimeNG — patron valido (Linear,
// Stripe, Vercel). Transiciones custom via Tailwind siguen funcionando.
// Ref: ADR-001 §2
export const AppPreset = definePreset(Aura, {
  // Error tone: Aura default usa {red.*} (Tailwind red) que se percibe como
  // sangre. Preferimos rose (misma familia Tailwind, tono coral cercano a
  // Apple HIG/iOS #FF3B30). Un solo shade para border + texto (Stripe/Linear/
  // GitHub pattern): rose.500 light / rose.400 dark. No creamos colores —
  // rose es una palette nativa del preset Aura.
  components: {
    message: {
      colorScheme: {
        light: {
          error: {
            simple: { color: '{rose.500}' },
            color: '{rose.500}',
            borderColor: '{rose.200}',
          },
        },
        dark: {
          error: {
            simple: { color: '{rose.400}' },
            color: '{rose.400}',
          },
        },
      },
    },
  },
  semantic: {
    transitionDuration: '0s',
    // Azul base Implementos — PANTONE 300 U, `#006DB6`.
    //
    // Declarado en "PALETA DE COLOR PRIMARIA" del brand book 2026 y
    // corroborado por el propio PDF: las muestras pintadas de esa pagina
    // y el artwork del logo de todo el capitulo 02 usan exactamente ese
    // hex. Es el color, no una aproximacion — por eso el shade 500 lo
    // reproduce byte a byte en vez de re-derivarlo.
    //
    // Antes el 500 era `#0074C2`: mismo hue, elegido "en familia del
    // logo" pero sin ser el color de marca. La correccion lo aterriza en
    // el Pantone declarado y, de yapa, sube el contraste (4.9 → 5.4:1).
    //
    // Derivacion en OKLCH, hue constante 248.2° (= 204° en HSL) en los 11
    // shades. Un paso constante de L en OKLCH es un paso constante de
    // lightness PERCIBIDA; en HSL no lo es, y por eso los ramps hechos a
    // mano en HSL se sienten desparejos justo en los shades medios.
    // Regenerable: `node tools/design-tokens/derive-brand-ramps.mjs`.
    //
    // Contraste verificado por CI (`npm run design-tokens:contrast`, que
    // recomputa la tabla desde este archivo — ya no son numeros a mano):
    //   - primary.500 sobre surface.0:   5.4:1  AA
    //   - primary.600 sobre surface.0:   7.3:1  AAA  (hover de link)
    //   - primary.700 sobre surface.0:   9.7:1  AAA  (active)
    //   - primary.400 sobre surface.950: 6.3:1  AA   (primary en dark)
    //
    // Cambio propaga a todo lo que consume --p-primary-* (bg-primary,
    // text-primary, focus ring, charts, tags, buttons, links, tiles del
    // aside). Cero updates manuales en templates.
    primary: {
      50: '#f0f7ff',
      100: '#d9ecff',
      200: '#b1d8ff',
      300: '#7abbf8',
      400: '#4496de',
      500: '#006db6', //  ← PANTONE 300 U, exacto
      600: '#005996',
      700: '#004678',
      800: '#00355d',
      900: '#002646',
      950: '#001831',
    },
    // Verde acento Implementos — PANTONE 334 U, `#00937F`.
    //
    // Segundo color de la paleta primaria. Hasta ahora existia UNICAMENTE
    // dentro del SVG del logo: ni en el preset, ni en tokens.json, ni en
    // DESIGN.md, ni en Storybook. Un color de marca que el design system
    // no sabia nombrar.
    //
    // **Es acento, no dominante.** El brand book lo dice dos veces y en
    // ambos casos como ERROR a evitar: "uso del verde como dominante en
    // vez de acento" (cap. 05, errores comunes) y "uso excesivo de verde
    // (debe ser acento)" (cap. 07, señaletica). De ahi dos decisiones:
    //
    //   1. NO se remapea la severity `success` de PrimeNG. Si lo
    //      hicieramos, el verde de marca aparecería en cada toast, tag y
    //      badge de exito — exactamente el "verde dominante" que el
    //      manual prohibe. El verde funcional "bueno/activo/up" sigue
    //      siendo `{green.*}` de Aura, que es semantica, no marca.
    //   2. Se declara el ramp completo (para que el sistema pueda
    //      expresarlo) pero sin uso forzado en UI. Ver DESIGN.md
    //      §"Azul base / verde acento" para cuando corresponde.
    //
    // Nota de accesibilidad — el 500 NO es apto para texto:
    //   - accent.500 sobre surface.0: 3.8:1 → solo relleno/grafico/borde
    //   - accent.600 sobre surface.0: 5.5:1 → AA, minimo para texto
    //   - accent.700 sobre surface.0: 7.9:1 → AAA
    // Es una propiedad del Pantone, no del ramp: `#00937F` simplemente no
    // llega a 4.5:1 contra blanco. Por eso el ramp llega hasta el 950.
    accent: {
      50: '#ebfbf6',
      100: '#d4f4ec',
      200: '#afe6d9',
      300: '#7fd1bf',
      400: '#49b5a1',
      500: '#00937f', //  ← PANTONE 334 U, exacto
      600: '#007666',
      700: '#005c4f',
      800: '#00443a',
      900: '#003028',
      950: '#001d17',
    },
    colorScheme: {
      light: {
        surface: IMPLEMENTOS_NEUTRAL,
        formField: { invalidBorderColor: '{rose.500}' },
        // Hover por default (bg-emphasis) en Aura es surface.100 — casi
        // invisible sobre blanco y completamente invisible sobre columnas
        // grises (surface.50/100). Subimos un step a surface.200 para que
        // el feedback sea perceptible en CUALQUIER superficie. Patron Linear/
        // Stripe: hover visible pero no agresivo.
        content: { hoverBackground: '{surface.200}' },
        // text.muted.color default de Aura = surface.500. Sobre
        // bg-surface-200 (breadcrumb + p-selectbutton label) quedaba en
        // 4.07:1 — por debajo de WCAG 2.1 AA (4.5:1 para texto normal,
        // confirmado via Lighthouse a11y audit 2026-04-23). Bajamos un
        // step a surface.600 (#484a4e con el neutro corporativo) → 8.8:1
        // sobre surface.0 y 6.9:1 sobre surface.200; sigue leyendose
        // "muted" (menos enfasis que text-color, que es surface.700 a
        // 11.5:1) sin quebrar la jerarquia.
        text: { muted: { color: '{surface.600}' } },
      },
      dark: {
        surface: IMPLEMENTOS_NEUTRAL,
        formField: { invalidBorderColor: '{rose.400}' },
        content: { hoverBackground: '{surface.700}' },
        // Dark mode equivalente: default surface.400 sobre bg-surface-700
        // da ~4.0:1. Subimos a surface.300 (#ced0d4) → 12.9:1 sobre
        // surface.950 y 7.4:1 sobre surface.700. El bump brightens muted
        // en dark pero se mantiene visualmente distinto de text-color
        // (surface.0 puro blanco, 20.0:1).
        text: { muted: { color: '{surface.300}' } },
      },
    },
    // Focus ring halo-only estilo Lara — single source of truth del design system.
    // Sobreescribe el default de Aura (outline + halo) por box-shadow puro, mas limpio
    // visualmente y alineado con Tailwind/Radix/Primer. Los tokens se emiten como CSS
    // vars (--p-focus-ring-*) que styles.scss consume en una regla :focus-visible global
    // — propagacion uniforme a componentes PrimeNG y elementos HTML nativos.
    // Border change a primary en form fields viene nativo de formField.focusBorderColor.
    // Ref: ADR-001 §5
    focusRing: {
      width: '0',
      style: 'none',
      color: 'transparent',
      offset: '0',
      shadow: '0 0 0 0.2rem {primary.200}',
    },
  },
});

/**
 * Shared providePrimeNG options consumed by app.config.ts and Storybook.
 * Keeps the dark-mode selector and CSS layer config aligned across both
 * environments — a Storybook story renders with the same token cascade as
 * production.
 */
export const PRIMENG_OPTIONS = {
  // Dark mode explicito por clase (no default 'system'): permite al
  // servidor setear `<html class="p-dark">` segun cookie en SSR para
  // prevenir FOUC, y que el toggle programatico via AppConfigService
  // tenga efecto real en los tokens de PrimeNG. Alineado con patron
  // Tailwind v4 `darkMode: 'class'`. Ref: ADR-001 §4
  darkModeSelector: '.p-dark',
  // Cascade CSS: envuelve PrimeNG en @layer primeng. Efecto:
  // 1. Nuestro :focus-visible global (sin capa) gana por spec CSS cascade layers.
  // 2. Tailwind utilities (capa no declarada en order) gana sobre PrimeNG.
  // Ref: https://primeng.org/guides/csslayer | ADR-001 §3
  cssLayer: {
    name: 'primeng',
    order: 'theme, base, primeng',
  },
} as const;
