import { isPlatformBrowser } from '@angular/common';
import { DestroyRef, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import type { CustomersViewSnapshot } from './customers-url-state.service';

/**
 * View persistible — snapshot completo del state + metadata.
 *
 * Patrón bigtech (HubSpot saved views, Salesforce list views, Notion
 * database views, Linear views): un user configura filtros+columnas+
 * sort una vez, nombra, reutiliza. Equivale a un "preset" de la lista.
 */
export interface SavedView {
  id: string;
  name: string;
  snapshot: CustomersViewSnapshot;
  /** ISO timestamp. */
  createdAt: string;
  updatedAt: string;
  /** Default views shippeadas con el app (no editables, no deletables).
   * False para views que el user creó. Patrón HubSpot system vs
   * custom views. */
  system?: boolean;
}

const STORAGE_KEY = 'customers:saved-views:v1';
const NETWORK_LATENCY_MS = 180;

/**
 * Service de CRUD para saved views.
 *
 * **Persistencia**: localStorage (mock backend). En producción sería
 * `/api/users/me/views` con sync optimista — el shape del state lo
 * permite (cada method retorna `Promise<View[]>` simulando network).
 *
 * **Optimistic UI**: las mutaciones (create/update/delete) muestran
 * el cambio INMEDIATAMENTE en el signal, luego "persisten" tras la
 * latencia simulada. Si la persistencia falla (en producción: 4xx/5xx
 * del backend; en mock: localStorage quota exceeded), se hace rollback
 * al state previo + toast de error. Patrón Linear sync engine.
 *
 * **Cross-tab sync**: un `StorageEvent` listener detecta mutaciones
 * desde otras tabs y re-hidrata el signal. Sin esto un user con la app
 * abierta en 2 tabs vería divergencia hasta refresh. Patrón Linear /
 * Notion / HubSpot — las views son user-data global, no per-tab.
 *
 * **Runtime shape validation**: localStorage puede contener garbage
 * (versión vieja del schema, manipulación manual, corruption). Sin
 * validación, un `{ id: 1 }` (número en vez de string) llegaba al
 * signal y fluía hasta el URL state → table queries con id NaN. La
 * validación filtra entries inválidas antes de cargarlas.
 *
 * **System views** (shipping defaults):
 *   - "Todos los clientes" (sin filtros, todas las columnas default)
 *   - "Cartera activa" (filtro cartera=CA)
 *   - "Morosos" (filtro cartera=CM)
 *   - "Peligro de fuga" (filtro lifecycle=PELIGRO FUGA)
 *
 * Vienen como `system: true` (no editables/deletables), congelados a
 * nivel de objeto (`Object.freeze` profundo) para que un consumer no
 * pueda mutarlos accidentalmente y corromper la fuente canónica.
 * Patrón Salesforce: System Views (admin-managed) vs Personal Views
 * (user-owned).
 */
@Injectable({ providedIn: 'root' })
export class CustomersSavedViewsService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  /** Reactive list of all views (system + custom), sorted: system
   * first, then custom by updatedAt desc. */
  readonly views = signal<readonly SavedView[]>([]);

  /** Loading state para CRUD operations. */
  readonly busy = signal(false);

  /** Toast hook — el componente registra un callback para mostrar
   * errores de rollback al user. Inversion of control: el service no
   * acopla a MessageService de PrimeNG. */
  private rollbackHandler: ((message: string) => void) | null = null;

  constructor() {
    if (!this.isBrowser) {
      // SSR — solo system views, sin storage access.
      this.views.set(SYSTEM_VIEWS);
      return;
    }
    this.hydrate();
    this.attachStorageListener();
  }

  /**
   * Registra un callback para errores de rollback. El componente
   * provee la integración con su toast/notification system. Si no
   * está registrado, los rollbacks suceden silenciosos (state se
   * restaura pero el user no ve por qué).
   */
  setRollbackHandler(handler: (message: string) => void): void {
    this.rollbackHandler = handler;
  }

  /**
   * Crea una nueva view (optimistic). Inserta INMEDIATAMENTE en el
   * signal, persiste a localStorage en background. Si la persistencia
   * falla (quota exceeded), rollback al state previo + error toast.
   *
   * Edge cases cubiertos:
   *   - Name vacío/whitespace-only: se normaliza a "Sin nombre".
   *   - generateId colisión: extremadamente improbable con crypto.UUID,
   *     pero el `views.filter(v => v.id !== id)` del rollback es safe.
   *   - Storage quota exceeded: detectado por catch en `persist()`,
   *     dispara rollback y handler de error.
   */
  async create(name: string, snapshot: CustomersViewSnapshot): Promise<SavedView> {
    this.busy.set(true);
    const previousViews = this.views();
    const now = new Date().toISOString();
    const view: SavedView = {
      id: this.generateId(),
      name: name.trim() || 'Sin nombre',
      snapshot,
      createdAt: now,
      updatedAt: now,
    };
    // Optimistic — mutate first, then persist.
    this.views.update((views) => this.sortViews([...views, view]));
    try {
      await this.simulateLatency();
      this.persist();
      return view;
    } catch (err) {
      this.rollback(previousViews, 'No se pudo guardar la vista. Reintenta.');
      throw err;
    } finally {
      this.busy.set(false);
    }
  }

  /**
   * Update view existente con nuevo snapshot (típicamente cuando el
   * user clickea "Save changes" sobre una vista cargada). Mantiene
   * id, createdAt, system flag; bump updatedAt. Optimistic + rollback.
   */
  async update(
    id: string,
    patch: Partial<Pick<SavedView, 'name' | 'snapshot'>>,
  ): Promise<SavedView | null> {
    this.busy.set(true);
    const previousViews = this.views();
    const current = previousViews.find((v) => v.id === id);
    if (!current || current.system) {
      this.busy.set(false);
      return null;
    }
    const updated: SavedView = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    this.views.update((views) =>
      this.sortViews(views.map((v) => (v.id === id ? updated : v))),
    );
    try {
      await this.simulateLatency();
      this.persist();
      return updated;
    } catch (err) {
      this.rollback(previousViews, 'No se pudo actualizar la vista. Reintenta.');
      throw err;
    } finally {
      this.busy.set(false);
    }
  }

  async delete(id: string): Promise<boolean> {
    this.busy.set(true);
    const previousViews = this.views();
    const view = previousViews.find((v) => v.id === id);
    if (!view || view.system) {
      this.busy.set(false);
      return false;
    }
    this.views.update((views) => views.filter((v) => v.id !== id));
    try {
      await this.simulateLatency();
      this.persist();
      return true;
    } catch (err) {
      this.rollback(previousViews, 'No se pudo eliminar la vista. Reintenta.');
      throw err;
    } finally {
      this.busy.set(false);
    }
  }

  /**
   * Read view por id. Sync — view ya están hidratadas en el signal.
   * Devuelve null si no existe.
   */
  get(id: string): SavedView | null {
    return this.views().find((v) => v.id === id) ?? null;
  }

  // ── Internal ──────────────────────────────────────────────────────

  /**
   * Listener para `StorageEvent` — refresca el signal cuando otra tab
   * muta `STORAGE_KEY`. Sin esto, user con 2 tabs abre, crea view en
   * tab A, tab B nunca lo ve hasta refresh.
   *
   * StorageEvent NO fire en la MISMA tab que escribió — solo en otras.
   * Esto es exactamente lo que queremos: la tab que escribió ya tiene
   * el state correcto en memoria; las otras necesitan re-hidratar.
   */
  private attachStorageListener(): void {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        this.hydrate();
      }
    };
    window.addEventListener('storage', onStorage);
    this.destroyRef.onDestroy(() =>
      window.removeEventListener('storage', onStorage),
    );
  }

  private hydrate(): void {
    let custom: SavedView[] = [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      custom = sanitizeSavedViews(parsed);
    } catch {
      // Parse error / corruption — fall back a empty custom set.
      // No rollback toast acá: el user no inició la acción, es lectura
      // silenciosa al init/storage event.
    }
    this.views.set(this.sortViews([...SYSTEM_VIEWS, ...custom]));
  }

  private persist(): void {
    if (!this.isBrowser) return;
    const custom = this.views().filter((v) => !v.system);
    // Puede tirar QuotaExceededError → propaga al caller (create/
    // update/delete) que lo cachea y hace rollback. NO swallow acá.
    localStorage.setItem(STORAGE_KEY, JSON.stringify(custom));
  }

  /**
   * Rollback al state previo + notifica al consumer. Usado cuando la
   * persistencia simulada falla (quota exceeded, network error en
   * producción). Mantiene la UI consistente con el storage real —
   * sin esto, el signal queda divergente del storage.
   */
  private rollback(previousViews: readonly SavedView[], message: string): void {
    this.views.set(previousViews);
    this.rollbackHandler?.(message);
  }

  /**
   * Sort: system views primero (orden natural en el array),
   * después custom views por updatedAt desc (recientes arriba).
   */
  private sortViews(views: SavedView[]): SavedView[] {
    return [...views].sort((a, b) => {
      if (a.system && !b.system) return -1;
      if (!a.system && b.system) return 1;
      if (a.system && b.system) return 0; // preserve insertion order
      return b.updatedAt.localeCompare(a.updatedAt);
    });
  }

  /**
   * UUID v4 generator. `crypto.randomUUID()` es Baseline 2023+ (todos
   * los browsers modernos). Fallback a `crypto.getRandomValues` con
   * v4 bits manualmente para SSR/legacy. Generador no-cryptographic
   * (`Math.random`) era inadecuado — colisiones documentadas a >10⁶
   * IDs en sesiones largas.
   */
  private generateId(): string {
    // `crypto` global está tipado como `Crypto | undefined` solo en
    // algunos lib targets; el `in` narrowing falla en strict mode.
    // Capturamos en una variable tipada y hacemos checks runtime.
    const c: Crypto | undefined =
      typeof crypto !== 'undefined' ? crypto : undefined;
    if (c?.randomUUID) {
      return c.randomUUID();
    }
    if (c?.getRandomValues) {
      const bytes = c.getRandomValues(new Uint8Array(16));
      // v4 bits: byte 6 = 0100_xxxx, byte 8 = 10xx_xxxx
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = Array.from(bytes, (b: number) =>
        b.toString(16).padStart(2, '0'),
      );
      return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
    }
    // Last-resort fallback (SSR sin webcrypto — muy improbable).
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  private simulateLatency(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, NETWORK_LATENCY_MS));
  }
}

/**
 * System views shippeadas con el app. Pre-configuradas, no editables,
 * no deletables. Cubren los use cases más comunes de un sales lead
 * / account manager según research bigtech.
 *
 * `Object.freeze` profundo previene mutación accidental por consumers
 * (ej: `service.views()[0].snapshot.filters['x'] = 1` antes de freeze
 * corrompía la fuente canónica para futuras lecturas).
 */
const SYSTEM_VIEWS: readonly SavedView[] = Object.freeze(
  [
    {
      id: 'sys-all',
      name: 'Todos los clientes',
      system: true,
      snapshot: {
        filters: {},
        sort: null,
        columns: [],
        first: 0,
        rows: 10,
        detailId: null,
      },
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'sys-active',
      name: 'Cartera activa',
      system: true,
      snapshot: {
        filters: { cartera: ['CA'] },
        sort: null,
        columns: [],
        first: 0,
        rows: 10,
        detailId: null,
      },
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'sys-morosos',
      name: 'Morosos',
      system: true,
      snapshot: {
        filters: { cartera: ['CM'] },
        sort: { field: 'availableCredit', dir: 1 },
        columns: [],
        first: 0,
        rows: 10,
        detailId: null,
      },
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'sys-peligro',
      name: 'Peligro de fuga',
      system: true,
      snapshot: {
        filters: { lifecycle: ['PELIGRO FUGA'] },
        sort: null,
        columns: [],
        first: 0,
        rows: 10,
        detailId: null,
      },
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  ].map((view) => deepFreeze(view)),
) as readonly SavedView[];

function deepFreeze<T>(obj: T): T {
  if (obj && typeof obj === 'object') {
    Object.freeze(obj);
    for (const key of Object.keys(obj)) {
      deepFreeze((obj as Record<string, unknown>)[key]);
    }
  }
  return obj;
}

/**
 * Runtime shape validation. localStorage puede contener garbage por
 * versión vieja del schema, manipulación manual desde devtools, o
 * conflictos cross-app si dos apps comparten el key namespace.
 *
 * Filtra entries inválidas, no throw — mejor mostrar 0 custom views
 * que crash de la página entera.
 */
function sanitizeSavedViews(parsed: unknown): SavedView[] {
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isValidSavedView);
}

function isValidSavedView(value: unknown): value is SavedView {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (typeof v['id'] !== 'string' || v['id'].length === 0) return false;
  if (typeof v['name'] !== 'string') return false;
  if (typeof v['createdAt'] !== 'string') return false;
  if (typeof v['updatedAt'] !== 'string') return false;
  // System views should never be persisted to localStorage — solo
  // custom views se serializan. Si encontramos system: true en
  // storage es indicio de corrupción.
  if (v['system'] === true) return false;
  if (!isValidSnapshot(v['snapshot'])) return false;
  return true;
}

function isValidSnapshot(value: unknown): value is CustomersViewSnapshot {
  if (!value || typeof value !== 'object') return false;
  const s = value as Record<string, unknown>;
  if (!s['filters'] || typeof s['filters'] !== 'object') return false;
  if (s['sort'] !== null && (typeof s['sort'] !== 'object' || s['sort'] === null)) {
    return false;
  }
  if (!Array.isArray(s['columns'])) return false;
  if (!s['columns'].every((c) => typeof c === 'string')) return false;
  if (typeof s['first'] !== 'number') return false;
  if (typeof s['rows'] !== 'number') return false;
  if (s['detailId'] !== null && typeof s['detailId'] !== 'number') return false;
  return true;
}
