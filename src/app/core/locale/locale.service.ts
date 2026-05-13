import { inject, Injectable } from '@angular/core';

import {
  APP_CURRENCY,
  APP_LOCALE,
  APP_TIME_ZONE,
} from './locale.tokens';

/**
 * Memoised `Intl` formatter factory.
 *
 * **Why**
 *
 *   `new Intl.NumberFormat('es-CL', …)` is expensive (~0.5–2ms in V8).
 *   Building one per render destroys perf; building one per component
 *   instance is the second-worst option (every module re-creates the
 *   same formatter). Big-tech systems cache by `(locale, options)`
 *   tuple — Atlassian's `IntlNext`, Stripe's `formatters.ts`, Twilio's
 *   `i18n` all share this shape.
 *
 *   The service caches lazily and is `providedIn: 'root'` so every
 *   component reads from the same pool. Swap the locale token at the
 *   DI tree root, the cache invalidates with the service instance.
 *
 * **Why not Angular `DatePipe`/`CurrencyPipe`**
 *
 *   Pipes invoke during change detection, which is wasteful in
 *   zoneless mode where signals already drive re-renders. Computed
 *   signals + Intl + this service produce one render-time format
 *   call, not one per CD cycle.
 */
@Injectable({ providedIn: 'root' })
export class AppLocaleService {
  private readonly locale = inject(APP_LOCALE);
  private readonly currency = inject(APP_CURRENCY);
  private readonly timeZone = inject(APP_TIME_ZONE);

  private readonly numberCache = new Map<string, Intl.NumberFormat>();
  private readonly dateCache = new Map<string, Intl.DateTimeFormat>();
  private readonly relativeCache = new Map<string, Intl.RelativeTimeFormat>();

  /** The active BCP-47 locale tag (`'es-CL'` by default). */
  readonly localeTag: string = this.locale;
  /** The active ISO 4217 currency code (`'CLP'` by default). */
  readonly currencyCode: string = this.currency;
  /** The active IANA time zone (`'America/Santiago'` by default). */
  readonly timeZoneId: string = this.timeZone;

  /**
   * Format a number as currency. Uses the app's currency code unless
   * overridden — multi-tenant tenants might display USD even when the
   * locale is `'es-CL'`.
   */
  formatCurrency(value: number, currency = this.currency): string {
    return this.getNumberFormatter({
      style: 'currency',
      currency,
      currencyDisplay: 'symbol',
    }).format(value);
  }

  /** Format a number with grouping & per-locale decimal separator. */
  formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
    return this.getNumberFormatter(options ?? {}).format(value);
  }

  /** Format a percentage (input is fractional: 0.18 → "18 %"). */
  formatPercent(value: number, fractionDigits = 0): string {
    return this.getNumberFormatter({
      style: 'percent',
      maximumFractionDigits: fractionDigits,
    }).format(value);
  }

  /** Format a date with the requested `dateStyle`. */
  formatDate(
    value: Date | number,
    options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
  ): string {
    return this.getDateFormatter(options).format(value);
  }

  /**
   * Format a relative time delta. `value` is the delta in the given
   * `unit` (e.g. `-3, 'day'` → "hace 3 días").
   */
  formatRelative(
    value: number,
    unit: Intl.RelativeTimeFormatUnit,
    options: Intl.RelativeTimeFormatOptions = { numeric: 'auto' },
  ): string {
    return this.getRelativeFormatter(options).format(value, unit);
  }

  /**
   * Direct accessor in case a consumer needs `formatToParts()` or
   * other API surface not surfaced here. Returns the cached
   * formatter — DO NOT mutate.
   */
  getNumberFormatter(options: Intl.NumberFormatOptions): Intl.NumberFormat {
    const key = this.cacheKey(options);
    let fmt = this.numberCache.get(key);
    if (!fmt) {
      fmt = new Intl.NumberFormat(this.locale, options);
      this.numberCache.set(key, fmt);
    }
    return fmt;
  }

  getDateFormatter(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
    const merged = { timeZone: this.timeZone, ...options };
    const key = this.cacheKey(merged);
    let fmt = this.dateCache.get(key);
    if (!fmt) {
      fmt = new Intl.DateTimeFormat(this.locale, merged);
      this.dateCache.set(key, fmt);
    }
    return fmt;
  }

  getRelativeFormatter(
    options: Intl.RelativeTimeFormatOptions,
  ): Intl.RelativeTimeFormat {
    const key = this.cacheKey(options);
    let fmt = this.relativeCache.get(key);
    if (!fmt) {
      fmt = new Intl.RelativeTimeFormat(this.locale, options);
      this.relativeCache.set(key, fmt);
    }
    return fmt;
  }

  /**
   * Stable hash of options object — sort the keys so `{ a: 1, b: 2 }`
   * and `{ b: 2, a: 1 }` map to the same cache slot. Accepts the
   * union of Intl option types (NumberFormatOptions /
   * DateTimeFormatOptions / RelativeTimeFormatOptions); the cast to
   * `Record<string, unknown>` is safe because Intl options are
   * always shallow string-keyed records of primitives.
   */
  private cacheKey(options: object): string {
    const dict = options as Record<string, unknown>;
    const keys = Object.keys(dict).sort();
    const parts: string[] = [];
    for (const k of keys) parts.push(`${k}=${String(dict[k])}`);
    return parts.join('|');
  }
}
