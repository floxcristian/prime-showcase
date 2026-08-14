/**
 * Seed determinista de `TenantProviderState` para los fixtures `-seeded`
 * de Playwright (RFC-001 D7.2 — dueño de la decisión; RFC-003 D6.1 + plan
 * §7 — dueño de las keys de storage y su shape).
 *
 * Las entries `-seeded` de `tests/fixtures/routes.ts` (Waves B/C) crean el
 * contexto con `storageState.origins` pre-poblando el localStorage del
 * origin ANTES de la primera navegación — cero cambios a la app: la
 * página lee su configuración como si el cliente hubiera completado el
 * onboarding (registro → keys válidas → 3 redes conectadas → checklist
 * descartado).
 *
 * **Solo factories puras de `src/`** (RFC-002 criterios: importables desde
 * el harness, sin Angular): `buildAccountMock`, `PROVIDER_CATALOG`,
 * `SOCIAL_NETWORKS` y `seededRandom` — el shape persistido NUNCA se
 * duplica a mano (acoplamiento test↔src aceptado por RFC-003
 * consecuencias, a cambio de cero drift).
 *
 * **Timestamps RELATIVOS al momento de setup** (RFC-001 D7.2):
 * `connectedAt` = now − 24 h y `lastSyncAt` = now − 30 min → los strings
 * de `| relativeTime` son estables run-a-run ("hace 1 día" / "hace 30
 * min") y `connectedAt` queda MUY lejos del `TOKEN_TTL_MS` de 7 días
 * (RFC-002 D6 / RFC-003 D4.3): el status efectivo que computa
 * `SocialSettingsService` en lectura sigue siendo `connected`.
 *
 * **Seguridad del showcase:** se persiste ÚNICAMENTE `maskedKey`
 * (fabricada determinista con el formato `maskPrefix` — primeros ~14
 * chars + `…` + últimos 4). Jamás existe un plaintext en este seed
 * (criterio "grep de seguridad" de RFC-003).
 */
import { buildAccountMock } from '../../src/app/modules/social/mocks/accounts-mock';
import { PROVIDER_CATALOG } from '../../src/app/modules/social/mocks/provider-catalog';
import type {
  ApiKeyEntry,
  ConnectorConfig,
  ProviderId,
  ProviderKind,
  TenantProviderState,
} from '../../src/app/modules/social/models/provider.interface';
import type { SocialAccount } from '../../src/app/modules/social/models/social.interface';
import { SOCIAL_NETWORKS } from '../../src/app/modules/social/models/social.interface';
import { seededRandom } from '../../src/app/shared/utils/mock-utils';

/**
 * Email del cliente de test — el MISMO que la cookie de sesión de
 * `tests/fixtures/auth.ts` escribe (allí vive como const privada; este
 * archivo la re-declara exportada porque su ownership no permite tocar
 * `auth.ts`). Si alguna vez divergen, el seed queda scoped a un cliente
 * que no es el de la sesión y las páginas seeded renderizan vacías —
 * mantener ambos valores idénticos.
 */
export const TEST_EMAIL = 'visual-regression@example.com';

/**
 * `clientId` = email normalizado (`trim().toLowerCase()`) — exactamente la
 * normalización de `SocialSettingsService.clientId` (RFC-003 D1). Es el
 * sufijo de las cinco keys de storage Y el `clientSeed` de las factories
 * (RFC-002 D6): mismo valor, mismo aislamiento multi-tenant.
 */
const CLIENT_ID = TEST_EMAIL.trim().toLowerCase();

/**
 * brandName "del signup" del cliente de test (RFC-003 D2/D6.1,
 * `social:profile:v1`). Se pasa a `buildAccountMock` igual que lo haría
 * `connectAccount` → `displayName` de las 3 cuentas en las capturas.
 */
export const SOCIAL_SEED_BRAND_NAME = 'Comercial Andina';

/**
 * Base names versionados de RFC-003 D6.1 (contrato congelado). El scope
 * por cliente va como sufijo: `social:provider-config:v1::<clientId>`.
 * `SocialSettingsService` declara los mismos strings como consts privadas
 * — transcriptos del RFC en ambos lados; cualquier bump de versión (v2)
 * debe tocar los dos archivos.
 */
const STORAGE_BASES = {
  /** `ConnectorConfig[]` + `activeByKind` (Pick de `TenantProviderState`). */
  providerConfig: 'social:provider-config:v1',
  /** `ApiKeyEntry[]` — SOLO `maskedKey`, jamás plaintext. */
  apiKeys: 'social:api-keys:v1',
  /** `SocialAccount[]` conectadas por el cliente. */
  connections: 'social:connections:v1',
  /** `{ brandName }` del signup (RFC-003 D2). */
  profile: 'social:profile:v1',
  /** `{ checklistDismissed: boolean }` (RFC-003 D3). */
  onboarding: 'social:onboarding:v1',
} as const;

const storageKey = (base: string): string => `${base}::${CLIENT_ID}`;

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

/** Categorías de generación con provider activo (RFC-003 D5.4 —
 *  `analytics-connector` nunca aparece como key de `activeByKind`). */
type GenProviderKind = Exclude<ProviderKind, 'analytics-connector'>;
const GENERATION_KINDS: readonly GenProviderKind[] = [
  'text-gen',
  'image-gen',
  'video-gen',
];

/** Id determinista de la key seed de un provider (estable para
 *  baselines; el formato runtime con `Date.now().toString(36)` es solo
 *  del flujo interactivo de alta, RFC-003 D5.3). */
const seedKeyId = (providerId: ProviderId): string => `key-seed-${providerId}`;

const KEY_CHARS =
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

const charsFrom = (rand: () => number, n: number): string =>
  Array.from({ length: n }, () =>
    KEY_CHARS.charAt(Math.floor(rand() * KEY_CHARS.length)),
  ).join('');

/**
 * Fabrica una `maskedKey` determinista con el formato `maskPrefix` del
 * repo (`api-keys-mock.service.ts`: primeros ~14 chars + `…` + últimos 4)
 * respetando el prefijo real del provider (`keyFormatHint` del catálogo,
 * p.ej. `EAA…` → `EAAxK2…f9Qz`). NO deriva de ningún plaintext: la
 * máscara se genera directo — no existe secreto que enmascarar.
 */
const buildMaskedKey = (
  providerId: ProviderId,
  keyFormatHint: string,
): string => {
  const rand = seededRandom(`social-seed:key:${providerId}`);
  const prefix = keyFormatHint.replace('…', '');
  const head = prefix + charsFrom(rand, Math.max(0, 14 - prefix.length));
  return `${head}…${charsFrom(rand, 4)}`;
};

/**
 * `TenantProviderState` del cliente seeded, determinista salvo por los
 * timestamps relativos a `nowMs` (default: momento de setup):
 *
 * - **3 cuentas conectadas** (una por red, orden canónico
 *   `SOCIAL_NETWORKS`) derivadas de `TEST_EMAIL` EXACTAMENTE como lo
 *   haría `connectAccount` (misma factory `buildAccountMock`, mismo
 *   `clientSeed`/`brandName`); `connectedAt` = now − 24 h y `lastSyncAt`
 *   = now − 30 min (RFC-001 D7.2).
 * - **Keys `valid`** para los 3 conectores de analytics y para el
 *   provider activo de cada categoría de generación (prerequisito de
 *   conexión, RFC-003 D4.2; `enabled` exige key válida, D5.3).
 * - **Conectores `enabled`** con su `activeKeyId`; el resto del catálogo
 *   queda `disabled` sin key (config derivada del catálogo entero, mismo
 *   criterio que `EMPTY_TENANT_STATE`: cero drift si el catálogo crece).
 * - **Un provider de generación activo por categoría** — el primero del
 *   catálogo por kind, espejo de "al habilitar el primero de una
 *   categoría se vuelve activo automáticamente" (RFC-003 D5.4).
 */
export const buildSocialSeedState = (
  nowMs: number = Date.now(),
): TenantProviderState => {
  const activeByKind: Partial<Record<ProviderKind, ProviderId>> = {};
  for (const kind of GENERATION_KINDS) {
    const first = PROVIDER_CATALOG.find((d) => d.kind === kind);
    if (first) {
      activeByKind[kind] = first.id;
    }
  }

  const enabledIds = new Set<ProviderId>([
    ...PROVIDER_CATALOG.filter((d) => d.kind === 'analytics-connector').map(
      (d) => d.id,
    ),
    ...Object.values(activeByKind),
  ]);

  // Key agregada y verificada "ayer", junto con la conexión de cuentas:
  // "Verificada hace 1 día" estable en las cards de providers.
  const dayAgoIso = new Date(nowMs - DAY_MS).toISOString();

  const keys: readonly ApiKeyEntry[] = PROVIDER_CATALOG.filter((d) =>
    enabledIds.has(d.id),
  ).map((d) => ({
    id: seedKeyId(d.id),
    providerId: d.id,
    maskedKey: buildMaskedKey(d.id, d.keyFormatHint),
    status: 'valid',
    lastVerifiedAt: dayAgoIso,
    createdAt: dayAgoIso,
    label: 'Producción',
  }));

  const configs: readonly ConnectorConfig[] = PROVIDER_CATALOG.map((d) =>
    enabledIds.has(d.id)
      ? {
          providerId: d.id,
          enabled: true,
          activeKeyId: seedKeyId(d.id),
          options: {},
        }
      : { providerId: d.id, enabled: false, options: {} },
  );

  // `buildAccountMock` deja connectedAt = lastSyncAt = epoch → se pasa
  // now − 24 h como epoch y se adelanta SOLO lastSyncAt a now − 30 min
  // ("sincronizó hace 30 min"). followers/handle/id no dependen del
  // epoch: idénticos a los que produciría el flujo connect real.
  const lastSyncIso = new Date(nowMs - 30 * MINUTE_MS).toISOString();
  const accounts: readonly SocialAccount[] = SOCIAL_NETWORKS.map(
    (network) => ({
      ...buildAccountMock(nowMs - DAY_MS, CLIENT_ID, SOCIAL_SEED_BRAND_NAME, network),
      lastSyncAt: lastSyncIso,
    }),
  );

  return { configs, keys, accounts, activeByKind };
};

/** Par name/value listo para `storageState.origins[].localStorage`. */
export interface SocialSeedStorageEntry {
  readonly name: string;
  readonly value: string;
}

/**
 * Las CINCO keys versionadas de RFC-003 D6.1 con sufijo `::<TEST_EMAIL>`,
 * serializadas al shape que `storageState.origins[].localStorage` de
 * Playwright espera. El array es mutable (no `readonly`) a propósito:
 * el tipo `Origin` de Playwright pide `{ name, value }[]`.
 *
 * `checklistDismissed: true` (RFC-001 D7.2): el checklist de primeros
 * pasos no tapa las capturas seeded — lo capturado es la página poblada.
 */
export const buildSocialSeedLocalStorage = (
  nowMs: number = Date.now(),
): SocialSeedStorageEntry[] => {
  const state = buildSocialSeedState(nowMs);
  return [
    {
      name: storageKey(STORAGE_BASES.providerConfig),
      value: JSON.stringify({
        configs: state.configs,
        activeByKind: state.activeByKind,
      }),
    },
    {
      name: storageKey(STORAGE_BASES.apiKeys),
      value: JSON.stringify(state.keys),
    },
    {
      name: storageKey(STORAGE_BASES.connections),
      value: JSON.stringify(state.accounts),
    },
    {
      name: storageKey(STORAGE_BASES.profile),
      value: JSON.stringify({ brandName: SOCIAL_SEED_BRAND_NAME }),
    },
    {
      name: storageKey(STORAGE_BASES.onboarding),
      value: JSON.stringify({ checklistDismissed: true }),
    },
  ];
};

/**
 * Entry completa para `storageState.origins` (conveniencia del fixture:
 * el `origin` sale del `baseURL` del contexto, igual que la cookie en
 * `tests/fixtures/auth.ts`).
 */
export const buildSocialSeedOrigin = (
  origin: string,
  nowMs: number = Date.now(),
): { origin: string; localStorage: SocialSeedStorageEntry[] } => ({
  origin,
  localStorage: buildSocialSeedLocalStorage(nowMs),
});
