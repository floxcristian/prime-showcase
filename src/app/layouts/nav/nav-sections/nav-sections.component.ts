import { NgClass } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  Injector,
  input,
  output,
  viewChildren,
} from '@angular/core';
import { RouterModule } from '@angular/router';

import { NavModule } from '../models/nav-module.interface';

const NG_MODULES = [NgClass, RouterModule];

/**
 * Renders la jerarquía L2/L3 de un módulo — sections como headers no
 * interactivos + children como leaves routerLink. Usado en:
 *   - Desktop mega-menu: segunda columna anclada al preview.
 *   - Mobile drill: full-width con todas las sections del módulo drilleado.
 *
 * ### Scroll memory
 * El componente se remonta cada vez que el `[module]` input cambia (el
 * parent usa `@if (selectedModule(); as mod)` que destruye+recrea). Sin
 * restauración, el scrollTop revertiría a 0 cada switch. El parent mantiene
 * un Map<moduleId, scrollTop> y pasa el valor via `[restoreScrollTop]`; al
 * mount se aplica via `afterNextRender` (necesita el DOM presente).
 *
 * ### Outputs
 *   - `leafClicked`: se navegó a un leaf — host commitea módulo + cierra.
 *   - `requestReturnToL1`: ArrowLeft en un L3 → host vuelve foco a L1.
 *   - `scrollChange`: scrollTop actualizado — host persiste para futuro switch.
 *
 * ### Keyboard nav L3
 *   ArrowUp/ArrowDown: cicla entre leaves (wrap).
 *   Home / End: primer / último leaf.
 *   ArrowLeft: emite `requestReturnToL1`.
 *   Enter: default del `<a>` — navega.
 *   Escape: manejado globalmente por host.
 */
@Component({
  selector: 'app-nav-sections',
  imports: [NG_MODULES],
  templateUrl: './nav-sections.component.html',
  styleUrl: './nav-sections.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'flex-1 overflow-y-auto overflow-x-hidden pb-3 w-full',
    '(scroll)': 'onScroll($event)',
  },
})
export class NavSectionsComponent {
  readonly module = input.required<NavModule>();
  /** scrollTop inicial a restaurar post-mount (default 0). */
  readonly restoreScrollTop = input<number>(0);
  readonly leafClicked = output<void>();
  /** Emitido al presionar ArrowLeft en un leaf — host vuelve foco a L1. */
  readonly requestReturnToL1 = output<void>();
  /** Emitido en cada scroll — host persiste en Map por moduleId. */
  readonly scrollChange = output<number>();

  private hostRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private injector = inject(Injector);

  /** Refs a los L3 leaves — array signal para keyboard nav sin DOM queries. */
  private l3Leaves = viewChildren<ElementRef<HTMLAnchorElement>>('l3Item');

  constructor() {
    // Restaurar scrollTop post-mount. afterNextRender garantiza que el
    // host element tiene su contenido renderizado (altura definida), así
    // el browser puede aplicar el scroll correctamente.
    afterNextRender(
      () => {
        const top = this.restoreScrollTop();
        if (top > 0) {
          this.hostRef.nativeElement.scrollTop = top;
        }
      },
      { injector: this.injector },
    );
  }

  /** Host scroll handler — emite scrollTop al parent para persistencia. */
  protected onScroll(event: Event): void {
    const el = event.currentTarget as HTMLElement;
    this.scrollChange.emit(el.scrollTop);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const leaves = this.l3Leaves().map((r) => r.nativeElement);
    if (leaves.length === 0) return;
    const active = document.activeElement as HTMLAnchorElement | null;
    const currentIdx = active ? leaves.indexOf(active) : -1;

    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault();
        const next = currentIdx < 0 ? 0 : (currentIdx + 1) % leaves.length;
        leaves[next].focus();
        break;
      }
      case 'ArrowUp': {
        event.preventDefault();
        const prev =
          currentIdx < 0
            ? leaves.length - 1
            : (currentIdx - 1 + leaves.length) % leaves.length;
        leaves[prev].focus();
        break;
      }
      case 'Home': {
        event.preventDefault();
        leaves[0].focus();
        break;
      }
      case 'End': {
        event.preventDefault();
        leaves[leaves.length - 1].focus();
        break;
      }
      case 'ArrowLeft': {
        event.preventDefault();
        this.requestReturnToL1.emit();
        break;
      }
    }
  }
}
