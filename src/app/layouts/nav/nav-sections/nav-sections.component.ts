import { NgClass } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  output,
} from '@angular/core';
import { RouterModule } from '@angular/router';

import { NavModule } from '../models/nav-module.interface';

const NG_MODULES = [NgClass, RouterModule];

/**
 * Renders la jerarquía L2/L3 de un módulo — sections como headers no
 * interactivos + children como leaves routerLink. Usado en los dos
 * contextos de `<app-nav-overlay>`:
 *   - Desktop mega-menu: segunda columna anclada al preview hover/focus.
 *   - Mobile drill: full-width con todas las sections del módulo drilleado.
 *
 * Emite `leafClicked` cuando se navega — el host (nav-overlay) cierra el
 * overlay y commitea el módulo (para el caso desktop donde el módulo
 * previsualizado aún no es el activo).
 *
 * Keyboard nav:
 *   ArrowUp/ArrowDown: cicla entre L3 leaves (wrap).
 *   Home / End: primer / último leaf.
 *   ArrowLeft: delega al host overlay para volver foco a L1 (emit event).
 *   Enter: default del <a> — navega por routerLink.
 *   Escape: manejado globalmente por nav-overlay (cierra overlay).
 */
@Component({
  selector: 'app-nav-sections',
  imports: [NG_MODULES],
  templateUrl: './nav-sections.component.html',
  styleUrl: './nav-sections.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'flex-1 overflow-y-auto overflow-x-hidden pb-3 w-full',
  },
})
export class NavSectionsComponent {
  readonly module = input.required<NavModule>();
  readonly leafClicked = output<void>();
  /** Emitido al presionar ArrowLeft en un leaf — host vuelve foco a L1. */
  readonly requestReturnToL1 = output<void>();

  private hostRef = inject<ElementRef<HTMLElement>>(ElementRef);

  protected onKeydown(event: KeyboardEvent): void {
    const host = this.hostRef.nativeElement;
    const leaves = Array.from(
      host.querySelectorAll<HTMLAnchorElement>('a[data-l3-item]'),
    );
    if (leaves.length === 0) return;
    const currentIdx = leaves.indexOf(
      document.activeElement as HTMLAnchorElement,
    );

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
