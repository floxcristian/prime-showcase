// Angular
import { isPlatformBrowser } from '@angular/common';
import {
  computed,
  effect,
  inject,
  Injectable,
  PLATFORM_ID,
  signal,
  type Signal,
} from '@angular/core';
import { defer, delay, map, Observable, of, throwError, timer } from 'rxjs';

// Core / shared
import { AuthService } from '../../../core/services/auth/auth.service';
import { mockLatency } from '../../../shared/utils/mock-latency';
import {
  minutesBefore,
  now,
  seededRandom,
} from '../../../shared/utils/mock-utils';

// Local
import { buildAccountMock } from '../mocks/accounts-mock';
import { EMPTY_TENANT_STATE } from '../mocks/empty-tenant-state';
import { PROVIDER_CATALOG } from '../mocks/provider-catalog';
import { SYNC_FAILURE_REASONS } from '../mocks/social-mock-utils';
import type { OnboardingStep } from '../models/onboarding.interface';
import type {
  ApiKeyEntry,
  ApiKeyStatus,
  ApiKeyWithPlaintext,
  ConnectorConfig,
  ProviderDescriptor,
  ProviderId,
  ProviderKind,
  TenantProviderState,
} from '../models/provider.interface';
import {
  SOCIAL_NETWORKS,
  type SocialAccount,
  type SocialNetwork,
} from '../models/social.interface';
import type { ProviderConfigPort } from '../models/social.ports';

/**
 * TTL del token simulado: **7 días** — compresión demo de los ~60 días
 * reales de los long-lived tokens de Meta (RFC-002 D6 / RFC-003 D4.4).
 * Un cliente demo que vuelve a la semana ve el flujo real de reconexión
 * sin esperar dos meses. El `status: 'expired'` se computa EN LECTURA
 * (`accounts()`), jamás se almacena.
 */
export const TOKEN_TTL_MS = 7 * 86_400_000;

// ── Keys de storage — versionadas y scoped por cliente (RFC-003 D6.1) ──
// Base names versionados; el scope por cliente va como sufijo:
// `social:provider-config:v1::<clientId>`. Cambio de shape ⇒ bump de
// versión (v2) + los datos v1 se ignoran (fallback default), sin migración
// — criterio showcase.
const PROVIDER_CONFIG_KEY = 'social:provider-config:v1'; // ConnectorConfig[] + activeByKind
const API_KEYS_KEY = 'social:api-keys:v1'; // ApiKeyEntry[] — SOLO maskedKey, jamás plaintext
const CONNECTIONS_KEY = 'social:connections:v1'; // SocialAccount[] conectadas por el cliente
const PROFILE_KEY = 'social:profile:v1'; // { brandName } del signup (RFC-003 D2)
const ONBOARDING_KEY = 'social:onboarding:v1'; // { checklistDismissed } (RFC-003 D3)

// ── Reglas deterministas congeladas ────────────────────────────────────

/** Umbral de la regla determinista de sync-error (RFC-002 D6): roll < 0.2. */
const SYNC_ERROR_PROBABILITY = 0.2;

/**
 * Edad mínima de la conexión (24 h) para que la regla de sync-error
 * aplique. El seed `${clientSeed}:sync-err:${network}` está congelado y no
 * cambia al reconectar; sin esta ventana, `reconnectAccount` no podría
 * "limpiar" el error como exige RFC-002 D6 (el mismo roll re-marcaría la
 * cuenta al instante). Con la ventana: una cuenta recién (re)conectada
 * siempre se lee limpia, y el error determinista aparece recién cuando el
 * cliente vuelve al día siguiente — narrativa "falló una sincronización
 * nocturna". Desviación mínima documentada: conserva el seed y el umbral
 * del RFC, agrega solo la condición de edad que hace consistente la regla
 * con la semántica de reconexión.
 */
const SYNC_ERROR_MIN_AGE_MS = 86_400_000;

/** `lastSyncAt` "viejo" (36 h antes del epoch) de la cuenta con sync-error. */
const SYNC_ERROR_LAST_SYNC_MINUTES = 36 * 60;

/** Umbrales de `verifyKey` congelados en RFC-002 D5: <0.75 valid, <0.92 invalid, resto expired. */
const VERIFY_VALID_THRESHOLD = 0.75;
const VERIFY_INVALID_THRESHOLD = 0.92;

/** `failureReason` EXACTO de la cascada de revocación (RFC-003 D5.5.4). */
const REVOKED_CONNECTOR_REASON = 'La credencial del conector fue revocada.';

/** Categorías de generación — las únicas que participan de `activeByKind`
 *  (RFC-002 D3: `analytics-connector` jamás aparece como key). */
const GENERATION_KINDS: readonly ProviderKind[] = [
  'text-gen',
  'image-gen',
  'video-gen',
];

/** Lookup O(1) del catálogo (los IDs son un union cerrado — siempre hay descriptor). */
const DESCRIPTOR_BY_ID: ReadonlyMap<ProviderId, ProviderDescriptor> = new Map(
  PROVIDER_CATALOG.map((descriptor) => [descriptor.id, descriptor]),
);

/**
 * Enmascara estilo `maskPrefix` de `ApiKeysMockService` (users): primeros
 * ~14 chars + `…` + últimos 4. Es lo ÚNICO que se persiste/muestra de una
 * key después del alta — el plaintext vive solo en el retorno de `addKey`.
 */
const maskKey = (plaintext: string): string =>
  `${plaintext.slice(0, 14)}…${plaintext.slice(-4)}`;

// ── Shapes persistidos (payload exacto de cada storage key) ────────────

interface PersistedProviderConfig {
  readonly configs: readonly ConnectorConfig[];
  readonly activeByKind: TenantProviderState['activeByKind'];
}

interface PersistedProfile {
  readonly brandName: string;
}

interface PersistedOnboarding {
  readonly checklistDismissed: boolean;
}

/**
 * Configuración por cuenta de la suite social — ÚNICO dueño del storage
 * (RFC-003 D6): keys de API, conectores habilitados, cuentas conectadas,
 * brandName del signup y descarte del checklist, todo scoped al cliente
 * autenticado. Implementa `ProviderConfigPort` (RFC-002 D4): el swap a
 * backend real es implementar el mismo puerto con HTTP y borrar los
 * helpers de storage — ningún componente cambia.
 *
 * Patrón `CustomersPreferencesService` al pie de la letra: guard
 * `isBrowser` declarado PRIMERO, `try/catch` silencioso centralizado en
 * `readJson`/`writeJson`, signals `asReadonly()` hacia afuera. Las
 * mutaciones actualizan el signal Y persisten en el MISMO método (setter
 * explícito, no `effect` reactivo — contrato del repo, RFC-003 D6.3).
 *
 * **SSR (D6.2):** en server toda lectura devuelve el default
 * (`EMPTY_TENANT_STATE`, checklist visible) — las páginas pintan skeleton
 * y el browser rehidrata desde storage después, sin mismatch.
 *
 * **Multi-tenant demo:** el scope es el email autenticado en claro como
 * sufijo de key (legible en DevTools). Aceptado: no hay secretos (solo
 * máscaras) y es un showcase; en producción el scoping lo hace el backend
 * con un id opaco por token.
 */
@Injectable({ providedIn: 'root' })
export class SocialSettingsService implements ProviderConfigPort {
  /** Guard SSR canónico del repo — debe declararse ANTES de cualquier
   *  field initializer que lo lea (los readers de storage de abajo). */
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly auth = inject(AuthService);

  /**
   * Ancla temporal por instancia (patrón `ObservabilityMockService`): en
   * SSR cada request captura un epoch fresco; en browser la sesión mantiene
   * timestamps y status efectivos estables (baselines deterministas). Es el
   * "ahora" de la expiración por TTL, de los timestamps de connect/addKey y
   * la base de los ids de key — cero `Date.now()` suelto fuera de acá.
   */
  private readonly epoch = now();

  /** Correlativo de ids de key por instancia — junto al epoch garantiza
   *  ids únicos y deterministas dentro de la sesión (una key NUEVA re-tira
   *  el dado de `verifyKey`; la MISMA key repite resultado, RFC-003 D5.3). */
  private keySequence = 0;

  /**
   * Verdicto del shape-check capturado al alta (fase 1 de `verifyKey`,
   * RFC-002 D5). El plaintext se descarta en `addKey`, así que el match
   * contra `keyPattern` solo puede evaluarse en ese momento — este Map en
   * memoria conserva el verdicto por keyId. Keys rehidratadas de storage
   * no figuran (Map vacío ⇒ se asumen shape-OK): pasaron el shape-check del
   * dialog antes de existir, por construcción (RFC-003 D5.2).
   */
  private readonly shapeOkByKeyId = new Map<string, boolean>();

  /**
   * Id de cliente = email de la sesión, normalizado (RFC-003 D1). El
   * usuario mock logueado representa a un cliente registrado del SaaS;
   * TODO dato social (cuentas conectadas, keys, config) se persiste y se
   * lee bajo este scope. Dos sesiones distintas en el mismo browser NO
   * comparten configuración. Sin sesión ⇒ `null` ⇒ no se lee/escribe nada.
   */
  private readonly clientId = computed(
    () => this.auth.email()?.trim().toLowerCase() ?? null,
  );

  /**
   * Semilla del cliente autenticado (RFC-002 D6). TODO dato mock de la
   * suite social se genera con seeds `${clientSeed()}:<scope>` → dos
   * clientes registrados distintos ven cuentas, métricas y recomendaciones
   * distintas; el mismo cliente ve SIEMPRE lo mismo (dentro de la sesión,
   * por epoch; y entre sesiones para todo lo derivado puramente del seed,
   * como handles). En producción el scoping lo hace el backend por token —
   * este seed es la representación frontend de ese aislamiento.
   */
  readonly clientSeed = computed(
    () => this.auth.email()?.trim().toLowerCase() ?? 'demo@showcase',
  );

  // ── Estado persistido (inicializado desde storage en browser) ────────

  private readonly _state = signal<TenantProviderState>(
    this.readTenantState(this.clientId()),
  );
  private readonly _brandName = signal<string>(
    this.readBrandName(this.clientId()),
  );
  private readonly _checklistDismissed = signal<boolean>(
    this.readChecklistDismissed(this.clientId()),
  );

  /** Snapshot crudo persistido (nombre CANÓNICO, RFC-003 D6.3) — los
   *  consumidores de configuración (providers page, studio) leen esto;
   *  los de CUENTAS leen `accounts()` (status efectivo). */
  readonly state: Signal<TenantProviderState> = this._state.asReadonly();

  /** brandName del signup (RFC-003 D2) — saludos/branding y displayName
   *  de las cuentas que `connectAccount` fabrica. */
  readonly brandName: Signal<string> = this._brandName.asReadonly();

  /** Descarte del checklist de primeros pasos (RFC-003 D3), persistido. */
  readonly checklistDismissed: Signal<boolean> =
    this._checklistDismissed.asReadonly();

  /**
   * Red marcada con sync-error por la regla determinista de RFC-002 D6:
   * la PRIMERA red en orden canónico cuyo roll
   * `seededRandom(`${clientSeed}:sync-err:${network}`)()` < 0.2 — así hay
   * a lo sumo UNA cuenta en error aunque varias redes "salgan sorteadas".
   * El segundo draw del mismo PRNG elige el `failureReason` del pool.
   */
  private readonly syncErrorCandidate = computed<{
    readonly network: SocialNetwork;
    readonly reason: string;
  } | null>(() => {
    const seed = this.clientSeed();
    for (const network of SOCIAL_NETWORKS) {
      const rand = seededRandom(`${seed}:sync-err:${network}`);
      if (rand() < SYNC_ERROR_PROBABILITY) {
        const reason =
          SYNC_FAILURE_REASONS[
            Math.floor(rand() * SYNC_FAILURE_REASONS.length)
          ];
        return { network, reason };
      }
    }
    return null;
  });

  /**
   * Cuentas del cliente con `status` EFECTIVO computado en lectura — nunca
   * almacenado (RFC-002 D6 / RFC-003 D4.4): `expired` cuando
   * `epoch − connectedAt > TOKEN_TTL_MS`; `error` determinista por seed en
   * a lo sumo una cuenta (ver `syncErrorCandidate`); el `error` persistido
   * por la cascada de revocación (D5.5) se respeta tal cual. Los
   * consumidores de CUENTAS (analytics, composer) leen ESTE signal.
   */
  readonly accounts: Signal<readonly SocialAccount[]> = computed(() => {
    const candidate = this.syncErrorCandidate();
    return this._state().accounts.map((account) =>
      this.withEffectiveStatus(account, candidate),
    );
  });

  // ── Gating de onboarding (RFC-003 D3) ────────────────────────────────

  /** ¿Hay al menos una cuenta conectada (status connected o expired)?
   * Gating de todas las páginas de analítica/planner. `expired` cuenta
   * como conectada: hay datos históricos que mostrar + banner de
   * reconexión. */
  readonly hasConnectedAccounts: Signal<boolean> = computed(() =>
    this.accounts().some(
      (account) => account.status === 'connected' || account.status === 'expired',
    ),
  );

  /** Memo por kind — `hasReadyProvider` devuelve siempre el MISMO Signal
   *  para el mismo kind (cero alocación de nodos reactivos por llamada). */
  private readonly readyByKind = new Map<ProviderKind, Signal<boolean>>();

  /** ¿Hay al menos un provider de este kind habilitado con key válida?
   * Gating del studio (image-gen/video-gen/text-gen) y del connect de
   * cuentas (analytics-connector, RFC-003 D4.2). */
  hasReadyProvider(kind: ProviderKind): Signal<boolean> {
    const memo = this.readyByKind.get(kind);
    if (memo) {
      return memo;
    }
    const ready = computed(() => this.hasReadyProviderNow(kind));
    this.readyByKind.set(kind, ready);
    return ready;
  }

  /** Pasos del checklist con su estado, derivados — nunca almacenados
   *  (copy es-CL congelado en RFC-003 D3). */
  readonly onboardingSteps: Signal<readonly OnboardingStep[]> = computed(
    () => [
      {
        id: 'account',
        title: 'Creá tu cuenta',
        done: true, // siempre: si esto corre, el cliente ya se registró
        optional: false,
        route: '/social/overview',
      },
      {
        id: 'connector-key',
        title: 'Configurá un conector de analytics',
        done: this.hasReadyProviderNow('analytics-connector'),
        optional: false,
        route: '/social/providers',
      },
      {
        id: 'connect-network',
        title: 'Conectá tu primera red',
        done: this.hasConnectedAccounts(),
        optional: false,
        route: '/social/connections',
      },
      {
        id: 'gen-provider',
        title: 'Habilitá un proveedor de IA',
        done: GENERATION_KINDS.some((kind) => this.hasReadyProviderNow(kind)),
        optional: true, // opcional para analítica (RFC-003 D3)
        route: '/social/providers',
      },
    ],
  );

  /**
   * ÚNICO `effect()` del service (RFC-003 D6.4) — y está justificado:
   * reacciona a un signal EXTERNO (`AuthService.email`), no a estado
   * propio. Ante login/logout/cambio de email re-lee las cinco keys de
   * storage para el nuevo scope y resetea los signals (logout ⇒ defaults).
   * Las mutaciones normales NO pasan por acá: persisten en el mismo método
   * que muta (setter explícito, contrato del repo).
   */
  private lastLoadedClientId = this.clientId();
  private readonly clientScopeEffect = effect(() => {
    const id = this.clientId();
    if (id === this.lastLoadedClientId) {
      return;
    }
    this.lastLoadedClientId = id;
    this._state.set(this.readTenantState(id));
    this._brandName.set(this.readBrandName(id));
    this._checklistDismissed.set(this.readChecklistDismissed(id));
  });

  // ── ProviderConfigPort (RFC-002 D4 — firmas exactas) ─────────────────

  getState(): Observable<TenantProviderState> {
    return defer(() => of(this._state())).pipe(
      delay(mockLatency(200, 300)),
    );
  }

  /**
   * Habilitar exige una key `valid` del provider (RFC-003 D5.3: "solo una
   * key valid permite enabled: true") — la UI deshabilita el toggle antes,
   * el service es la última línea (el puerto real devolvería 403). Al
   * habilitar el PRIMERO de una categoría de generación se vuelve activo
   * automáticamente (D5.4). Deshabilitar limpia/promueve `activeByKind`
   * con el mismo criterio que la revocación (D5.5.3) para conservar el
   * invariante "el activo siempre está habilitado".
   */
  setEnabled(providerId: ProviderId, enabled: boolean): Observable<void> {
    if (!enabled) {
      this.updateState((state) => this.applyDisable(state, providerId));
      return of(undefined).pipe(delay(mockLatency(200, 300)));
    }
    const validKey = this.findValidKey(this._state(), providerId);
    if (!validKey) {
      return throwError(
        () =>
          new Error(
            'El proveedor necesita una API key verificada como válida antes de habilitarse.',
          ),
      );
    }
    this.updateState((state) => this.applyEnable(state, providerId, validKey.id));
    return of(undefined).pipe(delay(mockLatency(200, 300)));
  }

  setActiveKey(providerId: ProviderId, keyId: string): Observable<void> {
    const key = this._state().keys.find((entry) => entry.id === keyId);
    if (!key || key.providerId !== providerId) {
      return throwError(
        () => new Error('La key indicada no existe o no pertenece al provider.'),
      );
    }
    this.updateState((state) => ({
      ...state,
      configs: state.configs.map((config) =>
        config.providerId === providerId
          ? { ...config, activeKeyId: keyId }
          : config,
      ),
    }));
    return of(undefined).pipe(delay(mockLatency(200, 300)));
  }

  /** Provider activo por categoría de generación (RFC-003 D5.4). Solo
   *  providers HABILITADOS pueden ser activos; `analytics-connector` jamás
   *  participa (cada red usa su propio conector — RFC-002 D3). */
  setActiveProvider(kind: ProviderKind, providerId: ProviderId): Observable<void> {
    if (kind === 'analytics-connector') {
      return throwError(
        () =>
          new Error(
            'analytics-connector no participa de activeByKind: cada red usa su propio conector.',
          ),
      );
    }
    if (DESCRIPTOR_BY_ID.get(providerId)?.kind !== kind) {
      return throwError(
        () => new Error('El provider indicado no pertenece a esa categoría.'),
      );
    }
    const config = this._state().configs.find(
      (entry) => entry.providerId === providerId,
    );
    if (!config?.enabled) {
      return throwError(
        () =>
          new Error(
            'Solo un provider habilitado puede ser el activo de su categoría.',
          ),
      );
    }
    this.updateState((state) => ({
      ...state,
      activeByKind: { ...state.activeByKind, [kind]: providerId },
    }));
    return of(undefined).pipe(delay(mockLatency(200, 300)));
  }

  /**
   * Alta de key (RFC-003 D5.2): enmascara al vuelo (estilo `maskPrefix` de
   * `ApiKeysMockService`) y el plaintext existe ÚNICAMENTE en el retorno —
   * ni en el signal ni en storage. El shape-check contra `keyPattern` del
   * catálogo se captura acá (ver `shapeOkByKeyId`). La key nace
   * `unverified`; si el provider no tenía key activa, esta pasa a serlo.
   */
  addKey(
    providerId: ProviderId,
    plaintext: string,
    label?: string,
  ): Observable<ApiKeyWithPlaintext> {
    const descriptor = DESCRIPTOR_BY_ID.get(providerId);
    const shapeOk =
      descriptor !== undefined &&
      new RegExp(descriptor.keyPattern).test(plaintext);

    const trimmedLabel = label?.trim();
    const entry: ApiKeyEntry = {
      id: `key-${providerId}-${this.epoch.toString(36)}-${this.keySequence++}`,
      providerId,
      maskedKey: maskKey(plaintext),
      status: 'unverified',
      createdAt: new Date(this.epoch).toISOString(),
      ...(trimmedLabel ? { label: trimmedLabel } : {}),
    };
    this.shapeOkByKeyId.set(entry.id, shapeOk);

    this.updateState((state) => ({
      ...state,
      keys: [...state.keys, entry],
      configs: state.configs.map((config) =>
        config.providerId === providerId && !config.activeKeyId
          ? { ...config, activeKeyId: entry.id }
          : config,
      ),
    }));
    return of({ entry, plaintext }).pipe(delay(mockLatency(200, 300)));
  }

  /**
   * Verificación simulada, determinista en dos fases (RFC-002 D5 /
   * RFC-003 D5.3): (1) shape-check contra `keyPattern` (verdicto capturado
   * al alta) → `invalid` si no matchea; (2) `seededRandom(keyId)()`:
   * <0.75 `valid`, <0.92 `invalid`, resto `expired`. Re-verificar la MISMA
   * key repite el resultado (como un backend real); una key NUEVA re-tira
   * el dado. La mutación se aplica al completar la latencia (la espera
   * "vende" que la verificación sale a la API externa).
   */
  verifyKey(keyId: string): Observable<ApiKeyEntry> {
    return timer(mockLatency(800, 700)).pipe(map(() => this.applyVerify(keyId)));
  }

  /**
   * Revocación con cascada COMPLETA (RFC-003 D5.5), en una sola
   * transición: (1) la key desaparece de la lista (sin tabla de auditoría);
   * (2) config que la usaba ⇒ `enabled: false` + limpia `activeKeyId`;
   * (3) `activeByKind` se limpia y, si otro provider de la categoría sigue
   * habilitado, se promueve automáticamente (primero en orden de catálogo);
   * (4) cuentas alimentadas por el conector ⇒ `status: 'error'` con
   * `failureReason` fijo — nada se borra: reconfigurar la key + reconectar
   * restaura.
   */
  revokeKey(keyId: string): Observable<void> {
    const key = this._state().keys.find((entry) => entry.id === keyId);
    if (!key) {
      return throwError(() => new Error(`La key ${keyId} no existe.`));
    }
    this.shapeOkByKeyId.delete(keyId);
    this.updateState((state) => this.applyRevocationCascade(state, key));
    return of(undefined).pipe(delay(mockLatency(200, 300)));
  }

  /**
   * "OAuth" simulado (RFC-003 D4.3): fabrica la cuenta determinista del
   * cliente vía `buildAccountMock` — identidad derivada del email, jamás
   * hardcodeada. Idempotente: reconectar reproduce la MISMA cuenta (id
   * estable, máx. 1 por red). La mutación se aplica al completar la
   * latencia larga (roundtrip de consentimiento, loading ≥1 s).
   */
  connectAccount(network: SocialNetwork): Observable<SocialAccount> {
    return timer(mockLatency(1200, 800)).pipe(
      map(() => this.applyConnect(network)),
    );
  }

  /** expired/error → connected: repite el connect refrescando
   *  `connectedAt` y limpiando `failureReason` (RFC-003 D4.3.4). */
  reconnectAccount(accountId: string): Observable<SocialAccount> {
    const existing = this._state().accounts.find(
      (account) => account.id === accountId,
    );
    if (!existing) {
      return throwError(() => new Error(`La cuenta ${accountId} no existe.`));
    }
    return timer(mockLatency(1200, 800)).pipe(
      map(() => this.applyConnect(existing.network)),
    );
  }

  /** Elimina la cuenta persistida — los mocks de analítica derivan de las
   *  cuentas conectadas: sin cuenta, sin datos (el gating reaparece solo). */
  disconnectAccount(accountId: string): Observable<void> {
    this.updateState((state) => ({
      ...state,
      accounts: state.accounts.filter((account) => account.id !== accountId),
    }));
    return of(undefined).pipe(delay(mockLatency(200, 300)));
  }

  // ── Extensiones de RFC-003 (fuera del puerto, sincrónicas) ───────────

  /** Persiste el nombre de marca del signup, scoped al cliente (D2/D6.1). */
  setBrandName(name: string): void {
    const trimmed = name.trim();
    this._brandName.set(trimmed);
    this.writeJson<PersistedProfile>(this.storageKey(PROFILE_KEY), {
      brandName: trimmed,
    });
  }

  /** Oculta el checklist de primeros pasos para siempre (D3/D6.1). */
  dismissChecklist(): void {
    this._checklistDismissed.set(true);
    this.writeJson<PersistedOnboarding>(this.storageKey(ONBOARDING_KEY), {
      checklistDismissed: true,
    });
  }

  // ── Transiciones internas ────────────────────────────────────────────

  /** Mutación canónica: actualiza el signal Y persiste EN EL MISMO método
   *  (setter explícito, no effect — RFC-003 D6.3). */
  private updateState(
    mutate: (state: TenantProviderState) => TenantProviderState,
  ): void {
    const next = mutate(this._state());
    this._state.set(next);
    this.persistTenantState(next);
  }

  private applyConnect(network: SocialNetwork): SocialAccount {
    const account = buildAccountMock(
      this.epoch,
      this.clientSeed(),
      this._brandName(),
      network,
    );
    this.updateState((state) => ({
      ...state,
      accounts: [
        ...state.accounts.filter((existing) => existing.network !== network),
        account,
      ],
    }));
    return account;
  }

  private applyVerify(keyId: string): ApiKeyEntry {
    const existing = this._state().keys.find((entry) => entry.id === keyId);
    if (!existing) {
      // El Observable de verifyKey convierte este throw en error emitido.
      throw new Error(`La key ${keyId} no existe.`);
    }
    const status = this.verifyOutcome(keyId);
    const verified: ApiKeyEntry = {
      ...existing,
      status,
      // Solo `valid` setea lastVerifiedAt (RFC-003 D5.3).
      ...(status === 'valid'
        ? { lastVerifiedAt: new Date(this.epoch).toISOString() }
        : {}),
    };
    this.updateState((state) => ({
      ...state,
      keys: state.keys.map((entry) => (entry.id === keyId ? verified : entry)),
    }));
    return verified;
  }

  private verifyOutcome(keyId: string): ApiKeyStatus {
    // Fase 1 — shape-check (verdicto capturado al alta; ver shapeOkByKeyId).
    if (this.shapeOkByKeyId.get(keyId) === false) {
      return 'invalid';
    }
    // Fase 2 — seeded, estable por keyId (RFC-002 D5).
    const roll = seededRandom(keyId)();
    if (roll < VERIFY_VALID_THRESHOLD) {
      return 'valid';
    }
    return roll < VERIFY_INVALID_THRESHOLD ? 'invalid' : 'expired';
  }

  private applyEnable(
    state: TenantProviderState,
    providerId: ProviderId,
    validKeyId: string,
  ): TenantProviderState {
    const configs = state.configs.map((config) =>
      config.providerId === providerId
        ? { ...config, enabled: true, activeKeyId: validKeyId }
        : config,
    );
    const kind = DESCRIPTOR_BY_ID.get(providerId)?.kind;
    // Auto-activo al habilitar el PRIMERO de una categoría de generación (D5.4).
    const activeByKind =
      kind && GENERATION_KINDS.includes(kind) && !state.activeByKind[kind]
        ? { ...state.activeByKind, [kind]: providerId }
        : state.activeByKind;
    return { ...state, configs, activeByKind };
  }

  private applyDisable(
    state: TenantProviderState,
    providerId: ProviderId,
  ): TenantProviderState {
    const configs = state.configs.map((config) =>
      config.providerId === providerId ? { ...config, enabled: false } : config,
    );
    const kind = DESCRIPTOR_BY_ID.get(providerId)?.kind;
    const activeByKind =
      kind && state.activeByKind[kind] === providerId
        ? this.reassignActiveProvider(configs, state.activeByKind, kind, providerId)
        : state.activeByKind;
    return { ...state, configs, activeByKind };
  }

  private applyRevocationCascade(
    state: TenantProviderState,
    key: ApiKeyEntry,
  ): TenantProviderState {
    // (1) La key desaparece de la lista — sin tabla de auditoría acá.
    const keys = state.keys.filter((entry) => entry.id !== key.id);

    // (2) Config que la usaba como activa → disabled + sin activeKeyId.
    const affectedProviderIds = state.configs
      .filter((config) => config.activeKeyId === key.id)
      .map((config) => config.providerId);
    const configs = state.configs.map((config) =>
      config.activeKeyId === key.id
        ? { ...config, enabled: false, activeKeyId: undefined }
        : config,
    );

    // (3) activeByKind: limpiar la entry y promover al siguiente habilitado.
    let activeByKind = state.activeByKind;
    for (const providerId of affectedProviderIds) {
      const kind = DESCRIPTOR_BY_ID.get(providerId)?.kind;
      if (kind && activeByKind[kind] === providerId) {
        activeByKind = this.reassignActiveProvider(
          configs,
          activeByKind,
          kind,
          providerId,
        );
      }
    }

    // (4) Cuentas alimentadas por un conector afectado → error accionable.
    const affected = new Set<ProviderId>(affectedProviderIds);
    const accounts = state.accounts.map((account) =>
      affected.has(account.connectorId)
        ? {
            ...account,
            status: 'error' as const,
            failureReason: REVOKED_CONNECTOR_REASON,
          }
        : account,
    );

    return { configs, keys, accounts, activeByKind };
  }

  /** Criterio D5.5.3: limpia la entry y promueve al PRIMER provider de la
   *  categoría (orden de catálogo) que siga habilitado, si existe. */
  private reassignActiveProvider(
    configs: readonly ConnectorConfig[],
    activeByKind: TenantProviderState['activeByKind'],
    kind: ProviderKind,
    excludedId: ProviderId,
  ): TenantProviderState['activeByKind'] {
    const next: Partial<Record<ProviderKind, ProviderId>> = { ...activeByKind };
    delete next[kind];
    const successor = PROVIDER_CATALOG.find(
      (descriptor) =>
        descriptor.kind === kind &&
        descriptor.id !== excludedId &&
        configs.some(
          (config) => config.providerId === descriptor.id && config.enabled,
        ),
    );
    if (successor) {
      next[kind] = successor.id;
    }
    return next;
  }

  // ── Derivaciones puras ───────────────────────────────────────────────

  private withEffectiveStatus(
    account: SocialAccount,
    candidate: { readonly network: SocialNetwork; readonly reason: string } | null,
  ): SocialAccount {
    // El error persistido por la cascada de revocación (D5.5) manda.
    if (account.status === 'error') {
      return account;
    }
    const ageMs = this.epoch - Date.parse(account.connectedAt);
    if (ageMs > TOKEN_TTL_MS) {
      return { ...account, status: 'expired', failureReason: undefined };
    }
    if (
      candidate !== null &&
      account.network === candidate.network &&
      ageMs >= SYNC_ERROR_MIN_AGE_MS
    ) {
      return {
        ...account,
        status: 'error',
        failureReason: candidate.reason,
        lastSyncAt: minutesBefore(this.epoch, SYNC_ERROR_LAST_SYNC_MINUTES),
      };
    }
    return account;
  }

  /** Estado "listo" de un kind: algún config habilitado cuya key activa
   *  existe y está `valid` (lectura no-memoizada — la memo vive en el
   *  computed que la envuelve). */
  private hasReadyProviderNow(kind: ProviderKind): boolean {
    const state = this._state();
    return state.configs.some(
      (config) =>
        config.enabled &&
        DESCRIPTOR_BY_ID.get(config.providerId)?.kind === kind &&
        this.isActiveKeyValid(state, config),
    );
  }

  private isActiveKeyValid(
    state: TenantProviderState,
    config: ConnectorConfig,
  ): boolean {
    if (!config.activeKeyId) {
      return false;
    }
    const key = state.keys.find((entry) => entry.id === config.activeKeyId);
    return key?.status === 'valid';
  }

  /** Key `valid` para habilitar un provider: la activa si califica; si no,
   *  la primera `valid` del provider (se auto-repara `activeKeyId`). */
  private findValidKey(
    state: TenantProviderState,
    providerId: ProviderId,
  ): ApiKeyEntry | undefined {
    const config = state.configs.find(
      (entry) => entry.providerId === providerId,
    );
    const active = state.keys.find(
      (entry) => entry.id === config?.activeKeyId && entry.status === 'valid',
    );
    if (active) {
      return active;
    }
    return state.keys.find(
      (entry) => entry.providerId === providerId && entry.status === 'valid',
    );
  }

  // ── Persistencia (único punto de contacto con localStorage) ──────────

  /** RFC-003 D6.1: base versionada + sufijo de cliente. Sin sesión no se
   *  lee/escribe nada. */
  private storageKey(
    base: string,
    clientId: string | null = this.clientId(),
  ): string | null {
    return clientId ? `${base}::${clientId}` : null;
  }

  private persistTenantState(state: TenantProviderState): void {
    this.writeJson<PersistedProviderConfig>(
      this.storageKey(PROVIDER_CONFIG_KEY),
      { configs: state.configs, activeByKind: state.activeByKind },
    );
    this.writeJson<readonly ApiKeyEntry[]>(
      this.storageKey(API_KEYS_KEY),
      state.keys,
    );
    this.writeJson<readonly SocialAccount[]>(
      this.storageKey(CONNECTIONS_KEY),
      state.accounts,
    );
  }

  private readTenantState(clientId: string | null): TenantProviderState {
    const config = this.readJson<PersistedProviderConfig | null>(
      this.storageKey(PROVIDER_CONFIG_KEY, clientId),
      null,
    );
    const keys = this.readJson<readonly ApiKeyEntry[]>(
      this.storageKey(API_KEYS_KEY, clientId),
      [],
    );
    const accounts = this.readJson<readonly SocialAccount[]>(
      this.storageKey(CONNECTIONS_KEY, clientId),
      [],
    );
    return {
      configs: this.normalizeConfigs(config?.configs ?? []),
      keys: Array.isArray(keys) ? keys : [],
      accounts: Array.isArray(accounts) ? accounts : [],
      activeByKind: config?.activeByKind ?? {},
    };
  }

  /** Overlay de lo persistido sobre los defaults del catálogo: garantiza
   *  un config por provider aunque el catálogo haya sumado entries, y
   *  descarta providerIds desconocidos (payload v1 corrupto/viejo). */
  private normalizeConfigs(
    stored: readonly ConnectorConfig[],
  ): readonly ConnectorConfig[] {
    const byId = new Map<ProviderId, ConnectorConfig>(
      Array.isArray(stored)
        ? stored.map((config) => [config.providerId, config])
        : [],
    );
    return EMPTY_TENANT_STATE.configs.map(
      (fallback) => byId.get(fallback.providerId) ?? fallback,
    );
  }

  private readBrandName(clientId: string | null): string {
    return (
      this.readJson<PersistedProfile | null>(
        this.storageKey(PROFILE_KEY, clientId),
        null,
      )?.brandName ?? ''
    );
  }

  private readChecklistDismissed(clientId: string | null): boolean {
    return (
      this.readJson<PersistedOnboarding | null>(
        this.storageKey(ONBOARDING_KEY, clientId),
        null,
      )?.checklistDismissed === true
    );
  }

  /** `try/catch` silencioso centralizado (patrón CustomersPreferencesService).
   *  El `as T` está justificado: validación estructural mínima en los
   *  callers (`Array.isArray`, `normalizeConfigs`, comparaciones estrictas)
   *  — criterio showcase, un payload v1 corrupto cae al default. */
  private readJson<T>(key: string | null, fallback: T): T {
    if (!this.isBrowser || key === null) {
      return fallback;
    }
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) {
        return fallback;
      }
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  private writeJson<T>(key: string | null, value: T): void {
    if (!this.isBrowser || key === null) {
      return;
    }
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore — quota/modo privado: el estado en memoria sigue siendo la verdad
    }
  }
}
