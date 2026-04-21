import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col items-center justify-center text-center gap-4 py-8 px-6">
      <i [class]="iconClass()" aria-hidden="true"></i>
      <div class="flex flex-col gap-1 max-w-sm">
        <h3 class="text-color font-bold leading-6">{{ title() }}</h3>
        @if (description()) {
          <p class="text-muted-color leading-6">{{ description() }}</p>
        }
      </div>
      <ng-content />
    </div>
  `,
})
export class EmptyStateComponent {
  icon = input.required<string>();
  title = input.required<string>();
  description = input<string>('');

  iconClass = computed(
    () => `fa-sharp-duotone fa-regular ${this.icon()} text-4xl text-color`
  );
}
