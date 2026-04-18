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
  semantic: {
    transitionDuration: '0s',
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
