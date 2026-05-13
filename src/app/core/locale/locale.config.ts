import { Provider } from '@angular/core';

import {
  APP_CURRENCY,
  APP_LOCALE,
  APP_TIME_ZONE,
} from './locale.tokens';

/**
 * Default locale configuration. Spanish (Chile), Chilean peso,
 * America/Santiago time zone. Override at bootstrap by re-providing
 * any subset of the tokens — the providers below are array-spreadable
 * into `appConfig.providers`.
 */
export const DEFAULT_APP_LOCALE = 'es-CL';
export const DEFAULT_APP_CURRENCY = 'CLP';
export const DEFAULT_APP_TIME_ZONE = 'America/Santiago';

/**
 * Default providers — included in `appConfig.providers`. Consumers
 * needing a different locale (multi-tenant SaaS, language picker,
 * pseudo-localisation in CI) override individual tokens AFTER these
 * in the providers array.
 */
export const provideAppLocale: () => Provider[] = () => [
  { provide: APP_LOCALE, useValue: DEFAULT_APP_LOCALE },
  { provide: APP_CURRENCY, useValue: DEFAULT_APP_CURRENCY },
  { provide: APP_TIME_ZONE, useValue: DEFAULT_APP_TIME_ZONE },
];
