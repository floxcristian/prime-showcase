// Angular
import { effect, inject, Injectable, signal, untracked, type Signal } from '@angular/core';
import { defer, delay, map, Observable, of, take, throwError, timer } from 'rxjs';

// Core / shared
import { demoAsset } from '../../../shared/constants/demo-assets';
import { mockLatency } from '../../../shared/utils/mock-latency';
import { now, seededRandom } from '../../../shared/utils/mock-utils';

// Local
import { buildGenerationJobsMock } from '../mocks/generation-jobs-mock';
import { PROVIDER_CATALOG } from '../mocks/provider-catalog';
import { clientHash } from '../mocks/social-mock-utils';
import type {
  ProviderDescriptor,
  ProviderId,
  ProviderKind,
} from '../models/provider.interface';
import type {
  GenerationJob,
  GenerationKind,
  GenerationRequest,
} from '../models/social.interface';
import type { GenerationPort } from '../models/social.ports';
import { SocialSettingsService } from './social-settings.service';

/**
 * Error tipado de `createJob` (RFC-002 D9): el provider pedido no está
 * habilitado con una key `valid` en la configuración del cliente. La UI
 * del Studio deshabilita la opción antes; este error es la última línea
 * (el puerto real devolvería 403) y la UI lo convierte en CTA a
 * `/social/providers`.
 */
export class GenerationProviderNotReadyError extends Error {
  constructor(readonly providerId: ProviderId, providerName: string) {
    super(
      `El proveedor ${providerName} necesita estar habilitado con una API key válida — configuralo en Proveedores.`,
    );
    this.name = 'GenerationProviderNotReadyError';
  }
}

/** Período entre ticks de progreso de `watchJob` (RFC-002 D9). */
const PROGRESS_TICK_MS = 450;

/** Umbral del outcome terminal (D9): roll < 0.12 → failed. */
const JOB_FAILURE_PROBABILITY = 0.12;

/** Pool de fallos de D9 — accionables, sin culpar al usuario. */
const JOB_FAILURE_REASONS: readonly string[] = [
  'Cuota del provider excedida — reintentá en unos minutos.',
  'El prompt infringe la política de contenido del provider.',
];

/** Kind de request → categoría de provider que la sirve (RFC-002 D3). */
const PROVIDER_KIND_BY_GENERATION: Readonly<Record<GenerationKind, ProviderKind>> = {
  caption: 'text-gen',
  image: 'image-gen',
  video: 'video-gen',
};

/**
 * Tabla fija de costo por providerId × kind (D9) — el jitter seeded ±15 %
 * le da realismo ("esto cuesta plata", el pitch de keys por cliente) sin
 * romper baselines. Fallback defensivo para pares no tabulados.
 */
const COST_USD_BY_PROVIDER_KIND: Readonly<Record<string, number>> = {
  'gpt:caption': 0.02,
  'gemini:caption': 0.015,
  'openai-images:image': 0.08,
  'gemini-imagen:image': 0.07,
  'veo:video': 0.5,
  'heygen:video': 0.65,
  'higgsfield:video': 0.4,
};

const COST_USD_FALLBACK = 0.05;

/** Jitter del costo: ±15 % seeded por job. */
const COST_JITTER_PCT = 0.15;

/**
 * Variantes de caption es-CL para jobs EN VIVO que terminan `succeeded`
 * (el backfill histórico trae las suyas curadas en `generation-jobs-mock`).
 * Se eligen 3 consecutivas desde un offset seeded por job — contrato D2:
 * caption succeeded lleva SIEMPRE exactamente 3 variantes.
 */
const LIVE_CAPTION_VARIANTS: readonly string[] = [
  'Nuevo ingreso en tienda 🛠️ Stock listo para despacho a todo Chile — pedilo online y lo recibís en 48 horas.',
  '¿Lo estabas esperando? Ya está disponible online y en tienda. Aprovechá el retiro sin costo el mismo día.',
  'Calidad para tu próximo proyecto, a un clic 💙 Envíos a regiones y boleta al instante.',
  'Solo por esta semana: precios especiales en productos seleccionados ⚡ No te quedes sin el tuyo.',
  'Del taller a tu casa: así preparamos cada pedido con el cariño de una pyme chilena 📦',
  'Gracias por preferirnos — cada compra hace crecer este emprendimiento. ¡Vamos por más!',
];

/** Assets demo disponibles como resultado (covers del CDN de PrimeTek —
 *  mismo pool que el backfill de `generation-jobs-mock`). */
const MEDIA_FILE_COUNT = 12;

const resultAsset = (n: number): string =>
  demoAsset(`movie-cover${(n % MEDIA_FILE_COUNT) + 1}.png`);

/** Cantidad de assets por kind succeeded (D9): image 4, video 1 thumbnail. */
const RESULT_URL_COUNT: Readonly<Partial<Record<GenerationKind, number>>> = {
  image: 4,
  video: 1,
};

/** Lookup O(1) del catálogo (los IDs son un union cerrado). */
const DESCRIPTOR_BY_ID: ReadonlyMap<ProviderId, ProviderDescriptor> = new Map(
  PROVIDER_CATALOG.map((descriptor) => [descriptor.id, descriptor]),
);

/** Estados terminales — `watchJob` de un job ya terminado re-emite tal cual. */
const isTerminal = (status: GenerationJob['status']): boolean =>
  status === 'succeeded' || status === 'failed';

/**
 * Fachada mutable de generación de contenido IA — implementa
 * `GenerationPort` (RFC-002 D4). Patrón `ApiKeysMockService`:
 * `signal<readonly GenerationJob[]>` + streams de progreso por suscripción
 * (D9). Al migrar a backend real se implementa el mismo puerto con
 * HTTP/SSE y ningún componente cambia.
 *
 * **Ancla temporal por instancia (`epoch`):** patrón
 * `ObservabilityMockService` — en SSR cada request captura un epoch
 * fresco; en browser la sesión mantiene timestamps e ids de job estables.
 * Cero `Date.now()` suelto fuera del `now()` de captura.
 *
 * **Backfill lazy (RFC-002 D6/D7):** el historial (`${clientSeed}:jobs`,
 * 4-6 jobs) se siembra SOLO cuando el cliente tiene una key `valid` de un
 * provider de generación; si la configura a mitad de sesión, aparece en
 * la próxima lectura (`ensureBackfill`).
 *
 * **Aislamiento por cliente (D6, último bullet):** el único `effect()`
 * observa `SocialSettingsService.clientSeed()` y ante un cambio resetea el
 * signal al estado derivado del NUEVO cliente. Límite documentado: los
 * jobs NO persistidos (los creados en vivo) se descartan al logout — solo
 * `TenantProviderState` persiste (RFC-002 alternativa 6).
 *
 * **SSR (D9):** `watchJob` usa `timer` de rxjs (no `setInterval` crudo) y
 * los jobs solo se crean por interacción del usuario → el stream nunca
 * corre en server; no requiere guard adicional.
 */
@Injectable({ providedIn: 'root' })
export class SocialGenerationMockService implements GenerationPort {
  private readonly settings = inject(SocialSettingsService);

  /** Ver JSDoc de la clase — ancla de timestamps e ids de job. */
  private readonly epoch = now();

  /** Correlativo de jobs creados en vivo — junto al epoch garantiza ids
   *  únicos y deterministas dentro de la sesión (el id seedea `watchJob`). */
  private jobSequence = 0;

  /** ¿El backfill del cliente actual ya se sembró? (ver `ensureBackfill`). */
  private backfillDone = false;

  private readonly _jobs = signal<readonly GenerationJob[]>(
    this.initialBackfill(),
  );

  /** Snapshot reactivo para consumers con `computed()` (historial del
   *  Studio). Para cargar la lista con latencia usar `getJobs()`. */
  readonly jobs: Signal<readonly GenerationJob[]> = this._jobs.asReadonly();

  /**
   * ÚNICO `effect()` del service (RFC-002 D6): observa el `clientSeed` y
   * ante un cambio re-siembra el historial del NUEVO cliente (solo si su
   * `TenantProviderState` — ya rehidratado por el effect de settings,
   * creado antes por orden de inyección — tiene una key `valid` de un
   * provider de generación). Todo lo demás se lee `untracked`: el effect
   * NO debe re-ejecutarse por mutaciones normales de settings.
   */
  private lastSeed = this.settings.clientSeed();
  private readonly clientScopeEffect = effect(() => {
    const seed = this.settings.clientSeed();
    if (seed === this.lastSeed) {
      return;
    }
    this.lastSeed = seed;
    untracked(() => {
      this.backfillDone = false;
      this._jobs.set([]);
      this.ensureBackfill();
    });
  });

  // ── GenerationPort (RFC-002 D4 — firmas exactas) ─────────────────────

  /**
   * Crea el job en `queued` tras validar contra settings (D9): el provider
   * debe estar habilitado con key activa `valid` — si no, el Observable
   * emite `GenerationProviderNotReadyError`. `durationSeconds` se clampa a
   * `capabilities.maxVideoSeconds` ACÁ (la factory del job), no en la UI.
   * La mutación se aplica al completar la latencia.
   */
  createJob(request: GenerationRequest): Observable<GenerationJob> {
    return timer(mockLatency(200, 300)).pipe(
      map(() => this.applyCreate(request)),
    );
  }

  getJobs(): Observable<readonly GenerationJob[]> {
    this.ensureBackfill();
    return of(this._jobs()).pipe(delay(mockLatency()));
  }

  /**
   * Stream de progreso determinista por id (RFC-002 D9): `timer(0, 450)`
   * avanza el job en T ticks donde `T = 6 + floor(seededRandom(jobId)() *
   * 5)` (6-10 ticks ≈ 2.7-4.5 s). Curva NO lineal (rápido al inicio, lento
   * al final): `progressPct = round(100 * (1 - (1 - i/T)^2))`. El tick 0
   * emite `running` con 0 %; el tick T emite el estado terminal:
   * `seededRandom(`${jobId}:outcome`)() < 0.12` → `failed` con reason del
   * pool; si no → `succeeded` con `resultVariants` (caption, siempre 3) o
   * `resultUrls` (image: 4 assets; video: 1 thumbnail — la duración viaja
   * en `request.options.durationSeconds`, ya clampeada). Cada emisión
   * ACTUALIZA también el signal de jobs (el historial refleja el progreso
   * sin re-suscripción). El stream completa tras el terminal —
   * `takeUntilDestroyed` en el consumer. Un job ya terminal se re-emite
   * tal cual, una vez.
   */
  watchJob(id: string): Observable<GenerationJob> {
    return defer(() => {
      const existing = this._jobs().find((job) => job.id === id);
      if (!existing) {
        return throwError(() => new Error(`El job ${id} no existe.`));
      }
      if (isTerminal(existing.status)) {
        return of(existing);
      }
      const totalTicks = 6 + Math.floor(seededRandom(id)() * 5);
      return timer(0, PROGRESS_TICK_MS).pipe(
        take(totalTicks + 1),
        map((tick) => this.applyProgress(id, tick, totalTicks)),
      );
    });
  }

  // ── Transiciones internas ────────────────────────────────────────────

  private applyCreate(request: GenerationRequest): GenerationJob {
    const descriptor = DESCRIPTOR_BY_ID.get(request.providerId);
    if (
      !descriptor ||
      descriptor.kind !== PROVIDER_KIND_BY_GENERATION[request.kind]
    ) {
      // Los throws de acá salen como error del Observable de createJob.
      throw new Error(
        `El proveedor ${request.providerId} no genera contenido de tipo ${request.kind}.`,
      );
    }
    if (!this.isProviderReady(request.providerId)) {
      throw new GenerationProviderNotReadyError(
        request.providerId,
        descriptor.name,
      );
    }

    this.ensureBackfill();

    const normalized = this.clampRequest(request, descriptor);
    const id = `job-${clientHash(this.settings.clientSeed())}-live-${this.epoch.toString(36)}-${this.jobSequence++}`;
    const job: GenerationJob = {
      id,
      kind: normalized.kind,
      providerId: normalized.providerId,
      prompt: normalized.prompt,
      request: normalized,
      status: 'queued',
      createdAt: new Date(this.epoch).toISOString(),
      costEstimateUsd: this.costEstimate(id, normalized),
    };
    this._jobs.update((jobs) => [job, ...jobs]);
    return job;
  }

  private applyProgress(
    id: string,
    tick: number,
    totalTicks: number,
  ): GenerationJob {
    const job = this._jobs().find((existing) => existing.id === id);
    if (!job) {
      throw new Error(`El job ${id} no existe.`);
    }
    const next =
      tick < totalTicks
        ? {
            ...job,
            status: 'running' as const,
            progressPct: Math.round(100 * (1 - (1 - tick / totalTicks) ** 2)),
          }
        : this.terminalJob(job);
    this._jobs.update((jobs) =>
      jobs.map((existing) => (existing.id === id ? next : existing)),
    );
    return next;
  }

  /** Estado terminal determinista por id (D9). */
  private terminalJob(job: GenerationJob): GenerationJob {
    const outcomeRand = seededRandom(`${job.id}:outcome`);
    const base: GenerationJob = {
      ...job,
      progressPct: undefined,
      completedAt: new Date(this.epoch).toISOString(),
      status: 'failed',
    };
    if (outcomeRand() < JOB_FAILURE_PROBABILITY) {
      return {
        ...base,
        failureReason:
          JOB_FAILURE_REASONS[
            Math.floor(outcomeRand() * JOB_FAILURE_REASONS.length)
          ],
      };
    }
    const resultRand = seededRandom(`${job.id}:result`);
    if (job.kind === 'caption') {
      // Contrato D2: caption succeeded lleva SIEMPRE 3 variantes.
      const offset = Math.floor(resultRand() * LIVE_CAPTION_VARIANTS.length);
      return {
        ...base,
        status: 'succeeded',
        resultVariants: Array.from(
          { length: 3 },
          (_, k) =>
            LIVE_CAPTION_VARIANTS[(offset + k) % LIVE_CAPTION_VARIANTS.length],
        ),
      };
    }
    const mediaStart = Math.floor(resultRand() * MEDIA_FILE_COUNT);
    const resultCount = RESULT_URL_COUNT[job.kind] ?? 1;
    return {
      ...base,
      status: 'succeeded',
      resultUrls: Array.from({ length: resultCount }, (_, k) =>
        resultAsset(mediaStart + k),
      ),
    };
  }

  // ── Derivaciones puras ───────────────────────────────────────────────

  /** Provider habilitado + key activa `valid` en settings (D9). */
  private isProviderReady(providerId: ProviderId): boolean {
    const state = this.settings.state();
    const config = state.configs.find(
      (entry) => entry.providerId === providerId,
    );
    if (!config?.enabled || !config.activeKeyId) {
      return false;
    }
    const key = state.keys.find((entry) => entry.id === config.activeKeyId);
    return key?.status === 'valid';
  }

  /** Clamp de `durationSeconds` a `capabilities.maxVideoSeconds` (D9). */
  private clampRequest(
    request: GenerationRequest,
    descriptor: ProviderDescriptor,
  ): GenerationRequest {
    const max = descriptor.capabilities.maxVideoSeconds;
    const duration = request.options.durationSeconds;
    if (request.kind !== 'video' || max === undefined || duration === undefined) {
      return request;
    }
    return {
      ...request,
      options: { ...request.options, durationSeconds: Math.min(duration, max) },
    };
  }

  /** Tabla fija por providerId × kind ± jitter seeded (D9). */
  private costEstimate(jobId: string, request: GenerationRequest): number {
    const base =
      COST_USD_BY_PROVIDER_KIND[`${request.providerId}:${request.kind}`] ??
      COST_USD_FALLBACK;
    const jitter = 1 + (seededRandom(`${jobId}:cost`)() * 2 - 1) * COST_JITTER_PCT;
    return Math.round(base * jitter * 1000) / 1000;
  }

  // ── Backfill (RFC-002 D6/D7) ─────────────────────────────────────────

  /** ¿El cliente tiene alguna key `valid` de un provider de generación?
   *  (condición de siembra del historial — D6). */
  private hasValidGenerationKey(): boolean {
    return this.settings
      .state()
      .keys.some(
        (key) =>
          key.status === 'valid' &&
          DESCRIPTOR_BY_ID.get(key.providerId)?.kind !== 'analytics-connector',
      );
  }

  /** Backfill al construir — si el cliente ya califica (key rehidratada). */
  private initialBackfill(): readonly GenerationJob[] {
    if (!this.hasValidGenerationKey()) {
      return [];
    }
    this.backfillDone = true;
    return buildGenerationJobsMock(this.epoch, this.settings.clientSeed());
  }

  /**
   * Siembra el historial si todavía no existe y el cliente YA configuró su
   * primera key `valid` de generación (D6/D7). Solo desde métodos
   * imperativos — jamás desde getters/computed (escribe un signal).
   */
  private ensureBackfill(): void {
    if (this.backfillDone || !this.hasValidGenerationKey()) {
      return;
    }
    this.backfillDone = true;
    const backfill = buildGenerationJobsMock(
      this.epoch,
      this.settings.clientSeed(),
    );
    // Los jobs vivos (más nuevos) quedan antes del historial sembrado.
    this._jobs.update((jobs) => [...jobs, ...backfill]);
  }
}
