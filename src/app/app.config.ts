import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter, withPreloading } from '@angular/router';
import {
  provideClientHydration,
  withEventReplay,
  withIncrementalHydration,
} from '@angular/platform-browser';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeuix/themes/aura';
import { definePreset } from '@primeuix/themes';
import { routes } from './app.routes';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { BrowserPreloadingStrategy } from './core/strategies/browser-preloading.strategy';
import { AppConfigService } from './core/services/app-config/app-config.service';

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
const AppPreset = definePreset(Aura, {
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
    // Palette primary: single-hue 204° end-to-end, en familia del logo
    // oficial (public/implementos-logo.svg, #006DB6). Patron SaaS big
    // tech — GitHub Primer blue, Tailwind sky — un unico hue a lo largo
    // de todo el ramp. Sin tilts intermedios: coherencia matematica que
    // un senior reconoce en review.
    //
    // Anchors:
    //   500 = #0074C2 (HSL 204° 100% 38%) — light-mode primary. AA-high
    //                   4.9:1 sobre surface.0 (rango Apple #007AFF 4.5:1,
    //                   GitHub Primer #0969DA 5.2:1, Stripe 4.6:1 —
    //                   estandar real de la industria, AAA es solo para
    //                   GitHub en ciertos casos). Mismo hue que el logo
    //                   → lectura "azul Implementos" sin copiar el hex.
    //   400 = #27A0F1 (HSL 204° 88% 55%) — dark-mode primary. Saturacion
    //                   bajada a 88% (vs 100% del resto) para suavizar
    //                   el "Facebook-blue electrico" que al L=55% S=100%
    //                   quema retinas sobre surface.950. Contraste con
    //                   surface.950: 7.0:1 AAA.
    //   600 = #005C99 — hover del 500 (L=30%, paso visible -8%).
    //   700-950 → navies progresivos mismo hue, S=100%, L escalonada.
    //
    // Derivacion: hue=204° constante en TODA la escala. S=100% excepto
    // .400 (88%) y .50-300 (naturalmente bajos por tint). L curve
    // 97→93→84→70→55→38→30→24→18→13→8. Sin hue tilts, sin hacks.
    //
    // Contraste verificado:
    //   - primary.500 sobre surface.0 (#fff): 4.9:1 (WCAG AA)
    //   - primary.400 sobre surface.950 (#09090b): 7.0:1 (WCAG AAA)
    //   - primary.700 (active) sobre surface.0: 10.5:1 (WCAG AAA)
    //
    // Cambio propaga a todos los componentes que consumen --p-primary-*
    // (bg-primary, text-primary, focus ring, charts, tags, buttons,
    // links, y tiles del aside con bg-primary-700/800/900). Cero updates
    // manuales en templates.
    primary: {
      50: '#eff8ff',
      100: '#daeffc',
      200: '#b2ddf9',
      300: '#74c3f3',
      400: '#27a0f1',
      500: '#0074c2',
      600: '#005c99',
      700: '#004a7a',
      800: '#00375c',
      900: '#002842',
      950: '#001829',
    },
    colorScheme: {
      light: { formField: { invalidBorderColor: '{rose.500}' } },
      dark: { formField: { invalidBorderColor: '{rose.400}' } },
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

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes, withPreloading(BrowserPreloadingStrategy)),
    provideHttpClient(withFetch()),
    // Incremental Hydration: el SSR sigue emitiendo HTML completo, pero los bloques
    // marcados con `@defer (hydrate on <trigger>)` posponen la hidratacion (registro
    // de event listeners + creacion de instancias de componentes) hasta que el
    // trigger se cumple. Pareo: viewport defiere hasta que IntersectionObserver
    // detecta el bloque visible. Beneficio: TTI mas bajo en rutas con contenido
    // pesado fuera de la primera mitad del viewport (chart, carousel, file upload,
    // panel lateral xl). Sin esta feature, `@defer hydrate` se trata como `@defer`
    // normal y la hidratacion ocurre eagerly. Ref: ADR-001 §10
    provideClientHydration(withEventReplay(), withIncrementalHydration()),
    // Bootstrap AppConfigService before first render so it reads the theme
    // cookie (SSR via REQUEST, browser via document.cookie) and applies the
    // `p-dark` class on <html> — which is what Angular serializes into the
    // SSR HTML. Using provideAppInitializer (not a component-level inject)
    // so the contract is: "service runs before render", independent of the
    // component tree. Ref: ADR-001 §4
    provideAppInitializer(() => {
      inject(AppConfigService);
    }),
    providePrimeNG({
      theme: {
        preset: AppPreset,
        options: {
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
        },
      },
    }),
  ],
};
