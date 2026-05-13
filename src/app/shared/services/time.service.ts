import { isPlatformBrowser } from '@angular/common';
import { computed, DestroyRef, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';

const TICK_INTERVAL_MS = 60_000;

/**
 * Single global "current time" signal. Reemplaza N timers per-instance del
 * `RelativeTimePipe`: en una vista con 38 inbox items + 32 alerts + 6
 * deploys había 70+ `setInterval` corriendo en paralelo, cada uno
 * disparando su propio `markForCheck`. Acá hay UNO solo.
 *
 * Pattern bigtech (Linear timeago, Vercel relative-time, GitHub):
 * - 1 service singleton con `signal<number>` que tickea cada 60s
 * - Pipes/components leen `now()` y se invalidan automáticamente cuando
 *   cambia el signal
 * - Visibility change refresca al volver de background (browsers throttlean
 *   timers en pestañas inactivas → relative times quedan stale)
 *
 * SSR-safe: en server no se agenda el interval (no `document`/`window`).
 */
@Injectable({ providedIn: 'root' })
export class TimeService {
  private platformId = inject(PLATFORM_ID);
  private destroyRef = inject(DestroyRef);

  private readonly _now = signal<number>(Date.now());
  /** Tick reactivo de "now" en ms epoch. Se actualiza cada 60s en browser. */
  readonly now = this._now.asReadonly();

  /**
   * Fuerza un tick sincrónico de "now". Útil cuando un consumer acaba
   * de generar un timestamp fresco (ej: `_lastFetchedAt = new Date()`)
   * y necesita que pipes relativos comparen contra un "now" igualmente
   * fresco — sin esto, el pipe puede ver `value > now` (porque el
   * signal aún tiene el `_now` del tick anterior, hasta 60s atrás) y
   * renderizar "en el futuro" durante la ventana siguiente.
   *
   * Patrón GitHub/Linear: cualquier mutación que genere timestamps
   * push-updatea el time-source. Mantiene la invariante `now ≥ valor`
   * en data acabada de fetchear, sin esperar al próximo tick natural.
   */
  bump(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this._now.set(Date.now());
  }

  /** Hora 0-23 reactiva — útil para greetings que cambian con el día. */
  readonly hour = computed(() => new Date(this._now()).getHours());

  /** Periodo del día derivado — usado por `obs-inbox` headline greeting. */
  readonly dayPeriod = computed<'morning' | 'afternoon' | 'evening'>(() => {
    const h = this.hour();
    if (h < 12) return 'morning';
    if (h < 19) return 'afternoon';
    return 'evening';
  });

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;

    const intervalId = setInterval(() => {
      this._now.set(Date.now());
    }, TICK_INTERVAL_MS);

    // Force-refresh al volver de background — los browsers throttlean
    // setInterval en tabs inactivos (Chrome 1-min mínimo, Safari hasta
    // suspend total). Sin esto, "hace 3 min" puede quedar stale 30+ min
    // hasta el próximo tick legítimo.
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        this._now.set(Date.now());
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    this.destroyRef.onDestroy(() => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibility);
    });
  }
}
