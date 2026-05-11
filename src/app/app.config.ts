import {
  ApplicationConfig,
  ErrorHandler,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter, withPreloading } from '@angular/router';
import {
  provideClientHydration,
  withEventReplay,
  withIncrementalHydration,
} from '@angular/platform-browser';
import { providePrimeNG } from 'primeng/config';
import { routes } from './app.routes';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { AppErrorHandler } from './core/services/error-handler/app-error-handler';
import { BrowserPreloadingStrategy } from './core/strategies/browser-preloading.strategy';
import { AppConfigService } from './core/services/app-config/app-config.service';
import { AppPreset, PRIMENG_OPTIONS } from './app.preset';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    // Global error handling:
    //   1. `provideBrowserGlobalErrorListeners()` (Angular 21+) attaches
    //      `window.onerror` + `unhandledrejection` listeners para capturar
    //      errores que escapen del zone de Angular (setTimeout handlers,
    //      fetch promises non-awaited, addEventListener callbacks externos).
    //      Sin esto, esos errores solo viven en el console del browser y no
    //      llegan al ErrorHandler.
    //   2. Override del `ErrorHandler` default: reemplaza el `console.error`-
    //      simple por `AppErrorHandler` con logging estructurado + SSR
    //      platform-scope. En prod con backend real sustituir el console por
    //      SDK de observabilidad (Sentry, Datadog, Rollbar, NewRelic).
    provideBrowserGlobalErrorListeners(),
    { provide: ErrorHandler, useClass: AppErrorHandler },
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
        options: PRIMENG_OPTIONS,
      },
    }),
  ],
};
