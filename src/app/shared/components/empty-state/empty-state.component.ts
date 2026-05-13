import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';

/**
 * Componente unificado para estados de "sin datos" / "error" / "no
 * encontrado". Antes había 4 variantes coexistiendo (shared component,
 * inline card with button, inline sin border, plain `<p>`) — esta versión
 * extendida cubre los 4 patrones con una sola API:
 *
 *   - inline plano (default): para tab vacíos / dentro de cards existentes
 *   - bordered: card autocontenida con border + radius (error states,
 *     "no encontrado" en detail views, empty filters en list views)
 *   - con action CTA: agrega un `<p-button>` que emite `actionClick`
 *
 * Pattern bigtech: una sola primitive para cualquier "no hay data /
 * algo salió mal", evita el drift visual entre vistas.
 */
@Component({
  selector: 'app-empty-state',
  imports: [ButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [class]="wrapperClass()">
      <div class="flex flex-col items-center justify-center text-center gap-3 py-8 px-6">
        <i [class]="iconClass()" aria-hidden="true"></i>
        <div class="flex flex-col gap-1 max-w-sm">
          <h3 class="text-color font-bold leading-6">{{ title() }}</h3>
          @if (description()) {
            <p class="text-muted-color leading-6">{{ description() }}</p>
          }
        </div>
        @if (actionLabel()) {
          <p-button [label]="actionLabel()" [icon]="actionIcon()" severity="secondary" (onClick)="actionClick.emit()" />
        }
        <ng-content />
      </div>
    </div>
  `,
})
export class EmptyStateComponent {
  /** Nombre del icono Font Awesome sin prefijos (ej: 'fa-magnifying-glass'). */
  readonly icon = input.required<string>();
  readonly title = input.required<string>();
  readonly description = input<string>('');

  /**
   * Si true, envuelve el contenido en una card `border border-surface
   * rounded-2xl`. Usar en error/empty states de top-level (list views,
   * detail "no encontrado"). Dejar false dentro de tabs/cards existentes
   * para evitar doble border anidado.
   */
  readonly bordered = input<boolean>(false);

  /** Si presente, renderiza un CTA `<p-button>` que emite `actionClick`. */
  readonly actionLabel = input<string>('');
  readonly actionIcon = input<string>('');
  readonly actionClick = output<void>();

  protected readonly iconClass = computed(() => `fa-sharp-duotone fa-regular ${this.icon()} text-4xl text-color`);

  protected readonly wrapperClass = computed(() => (this.bordered() ? 'border border-surface rounded-2xl' : ''));
}
