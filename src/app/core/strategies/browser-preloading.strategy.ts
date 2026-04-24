import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { PreloadingStrategy, Route } from '@angular/router';
import { Observable, of } from 'rxjs';

/**
 * Preloading strategy que espera **idle time real** del navegador vía
 * `requestIdleCallback`, con fallback a `setTimeout` para Safari <17 (donde
 * rIC no estaba expuesto) y para runtimes que no lo implementan. El chunk
 * lazy se precarga en background sin competir con el LCP de la ruta activa.
 *
 * **Patrón bigtech:**
 *   - Google web.dev "route preloading" recomienda rIC: https://web.dev/articles/route-preloading-in-angular
 *   - Angular 18+ incluye `withViewTransitions()` pero `IdlePreloadingStrategy`
 *     no expone SSR guard ni timeout config — rolling our own es el patrón
 *     documentado en Angular docs para control fino.
 *   - Netflix/Airbnb/Linear preload post-idle para rutas predecibles.
 *
 * **Por qué rIC sobre `timer(2000)` (ronda anterior):** `rIC` se programa
 * cuando el main thread REALMENTE está libre (post-hydration, post-Chart
 * init, sin long tasks pendientes). `timer(2000)` dispara tras 2s wall-clock
 * aunque el main thread siga ocupado — en mobile con red lenta + app grande
 * eso puede colisionar con el LCP. `rIC` con timeout=2500 garantiza que si
 * nunca hay idle, preload ocurre igual al llegar al deadline.
 *
 * **SSR:** `of(null)` — preload no tiene sentido server-side.
 *
 * **Limpieza:** no retenemos el handle de rIC porque Angular maneja la
 * subscription del Observable; si el consumer cancela (router destroys
 * before preload fires), el Observable se completa sin ejecutar `load()`.
 */
@Injectable({ providedIn: 'root' })
export class BrowserPreloadingStrategy implements PreloadingStrategy {
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private document = inject(DOCUMENT);

  /**
   * Timeout del `requestIdleCallback`: si el main thread nunca idle-es
   * (tab en background, página pesada), el preload dispara igual a los 2.5s.
   * Conservador frente al LCP target (<2.5s para "Good") — no queremos
   * colisionar con el primer contentful paint de la ruta activa.
   */
  private static readonly IDLE_TIMEOUT_MS = 2500;

  preload(_route: Route, load: () => Observable<unknown>): Observable<unknown> {
    if (!this.isBrowser) return of(null);
    const win = this.document.defaultView;
    if (!win) return of(null);

    return new Observable<unknown>((subscriber) => {
      let cancelled = false;

      const start = (): void => {
        if (cancelled) return;
        load().subscribe({
          next: (v) => subscriber.next(v),
          error: (e) => subscriber.error(e),
          complete: () => subscriber.complete(),
        });
      };

      if (typeof win.requestIdleCallback === 'function') {
        const handle = win.requestIdleCallback(start, {
          timeout: BrowserPreloadingStrategy.IDLE_TIMEOUT_MS,
        });
        return (): void => {
          cancelled = true;
          win.cancelIdleCallback?.(handle);
        };
      }
      // Safari <17 fallback: setTimeout con el mismo timeout como ceiling.
      const timeoutHandle = win.setTimeout(
        start,
        BrowserPreloadingStrategy.IDLE_TIMEOUT_MS,
      );
      return (): void => {
        cancelled = true;
        win.clearTimeout(timeoutHandle);
      };
    });
  }
}
