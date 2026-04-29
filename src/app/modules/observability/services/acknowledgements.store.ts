import { computed, Injectable, signal } from '@angular/core';

/**
 * Store singleton de "items acuseados" — sobrevive a navegaciones del
 * usuario. Antes el estado vivía local al componente (`obs-inbox.ackedIds`,
 * `obs-alert-detail.localAcked`), por lo que al desmontar la vista se
 * perdía y los items reaparecían como "no acusados" al volver. Patrón
 * Linear/PagerDuty/Datadog: ack es un acto compromisivo del usuario que
 * persiste hasta resolver/clear.
 *
 * **Persistencia:** acá vive solo en memoria por scope de showcase. En
 * producción este store se conectaría a backend (POST /acks) y rehidrataría
 * el set al boot via `httpResource()` o similar.
 *
 * **API minimalista:** acks de inbox y de alerts comparten namespace por
 * id, ya que los ids no colisionan entre dominios (`inbox-XXX` vs
 * `alert-XXX`). Si en futuro hay riesgo de colisión, separar en dos sets.
 */
@Injectable({ providedIn: 'root' })
export class AcknowledgementsStore {
  private readonly _acked = signal<ReadonlySet<string>>(new Set());

  /** Set inmutable expuesto read-only. Consumers usan `isAcked(id)`. */
  readonly acked = this._acked.asReadonly();

  /** Cuántos items hay acuseados — útil para badges futuros. */
  readonly count = computed(() => this._acked().size);

  isAcked(id: string): boolean {
    return this._acked().has(id);
  }

  ack(id: string): void {
    if (this._acked().has(id)) return;
    this._acked.update((set) => {
      const next = new Set(set);
      next.add(id);
      return next;
    });
  }

  unack(id: string): void {
    if (!this._acked().has(id)) return;
    this._acked.update((set) => {
      const next = new Set(set);
      next.delete(id);
      return next;
    });
  }

  /** Limpia todo — útil para "Marcar todo como leído" o post-resolve. */
  clear(): void {
    this._acked.set(new Set());
  }
}
