import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { Skeleton } from 'primeng/skeleton';

/**
 * Skeleton for a single list-item row — avatar circle + two text
 * lines. Used in chat lists, inbox lists, contact lists. Mirrors the
 * dimensions of `<div class="flex items-center gap-2 p-4">…</div>`
 * + `<p-avatar shape="circle" size="2.5rem">` documented in
 * DESIGN.md "Item de lista".
 *
 * **Why a primitive** instead of inlining `<p-skeleton>` in each
 * module: chat / inbox / notifications used to each ship their own
 * placeholder geometry. List rows in chat were 56px tall, inbox were
 * 64px, notifications were 48px — same visual element, three
 * heights. The CLS-on-swap was different per module. Single
 * primitive locks the geometry.
 */
@Component({
  selector: 'app-skeleton-list-item',
  imports: [Skeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="flex items-center gap-2 p-4"
      role="status"
      [attr.aria-busy]="'true'"
    >
      <p-skeleton shape="circle" size="2.5rem" />
      <div class="flex-1 flex flex-col gap-2">
        <p-skeleton [width]="primaryWidth()" height="1rem" />
        <p-skeleton [width]="secondaryWidth()" height="0.75rem" />
      </div>
    </div>
  `,
})
export class SkeletonListItemComponent {
  /** Width of the primary (name/title) line. Default `60%`. */
  readonly primaryWidth = input<string>('60%');
  /** Width of the secondary (preview/timestamp) line. Default `40%`. */
  readonly secondaryWidth = input<string>('40%');
}

/**
 * Convenience helper for repeating the row N times inside a parent
 * `@for` block. Use directly in the template:
 *
 *   <app-skeleton-list-item-group [rows]="5" />
 *
 * Equivalent to writing the `@for` block yourself, but locks the
 * loop pattern across modules.
 */
@Component({
  selector: 'app-skeleton-list-item-group',
  imports: [SkeletonListItemComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (i of indices(); track i) {
      <app-skeleton-list-item
        [primaryWidth]="primaryWidth()"
        [secondaryWidth]="secondaryWidth()"
      />
    }
  `,
})
export class SkeletonListItemGroupComponent {
  readonly rows = input<number>(5);
  readonly primaryWidth = input<string>('60%');
  readonly secondaryWidth = input<string>('40%');

  protected readonly indices = computed(() =>
    Array.from({ length: this.rows() }, (_, i) => i),
  );
}
