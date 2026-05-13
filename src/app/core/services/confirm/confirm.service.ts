import { inject, Injectable } from '@angular/core';
import { ConfirmationService } from 'primeng/api';

/**
 * Wrapper around `ConfirmationService` that locks down the dialog UX
 * to one shape: destructive vs. benign confirmations.
 *
 * Reasons this exists:
 *
 *   1. **Vocabulary lock-in.** Big-tech UX research (Adam Silver, NN/g,
 *      GOV.UK) is unanimous: never label a confirm button "OK" / "Sí".
 *      The button must echo the verb of the header ("Eliminar",
 *      "Cancelar suscripción"). Without a wrapper, every team writes
 *      their own dialog and drifts toward "Confirmar" / "Aceptar".
 *
 *   2. **Severity colours.** Destructive confirmations always use
 *      `p-button-danger` for accept; benign use the default primary.
 *      Ad-hoc `ConfirmationService.confirm()` calls forget this and
 *      ship "Eliminar" buttons in primary blue.
 *
 *   3. **Reject label is stable.** The reject button is always
 *      "Cancelar" (the action of dismissing the dialog, never of the
 *      operation). Mirrors macOS/Apple HIG.
 *
 *   4. **Icon contract.** Destructive dialogs use
 *      `fa-sharp fa-regular fa-triangle-exclamation`; benign use no
 *      icon. PrimeNG's default checkmark conveys nothing.
 *
 * Mirrors the rules documented in `.claude/rules/ux-patterns.md`.
 */
@Injectable({ providedIn: 'root' })
export class AppConfirmService {
  private readonly confirm = inject(ConfirmationService);

  /**
   * Destructive confirmation. The accept button paints
   * `p-button-danger`, the icon is the warning triangle.
   *
   * Apply to: delete, archive permanently, cancel subscription,
   * leave without saving, bulk actions on many items.
   *
   * @returns Promise resolving to `true` if accepted, `false` if
   *          rejected or dismissed. Promises make `await` flows
   *          symmetric with optimistic-undo helpers.
   */
  destructive(options: ConfirmOptions): Promise<boolean> {
    return this.show({
      ...options,
      severity: 'danger',
    });
  }

  /**
   * Benign confirmation (no destructive consequences). Use sparingly:
   * if it's reversible, prefer a toast with undo instead of a modal.
   *
   * Apply to: actions whose cost-of-confirm is justified by ambiguity
   * ("¿Quieres aplicar este filtro a todas las facturas?"), not for
   * routine confirmations.
   */
  benign(options: ConfirmOptions): Promise<boolean> {
    return this.show({
      ...options,
      severity: 'primary',
    });
  }

  /**
   * Hide whatever confirm dialog is currently open. Useful when
   * navigating away or when an external event resolves the question.
   */
  close(): void {
    this.confirm.close();
  }

  private show(opts: ConfirmInternalOptions): Promise<boolean> {
    return new Promise((resolve) => {
      const isDanger = opts.severity === 'danger';
      this.confirm.confirm({
        header: opts.header,
        message: opts.message,
        icon: isDanger
          ? 'fa-sharp fa-regular fa-triangle-exclamation'
          : undefined,
        acceptLabel: opts.acceptLabel,
        acceptButtonStyleClass: isDanger
          ? 'p-button-danger'
          : 'p-button-primary',
        rejectLabel: opts.rejectLabel ?? 'Cancelar',
        rejectButtonStyleClass: 'p-button-text',
        accept: () => resolve(true),
        reject: () => resolve(false),
      });
    });
  }
}

export interface ConfirmOptions {
  /**
   * Verb + object, mirrors the accept button. NEVER a question.
   * Good: "Eliminar registro", "Cancelar suscripción".
   * Bad:  "¿Estás seguro?".
   */
  header: string;

  /**
   * Plain language describing what happens and what is lost. Concrete,
   * never generic. "Se eliminarán 12 ítems vinculados.", not "Se
   * perderán datos.".
   */
  message: string;

  /**
   * The verb of the header. "Eliminar", "Cancelar suscripción".
   * NEVER "Sí" / "OK".
   */
  acceptLabel: string;

  /**
   * Defaults to "Cancelar" (the action of dismissing the dialog).
   * Override only for dialogs where dismissing performs an action
   * other than no-op — rare.
   */
  rejectLabel?: string;
}

interface ConfirmInternalOptions extends ConfirmOptions {
  severity: 'danger' | 'primary';
}
