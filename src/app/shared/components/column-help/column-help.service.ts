import { Injectable } from '@angular/core';

/**
 * Coordinador singleton de instancias `<app-column-help>` activas.
 * Garantiza que solo UNA legend esté abierta en pantalla — abrir una
 * cierra las demás automáticamente.
 *
 * Patrón bigtech (Stripe / Linear / Notion / GitHub): múltiples
 * popovers simultáneos crean carga cognitiva (¿cuál es el contexto
 * actual?). Single instance = single source of focus.
 *
 * **Por qué service y no @Output events**: cualquier instancia puede
 * estar en cualquier parte del árbol. Service inject root facilita
 * coordinación cross-component sin requerir parent/children
 * relationships explícitas.
 */
@Injectable({ providedIn: 'root' })
export class ColumnHelpService {
  /** Instancia actualmente abierta — null cuando no hay ninguna. */
  private active: ColumnHelpInstance | null = null;

  /**
   * Notifica que `instance` está abriéndose. Si había otra abierta,
   * la cierra. Llamado desde `ColumnHelpComponent.show()` antes del
   * `popover.show()`.
   */
  notifyOpen(instance: ColumnHelpInstance): void {
    if (this.active && this.active !== instance) {
      this.active.forceHide();
    }
    this.active = instance;
  }

  /**
   * Notifica que `instance` se cerró (por cualquier vía: hover-leave,
   * click outside, otro popover abriendo). Limpia la referencia si
   * coincide con la activa.
   */
  notifyClose(instance: ColumnHelpInstance): void {
    if (this.active === instance) {
      this.active = null;
    }
  }
}

/**
 * Contrato mínimo que debe cumplir cualquier instancia registrada
 * en el service. Evita import circular component → service → component.
 */
export interface ColumnHelpInstance {
  forceHide(): void;
}
