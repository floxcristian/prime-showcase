import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { Skeleton } from 'primeng/skeleton';

/**
 * Generic full-block loading placeholder — used when an entire region
 * is fetching and the consumer does not want to hand-craft a custom
 * skeleton geometry.
 *
 * Use:
 *   <app-loading-state height="20rem" rows="3" />
 *
 * **When to prefer this over inline `<p-skeleton>`**: when the block
 * is generic enough that bespoke geometry would just be noise (most
 * cards, summary panels, dashboards). When the placeholder needs to
 * mirror a specific table or list, use `<app-skeleton-table-row>` /
 * `<app-skeleton-list-item>` instead.
 *
 * **a11y**: applies `aria-busy="true"` on the container so screen
 * readers announce "ocupado" without enumerating every individual
 * skeleton bar. Pattern matches the rule in
 * `.claude/rules/ssr-and-runtime.md`.
 *
 * **Motion**: PrimeNG's Aura skeleton already animates a `wave`
 * highlight; no custom keyframes. Respects `prefers-reduced-motion`
 * via the global media query in `styles.scss`.
 */
@Component({
  selector: 'app-loading-state',
  imports: [Skeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      [class]="wrapperClass()"
      [attr.aria-busy]="'true'"
      [attr.aria-label]="ariaLabel()"
      role="status"
    >
      <div class="flex flex-col gap-3 p-6">
        @if (showTitle()) {
          <p-skeleton width="12rem" height="1.5rem" />
        }
        @for (i of rowsArray(); track i) {
          <p-skeleton width="100%" [height]="rowHeight()" />
        }
      </div>
    </div>
  `,
})
export class LoadingStateComponent {
  /**
   * Number of skeleton rows to render under the title. Default 3.
   * Pick a number that mirrors the real content geometry so swap-in
   * is CLS-free.
   */
  readonly rows = input<number>(3);

  /** Each row's height (CSS units, defaults to `'1rem'`). */
  readonly rowHeight = input<string>('1rem');

  /** Show a wider top skeleton that mirrors the section title. */
  readonly showTitle = input<boolean>(true);

  /**
   * `border border-surface rounded-2xl` wrapper. Default `true`. Set
   * `false` when placing inside an existing card.
   */
  readonly bordered = input<boolean>(true);

  /** Screen reader description of what's loading. */
  readonly ariaLabel = input<string>('Cargando contenido');

  protected readonly rowsArray = computed(() =>
    Array.from({ length: this.rows() }, (_, i) => i),
  );

  protected readonly wrapperClass = computed(() =>
    this.bordered() ? 'border border-surface rounded-2xl' : '',
  );
}
