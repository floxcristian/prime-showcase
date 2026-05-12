import { isPlatformBrowser } from '@angular/common';
import {
  ErrorHandler,
  inject,
  Injectable,
  PLATFORM_ID,
} from '@angular/core';

/**
 * Custom ErrorHandler global — reemplaza el default de Angular que solo hace
 * `console.error` sin contexto. Captura:
 *   - Errores no manejados en zone (runtime, click handlers, effects).
 *   - Promise rejections capturadas por Angular al bootstrap.
 *   - Errores lanzados desde lifecycle hooks, pipes, interceptors HTTP.
 *
 * **Por qué es crítico enterprise-grade:**
 *   Sin este handler, un `undefined.foo` en un handler de click rompe
 *   silenciosamente el feature — el usuario ve un estado inconsistente sin
 *   feedback, y el equipo no se entera hasta que llega el ticket. En
 *   producción este handler debe enviar el error a un backend (Sentry, NewRelic,
 *   Rollbar, Datadog). En el showcase loggeamos con contexto estructurado al
 *   console para que DevTools → Application → Console lo capture con stack.
 *
 * **SSR safety:** durante server render, inyectamos PLATFORM_ID y loggeamos
 * al `console.error` del proceso Node. No intentamos `window.*` ni
 * `navigator.*`. El hook `provideBrowserGlobalErrorListeners` es browser-only
 * (se registra a `window.onerror` + `unhandledrejection`) y no conflicta.
 *
 * **No tragar errores:** tras loguear hacemos `throw` (o re-throw en zoneless)
 * para preservar el stack trace original en DevTools. Angular's default también
 * lo hace pero sin logging estructurado.
 *
 * Ref: https://angular.dev/api/core/ErrorHandler
 *      https://angular.dev/guide/error-handling
 */
@Injectable({ providedIn: 'root' })
export class AppErrorHandler implements ErrorHandler {
  private platformId = inject(PLATFORM_ID);

  handleError(error: unknown): void {
    const isBrowser = isPlatformBrowser(this.platformId);
    const scope = isBrowser ? 'client' : 'server';
    const payload = this.serialize(error);

    // Log estructurado: prefijo identifica source, stack preservado. En prod
    // se sustituye por `fetch('/api/errors', { body: JSON.stringify(payload) })`
    // o SDK específico (Sentry.captureException, Datadog logs.error).
    //
    // **Por qué NO re-throw:** el `provideBrowserGlobalErrorListeners()`
    // registra `window.onerror` + `unhandledrejection` que atrapan lo que
    // escape del ErrorHandler — si además hicimos `throw` aquí, el mismo
    // error se reportaría DOS veces (una por este handler, otra por el
    // listener global). El default de Angular solo hace `console.error`
    // sin re-throw; seguimos ese contrato para evitar duplicados.
    // Ref: https://angular.dev/api/core/ErrorHandler (el ErrorHandler
    // default de Angular tampoco re-throw; solo logea).
    //
     
    console.error(`[${scope} error]`, payload);
  }

  private serialize(error: unknown): Record<string, unknown> {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
        cause: error.cause,
      };
    }
    return { type: typeof error, value: error };
  }
}
