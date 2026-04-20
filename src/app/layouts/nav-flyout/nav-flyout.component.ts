import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { NavSectionsComponent } from '../nav/nav-sections/nav-sections.component';
import { NavStateService } from '../nav/nav-state.service';

/**
 * Preview panel shown when the user hovers (or keyboard-focuses) a rail item
 * different from the committed module. Absolutely positioned over the
 * committed sidebar's footprint — appears and disappears without moving the
 * underlying layout.
 *
 * Behavior contract:
 *   - Entering this panel cancels any pending close scheduled by the rail's
 *     mouseleave, so moving diagonally from rail to flyout is safe.
 *   - Leaving this panel (without re-entering the rail) schedules a close
 *     with the standard 200ms delay.
 *   - Clicking a leaf commits the flyout's module to the active sidebar
 *     BEFORE the routerLink fires. This guarantees the URL sync finds the
 *     committed module owning the URL and the routed page lands in the right
 *     sidebar context.
 *   - Escape closes the flyout without committing.
 *
 * Positioning: `left-16` matches rail width so the flyout sits flush against
 * the rail's right border. Parent requires `relative` positioning context.
 */
@Component({
  selector: 'app-nav-flyout',
  imports: [NavSectionsComponent],
  templateUrl: './nav-flyout.component.html',
  styleUrl: './nav-flyout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'absolute left-16 top-0 bottom-0 w-60 border-r border-surface bg-surface-50 dark:bg-surface-900 flex flex-col overflow-hidden z-20',
    '(mouseenter)': 'nav.cancelHoverClose()',
    '(mouseleave)': 'nav.closeHoverModule()',
    '(keydown.escape)': 'onEscape()',
  },
})
export class NavFlyoutComponent {
  protected nav = inject(NavStateService);

  onEscape(): void {
    this.nav.clearHoverImmediate();
  }

  onLeafClicked(): void {
    const hoveredId = this.nav.hoveredModuleId();
    if (hoveredId) this.nav.setActiveModule(hoveredId);
    this.nav.clearHoverImmediate();
  }
}
