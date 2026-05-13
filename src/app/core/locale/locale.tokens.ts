import { InjectionToken } from '@angular/core';

/**
 * Single source of truth for the app's BCP-47 locale identifier.
 *
 * **Why a token, not a hard-coded string in every component**
 *
 *   The codebase had grown two independent copies of `'es-CL'` —
 *   `customers.component.ts` instantiating `Intl.NumberFormat('es-CL', …)`
 *   and `obs-uptime.component.ts` doing the same with `Intl.DateTimeFormat`.
 *   Adding pt-BR or es-AR would have been a ten-touchpoint refactor.
 *
 *   This token lifts the locale to the DI tree. Every formatter, every
 *   `pipe`-free component, every test consumes the token instead of a
 *   literal. To swap locales (multi-tenant SaaS, language picker, A/B
 *   experiment, pseudo-localisation), override the provider in one place.
 *
 * **Default**: `'es-CL'`. Defined in `locale.config.ts` because the
 * default belongs with the configuration, not in the token definition.
 *
 * **Pattern reference**: Atlassian Design System `LocaleProvider`,
 * Carbon's `@carbon/utilities/locale`, Polaris `i18n.locale` — every
 * mature DS hides the locale behind a provider boundary.
 */
export const APP_LOCALE = new InjectionToken<string>('APP_LOCALE');

/**
 * Currency code (ISO 4217) — the default is `'CLP'` but the token
 * exists so SaaS customers in other countries can switch.
 */
export const APP_CURRENCY = new InjectionToken<string>('APP_CURRENCY');

/**
 * Time zone (IANA) — controls every `Intl.DateTimeFormat` usage that
 * needs explicit zone, instead of leaking the server zone into the
 * UI. Defaults to `'America/Santiago'`.
 */
export const APP_TIME_ZONE = new InjectionToken<string>('APP_TIME_ZONE');
