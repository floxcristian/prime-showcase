import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { ButtonModule } from 'primeng/button';

/**
 * Inline error block — used when a feature/region cannot render but
 * the rest of the page should keep working.
 *
 * **Distinct from `<app-empty-state>`**: empty = "no hay datos, todo
 * OK"; error = "intentamos cargar y falló". Different copy, different
 * icon (warning triangle vs decorative duotone), different CTA
 * ("Reintentar" vs "Crear nuevo").
 *
 * **Distinct from a `MessageService` toast**: a toast is transient
 * feedback about an action the user just took. This component is
 * persistent state — the data did not load, and the user needs to
 * see why right where the data should have been.
 *
 * Visual contract (frozen in `.claude/rules/ux-patterns.md`):
 *   - Icon: `fa-sharp-duotone fa-regular fa-triangle-exclamation`,
 *     `text-4xl`, `text-muted-color` (not red — red is reserved for
 *     inline form validation; persistent errors stay quiet).
 *   - Title: actionable verb-past, never blame the user ("No se
 *     pudo cargar el gráfico", not "Error inválido").
 *   - Description: 1–2 lines, max-w-md, accionable.
 *   - CTA: "Reintentar" by default, secondary severity.
 *
 * Lives in the same shape as `<app-empty-state>` for layout
 * predictability — same wrapper class, same padding, same focus
 * order. Designers building error/empty switching states get the
 * same dimensions across both.
 */
@Component({
  selector: 'app-error-state',
  imports: [ButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [class]="wrapperClass()" role="alert" aria-live="polite">
      <div
        class="flex flex-col items-center justify-center text-center gap-3 py-8 px-6"
      >
        <i [class]="iconClass()" aria-hidden="true"></i>
        <div class="flex flex-col gap-1 max-w-md">
          <h3 class="text-color font-bold leading-6">{{ title() }}</h3>
          @if (description()) {
            <p class="text-muted-color leading-6">{{ description() }}</p>
          }
        </div>
        @if (showRetry()) {
          <p-button
            [label]="retryLabel()"
            icon="fa-sharp fa-regular fa-arrows-rotate"
            severity="secondary"
            outlined
            (onClick)="retry.emit()"
          />
        }
        <ng-content />
      </div>
    </div>
  `,
})
export class ErrorStateComponent {
  /**
   * Verb-past title — what failed. E.g.: "No se pudo cargar el
   * gráfico", "Falló la sincronización". Avoid generic
   * "Error" / "Algo salió mal".
   */
  readonly title = input.required<string>();

  /** Optional 1–2 line description with the actionable next step. */
  readonly description = input<string>('');

  /**
   * Wraps the block in `border border-surface rounded-2xl` so the
   * block can stand alone as a card. Default `true` because the
   * common case is "feature is in a card and the card itself failed
   * to populate"; setting `false` removes the card chrome when
   * placed inside an existing card.
   */
  readonly bordered = input<boolean>(true);

  /** Suppress the retry button — for purely informational errors. */
  readonly showRetry = input<boolean>(true);

  /** Override the default "Reintentar" label. */
  readonly retryLabel = input<string>('Reintentar');

  /**
   * Override the warning icon. Accepts a Font Awesome icon NAME only
   * (e.g. `'fa-cloud-slash'`); the component composes the full
   * `fa-sharp-duotone fa-regular …` class.
   */
  readonly icon = input<string>('fa-triangle-exclamation');

  readonly retry = output<void>();

  protected readonly iconClass = computed(
    () => `fa-sharp-duotone fa-regular ${this.icon()} text-4xl text-muted-color`,
  );

  protected readonly wrapperClass = computed(() =>
    this.bordered() ? 'border border-surface rounded-2xl' : '',
  );
}
