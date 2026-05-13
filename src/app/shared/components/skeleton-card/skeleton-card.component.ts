import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { Skeleton } from 'primeng/skeleton';

/**
 * Generic card-shaped skeleton: title, optional avatar, body block.
 *
 * **Use**: data cards, summary panels, KPI cards while the data
 * source loads. Mirrors the dimensions of the canonical card
 * documented in DESIGN.md "Card estándar"
 * (`border border-surface rounded-2xl p-6`).
 *
 * Three layouts via `variant`:
 *   - `'title-body'` (default): title + main block. KPI cards,
 *     summary panels.
 *   - `'header-body'`: avatar + title + subtitle + main block. List
 *     entries that look like cards.
 *   - `'media-body'`: media block + title + description. Movie /
 *     product cards.
 */
@Component({
  selector: 'app-skeleton-card',
  imports: [Skeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="border border-surface rounded-2xl p-6 flex flex-col gap-4"
      role="status"
      [attr.aria-busy]="'true'"
    >
      @if (variant() === 'header-body') {
        <div class="flex items-center gap-3">
          <p-skeleton shape="circle" size="2.5rem" />
          <div class="flex flex-col gap-2 flex-1">
            <p-skeleton width="40%" height="1rem" />
            <p-skeleton width="60%" height="0.75rem" />
          </div>
        </div>
      } @else if (variant() === 'media-body') {
        <p-skeleton width="100%" [height]="mediaHeight()" />
        <p-skeleton width="80%" height="1.25rem" />
        <p-skeleton width="60%" height="0.875rem" />
      } @else {
        <p-skeleton width="60%" height="1.25rem" />
      }
      <p-skeleton width="100%" [height]="bodyHeight()" />
    </div>
  `,
})
export class SkeletonCardComponent {
  readonly variant = input<'title-body' | 'header-body' | 'media-body'>(
    'title-body',
  );
  readonly bodyHeight = input<string>('8rem');
  readonly mediaHeight = input<string>('10rem');

  /** Convenience for `@for` consumers that want N copies. */
  static repeat(count: number): number[] {
    return Array.from({ length: count }, (_, i) => i);
  }

  protected readonly _ = computed(() => this.variant());
}
