import { inject, Injectable } from '@angular/core';
import { MessageService } from 'primeng/api';

/**
 * Centralised toast feedback for the app.
 *
 * Reasons this service exists instead of injecting `MessageService` ad-hoc:
 *
 *   1. **Single severity contract.** PrimeNG accepts arbitrary strings as
 *      `severity`, which makes it easy to drift into "error", "Error",
 *      `'danger'` or other one-off variants across modules. Exposing
 *      typed methods (`error`, `success`, `info`, `warn`) locks the
 *      vocabulary at compile time and matches the rules in
 *      `.claude/rules/ux-patterns.md`.
 *
 *   2. **Single timing contract.** Every team writing `messageService.add`
 *      would re-pick `life` from scratch. Big tech systems pick once and
 *      stick to it: 5s for errors (long enough to read + retry),
 *      3s for success (short — user already saw the result), 4s for
 *      info/warn (in between). Centralised here.
 *
 *   3. **Single positioning contract.** All toasts of the app share one
 *      `<p-toast position="bottom-right">` mounted by `MainComponent`.
 *      Modules just consume this service — they do not declare their own
 *      `<p-toast>` instance, which would otherwise lead to stacking
 *      conflicts and inconsistent off-screen anchors.
 *
 *   4. **Optimistic-undo helper.** Toggles, votes and bookmarks demand the
 *      "undo" affordance; `withUndo()` packages it as one call so optimistic
 *      flows do not reinvent the `sticky + key` plumbing.
 */
@Injectable({ providedIn: 'root' })
export class AppToastService {
  private readonly messages = inject(MessageService);

  /**
   * Default timings (ms). Tuning here propagates to the whole app.
   * 5s errors / 3s success / 4s info|warn matches the cadence used by
   * Linear, Stripe, GitHub Primer and Polaris.
   */
  static readonly TIMING = {
    error: 5000,
    success: 3000,
    info: 4000,
    warn: 4000,
  } as const;

  /**
   * Display an error toast. `summary` should describe what failed in
   * a verb-past form ("No se pudo guardar"); `detail` should be the
   * next actionable step ("Verificá tu conexión y volvé a intentar").
   */
  error(summary: string, detail?: string, opts?: ToastOptions): void {
    this.show('error', summary, detail, opts);
  }

  success(summary: string, detail?: string, opts?: ToastOptions): void {
    this.show('success', summary, detail, opts);
  }

  info(summary: string, detail?: string, opts?: ToastOptions): void {
    this.show('info', summary, detail, opts);
  }

  warn(summary: string, detail?: string, opts?: ToastOptions): void {
    this.show('warn', summary, detail, opts);
  }

  /**
   * Optimistic-update helper. Show a "success" toast that includes an
   * Undo affordance and resolves the returned promise to `true` if the
   * user pressed Undo, `false` if the toast timed out.
   *
   * Consumers wire the Undo path in their own component template using
   * `<p-toast key="undo">` because the action button slot needs a
   * template — this helper returns the descriptor; the calling code
   * applies it.
   */
  withUndoKey(): string {
    return 'app-toast-undo';
  }

  /**
   * Clear every toast currently shown. Useful when navigating away from
   * a screen that owned the messages (e.g. closing a wizard).
   */
  clear(key?: string): void {
    this.messages.clear(key);
  }

  private show(
    severity: ToastSeverity,
    summary: string,
    detail?: string,
    opts?: ToastOptions,
  ): void {
    this.messages.add({
      severity,
      summary,
      detail,
      life: opts?.life ?? AppToastService.TIMING[severity],
      sticky: opts?.sticky ?? false,
      closable: opts?.closable ?? true,
      key: opts?.key,
    });
  }
}

/**
 * Vocabulary lock-in: only these four strings are valid severities
 * across the app. Mirrors the rule in `.claude/rules/ux-patterns.md`.
 */
export type ToastSeverity = 'error' | 'success' | 'info' | 'warn';

export interface ToastOptions {
  /** Override the default timing. Use sparingly — defaults are tuned. */
  life?: number;
  /** Disable auto-dismiss. Reserved for blocking errors that require an action. */
  sticky?: boolean;
  /** Allow user to close manually. Default true. */
  closable?: boolean;
  /**
   * Scope the toast to a specific `<p-toast key="...">` instance.
   * Default routes to the root `<p-toast>` in `MainComponent`.
   */
  key?: string;
}
