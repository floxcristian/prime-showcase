// Angular
import { effect, inject, Injectable, signal, untracked, type Signal } from '@angular/core';
import { delay, map, Observable, of, throwError, timer } from 'rxjs';

// Core / shared
import { mockLatency } from '../../../shared/utils/mock-latency';
import { now, seededRandom } from '../../../shared/utils/mock-utils';

// Local
import { buildScheduledPostsMock } from '../mocks/scheduled-posts-mock';
import type { ScheduledPost, SocialNetwork } from '../models/social.interface';
import type { PublishingPort } from '../models/social.ports';
import { SocialSettingsService } from './social-settings.service';

/** Umbral del fallo ocasional de publicación (RFC-002 D10): roll < 0.15. */
const PUBLISH_FAILURE_PROBABILITY = 0.15;

/** Nombre visible de cada red para el `failureReason` de D10. Vive acá (y
 *  no importado de tokens de UI compartidos) para que el service no
 *  dependa de componentes — capa de datos pura. */
const NETWORK_LABELS: Readonly<Record<SocialNetwork, string>> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
};

/** Fallos SIN causa real (D10) — transitorios y accionables; el fallo con
 *  causa real (cuenta expired/error) usa el reason fijo de abajo. */
const TRANSIENT_FAILURE_REASONS: readonly string[] = [
  'El conector devolvió un error temporal al publicar — reintentá en unos minutos.',
  'La red no respondió a tiempo al publicar — reintentá en unos minutos.',
];

/** Estados desde los que `publishNow` puede transicionar (D10: scheduled/
 *  draft → published; `failed` habilita el flujo de retry). */
const PUBLISHABLE_STATUSES: readonly ScheduledPost['status'][] = [
  'draft',
  'scheduled',
  'failed',
];

/**
 * Fachada mutable del calendario de publicaciones — implementa
 * `PublishingPort` (RFC-002 D4). Patrón `ApiKeysMockService`: un
 * `signal<readonly ScheduledPost[]>` con mutaciones de efecto inmediato y
 * fachadas `Observable` con `delay(mockLatency(400, 400))` (D5/D11,
 * paridad con api-keys). Al migrar a backend real se implementa el mismo
 * puerto con HTTP y ningún componente cambia.
 *
 * **Ancla temporal por instancia (`epoch`):** patrón
 * `ObservabilityMockService` — en SSR cada request captura un epoch
 * fresco; en browser la sesión mantiene timestamps estables. Es el "ahora"
 * de `publishedAt`/`updatedAt` — cero `Date.now()` suelto.
 *
 * **Backfill lazy (RFC-002 D6):** el signal se siembra con
 * `buildScheduledPostsMock` (seed `${clientSeed}:sched`) SOLO si el
 * cliente tiene cuentas conectadas; sin cuentas, `[]` y las páginas
 * muestran su empty state. Si el cliente conecta su primera cuenta a
 * mitad de sesión, el backfill aparece en la próxima lectura
 * (`ensureBackfill`).
 *
 * **Aislamiento por cliente (D6, último bullet):** el único `effect()`
 * observa `SocialSettingsService.clientSeed()` y ante un cambio resetea el
 * signal al estado derivado del NUEVO cliente. Límite documentado: lo NO
 * persistido (drafts creados en la sesión, retries) se descarta al logout
 * — solo `TenantProviderState` persiste (RFC-002 alternativa 6).
 *
 * **Límite consciente del mock (D10):** los posts `scheduled` cuyo
 * `scheduledFor` quedó en el pasado NO se auto-publican (no hay backend ni
 * cron): el calendario los muestra como "pendiente de publicar" y
 * `publishNow` es la acción explícita.
 */
@Injectable({ providedIn: 'root' })
export class SocialPublishingMockService implements PublishingPort {
  private readonly settings = inject(SocialSettingsService);

  /** Ver JSDoc de la clase — ancla de TODOS los timestamps de mutación. */
  private readonly epoch = now();

  /** Latencia liviana de publishing (D5/D11 — paridad con api-keys). */
  private readonly latency = (): number => mockLatency(400, 400);

  /**
   * Intentos de `publishNow` por post en esta sesión (D10): el primer
   * intento sin causa real usa el seed base `${clientSeed}:publish:${id}`;
   * los retries re-seedean con `:retry:${n}` → el segundo intento casi
   * siempre pasa. Se resetea junto con el signal al cambiar de cliente.
   */
  private readonly publishAttempts = new Map<string, number>();

  /** ¿El backfill del cliente actual ya se sembró? (ver `ensureBackfill`). */
  private backfillDone = false;

  private readonly _posts = signal<readonly ScheduledPost[]>(
    this.initialBackfill(),
  );

  /** Snapshot reactivo para consumers con `computed()` (planner/calendario).
   *  Para cargar la lista con latencia usar `getScheduledPosts()`. */
  readonly posts: Signal<readonly ScheduledPost[]> = this._posts.asReadonly();

  /**
   * ÚNICO `effect()` del service (RFC-002 D6): observa el `clientSeed` y
   * ante un cambio re-siembra el backfill del NUEVO cliente (solo si tiene
   * cuentas conectadas — su `TenantProviderState` ya fue rehidratado por el
   * effect de `SocialSettingsService`, creado antes por orden de
   * inyección). Todo lo demás se lee `untracked`: el effect NO debe
   * re-ejecutarse por mutaciones normales de settings.
   */
  private lastSeed = this.settings.clientSeed();
  private readonly clientScopeEffect = effect(() => {
    const seed = this.settings.clientSeed();
    if (seed === this.lastSeed) {
      return;
    }
    this.lastSeed = seed;
    untracked(() => {
      this.publishAttempts.clear();
      this.backfillDone = false;
      this._posts.set([]);
      this.ensureBackfill();
    });
  });

  // ── PublishingPort (RFC-002 D4 — firmas exactas) ─────────────────────

  getScheduledPosts(): Observable<readonly ScheduledPost[]> {
    this.ensureBackfill();
    return of(this._posts()).pipe(delay(this.latency()));
  }

  /**
   * Upsert de draft/scheduled (D4). Valida que TODOS los `accountIds`
   * correspondan a cuentas conectadas del cliente (D5 — la UI lo impide
   * antes; el service es la última línea, como el 403 del backend real).
   * Refresca `updatedAt` al epoch de la instancia.
   */
  savePost(post: ScheduledPost): Observable<ScheduledPost> {
    this.ensureBackfill();
    if (post.status !== 'draft' && post.status !== 'scheduled') {
      return throwError(
        () => new Error('savePost solo acepta posts draft o scheduled.'),
      );
    }
    if (post.accountIds.length === 0) {
      return throwError(
        () => new Error('El post necesita al menos una cuenta destino.'),
      );
    }
    const connected = new Set(
      this.settings.accounts().map((account) => account.id),
    );
    const unknown = post.accountIds.find((id) => !connected.has(id));
    if (unknown !== undefined) {
      return throwError(
        () =>
          new Error(
            `La cuenta ${unknown} no está conectada — conectala en Configuración antes de programar.`,
          ),
      );
    }
    const saved: ScheduledPost = {
      ...post,
      updatedAt: new Date(this.epoch).toISOString(),
    };
    this._posts.update((posts) =>
      posts.some((existing) => existing.id === saved.id)
        ? posts.map((existing) => (existing.id === saved.id ? saved : existing))
        : [...posts, saved],
    );
    return of(saved).pipe(delay(this.latency()));
  }

  deletePost(id: string): Observable<void> {
    if (!this._posts().some((post) => post.id === id)) {
      return throwError(() => new Error(`El post ${id} no existe.`));
    }
    this._posts.update((posts) => posts.filter((post) => post.id !== id));
    return of(undefined).pipe(delay(this.latency()));
  }

  /**
   * Transición draft/scheduled/failed → published, con fallo determinista
   * ocasional (RFC-002 D10): tras la latencia, si alguna cuenta destino
   * está `expired`/`error` el fallo es SEGURO (probabilidad 1) con reason
   * 'Token de {red} expirado — reconectá la cuenta en Configuración' —
   * reintentar falla igual hasta que el usuario reconecta la cuenta, y ahí
   * el retry pasa (flujo demo completo error → fix → ok). Sin causa real,
   * `seededRandom(`${clientSeed}:publish:${id}`)() < 0.15` decide; los
   * retries re-seedean con `:retry:${n}`. La mutación se aplica al
   * completar la latencia (como `verifyKey` de settings).
   */
  publishNow(id: string): Observable<ScheduledPost> {
    return timer(this.latency()).pipe(map(() => this.applyPublish(id)));
  }

  // ── Transiciones internas ────────────────────────────────────────────

  private applyPublish(id: string): ScheduledPost {
    const post = this._posts().find((existing) => existing.id === id);
    if (!post) {
      // El Observable de publishNow convierte este throw en error emitido.
      throw new Error(`El post ${id} no existe.`);
    }
    if (!PUBLISHABLE_STATUSES.includes(post.status)) {
      throw new Error(`El post ${id} ya fue publicado.`);
    }
    const attempt = (this.publishAttempts.get(id) ?? 0) + 1;
    this.publishAttempts.set(id, attempt);

    const failureReason = this.publishFailure(post, attempt);
    const nowIso = new Date(this.epoch).toISOString();
    const published: ScheduledPost =
      failureReason === null
        ? {
            ...post,
            status: 'published',
            publishedAt: nowIso,
            failureReason: undefined,
            updatedAt: nowIso,
          }
        : { ...post, status: 'failed', failureReason, updatedAt: nowIso };

    this._posts.update((posts) =>
      posts.map((existing) => (existing.id === id ? published : existing)),
    );
    return published;
  }

  /** `null` = publica OK; string = `failureReason` accionable (D10). */
  private publishFailure(post: ScheduledPost, attempt: number): string | null {
    const accounts = this.settings.accounts();
    const targets = post.accountIds.map((accountId) =>
      accounts.find((account) => account.id === accountId),
    );

    // Causa real 1: cuenta destino expired/error → fallo SEGURO,
    // correlacionado con el estado que la página de connections muestra.
    const broken = targets.find(
      (account) =>
        account !== undefined &&
        (account.status === 'expired' || account.status === 'error'),
    );
    if (broken) {
      return `Token de ${NETWORK_LABELS[broken.network]} expirado — reconectá la cuenta en Configuración`;
    }

    // Causa real 2: la cuenta destino ya no existe (desconectada después
    // de programar) — también fallo seguro y accionable.
    if (targets.some((account) => account === undefined)) {
      return 'La cuenta destino ya no está conectada — conectala de nuevo en Configuración.';
    }

    // Sin causa real: fallo ocasional determinista; retries re-seedean.
    const seed = this.settings.clientSeed();
    const base = `${seed}:publish:${post.id}`;
    const rand = seededRandom(attempt === 1 ? base : `${base}:retry:${attempt}`);
    if (rand() < PUBLISH_FAILURE_PROBABILITY) {
      return TRANSIENT_FAILURE_REASONS[
        Math.floor(rand() * TRANSIENT_FAILURE_REASONS.length)
      ];
    }
    return null;
  }

  // ── Backfill (RFC-002 D6/D7) ─────────────────────────────────────────

  /** Backfill al construir — si el cliente ya tiene cuentas rehidratadas. */
  private initialBackfill(): readonly ScheduledPost[] {
    const posts = buildScheduledPostsMock(
      this.epoch,
      this.settings.clientSeed(),
      this.settings.accounts(),
    );
    this.backfillDone = posts.length > 0;
    return posts;
  }

  /**
   * Siembra el backfill si todavía no existe y el cliente YA tiene cuentas
   * (D6: conectar la primera cuenta a mitad de sesión hace aparecer el
   * historial en la próxima lectura). Se llama solo desde métodos
   * imperativos — jamás desde getters/computed (escribe un signal).
   */
  private ensureBackfill(): void {
    if (this.backfillDone) {
      return;
    }
    const backfill = buildScheduledPostsMock(
      this.epoch,
      this.settings.clientSeed(),
      this.settings.accounts(),
    );
    if (backfill.length === 0) {
      return;
    }
    this.backfillDone = true;
    // Los drafts creados en vivo (sin backfill previo) quedan al final —
    // el planner ordena por fecha, el orden interno del signal no es UI.
    this._posts.update((posts) => [...backfill, ...posts]);
  }
}
