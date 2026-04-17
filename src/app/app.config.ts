import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withPreloading } from '@angular/router';
import {
  provideClientHydration,
  withEventReplay,
} from '@angular/platform-browser';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeuix/themes/aura';
import { definePreset } from '@primeuix/themes';
import { routes } from './app.routes';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { BrowserPreloadingStrategy } from './core/strategies/browser-preloading.strategy';

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
    provideClientHydration(withEventReplay()),
    providePrimeNG({
      theme: {
        preset: AppPreset,
        options: {
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
