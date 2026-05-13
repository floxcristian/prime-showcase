import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { Skeleton } from 'primeng/skeleton';

/**
 * Skeleton for a `<p-table>` row while data is loading.
 *
 * **Use as the body of a placeholder `<p-table>`**:
 *
 * ```html
 * @if (loading()) {
 *   <p-table [value]="placeholderRows" [paginator]="false">
 *     <ng-template #body>
 *       <tr><td colspan="6"><app-skeleton-table-row [columns]="6" /></td></tr>
 *     </ng-template>
 *   </p-table>
 * }
 * ```
 *
 * **Why fixed `columns`-driven geometry**: each `<p-table>` had its
 * own ad-hoc placeholder before (users.component had 9 hand-tuned
 * bars; customers had 7; uptime had 4). Same loading affordance,
 * three different shapes. Single primitive makes the row geometry a
 * function of column count, not module preference.
 */
@Component({
  selector: 'app-skeleton-table-row',
  imports: [Skeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="flex items-center gap-4 w-full"
      role="status"
      [attr.aria-busy]="'true'"
    >
      @for (col of columnsArray(); track col) {
        <div class="flex-1">
          <p-skeleton width="100%" height="1rem" />
        </div>
      }
    </div>
  `,
})
export class SkeletonTableRowComponent {
  /**
   * Number of column cells to render. Default `6` — most tables in
   * the showcase have 5–8 columns; 6 is a sane middle.
   */
  readonly columns = input<number>(6);

  protected readonly columnsArray = computed(() =>
    Array.from({ length: this.columns() }, (_, i) => i),
  );
}
