// Angular
import { computed, effect, inject, Injectable, signal } from '@angular/core';

// Local
import { SocialSettingsService } from './social-settings.service';

/**
 * Store singleton de recomendaciones descartadas — clon del patrón de
 * `acknowledgements.store.ts` (observability): el "dismissed" es un acto
 * compromisivo del usuario que sobrevive a navegaciones, por lo que NO
 * vive local al componente del feed. La entidad `Recommendation` queda
 * inmutable (RFC-002 D2): el feed filtra con `computed` contra este set.
 *
 * **Persistencia:** acá vive solo en memoria por scope de showcase. En
 * producción este store se conectaría a backend (POST /dismissals) y
 * rehidrataría el set al boot vía `httpResource()` o similar.
 *
 * **Aislamiento por cliente (RFC-002 D6, último bullet):** el store es un
 * singleton root con estado mutable — sin reset, los descartes del
 * cliente A sobrevivirían a un logout/login del cliente B. El único
 * `effect()` de la clase observa `SocialSettingsService.clientSeed()` y
 * ante un cambio resetea el set a vacío. Límite documentado: lo NO
 * persistido se descarta al logout — al volver, el cliente A ve su feed
 * completo de nuevo (solo `TenantProviderState` se persiste, RFC-002
 * alternativa 6).
 */
@Injectable({ providedIn: 'root' })
export class RecommendationDismissalsStore {
  private readonly settings = inject(SocialSettingsService);

  private readonly _dismissed = signal<ReadonlySet<string>>(new Set());

  /** Set inmutable expuesto read-only. Consumers usan `isDismissed(id)`. */
  readonly dismissed = this._dismissed.asReadonly();

  /** Cuántas recomendaciones hay descartadas — útil para badges futuros. */
  readonly count = computed(() => this._dismissed().size);

  /**
   * ÚNICO `effect()` del store (RFC-002 D6): ante login/logout/cambio de
   * cliente, el set vuelve a vacío — el cliente B jamás ve descartes de A.
   */
  private lastSeed = this.settings.clientSeed();
  private readonly clientScopeEffect = effect(() => {
    const seed = this.settings.clientSeed();
    if (seed === this.lastSeed) {
      return;
    }
    this.lastSeed = seed;
    this._dismissed.set(new Set());
  });

  isDismissed(id: string): boolean {
    return this._dismissed().has(id);
  }

  dismiss(id: string): void {
    if (this._dismissed().has(id)) {
      return;
    }
    this._dismissed.update((set) => {
      const next = new Set(set);
      next.add(id);
      return next;
    });
  }

  /** Deshace un descarte — habilita el "Deshacer" del toast del feed. */
  undismiss(id: string): void {
    if (!this._dismissed().has(id)) {
      return;
    }
    this._dismissed.update((set) => {
      const next = new Set(set);
      next.delete(id);
      return next;
    });
  }

  /** Limpia todo — útil para "Restaurar recomendaciones descartadas". */
  clear(): void {
    this._dismissed.set(new Set());
  }
}
