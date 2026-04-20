import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { NavStateService } from '../nav/nav-state.service';

const NG_MODULES = [NgClass];

/**
 * L1 icon rail. Rendering is simple; the behavioral contract is what matters:
 *
 *   - **Pointer enter on a rail item** → previews that module in the flyout
 *     via `openHoverModule` (150ms idle delay, instant when already open).
 *   - **Keyboard focus on a rail item** → same effect. Uses `(focus)` not
 *     `(focusin)` so it fires for the button itself, not bubbled child focus.
 *   - **Pointer/focus leaves the rail** → schedules a 200ms close. The flyout
 *     panel's own mouseenter cancels this if the pointer is crossing into it.
 *   - **Click** → commits (`setActiveModule` also clears hover immediately).
 *   - **Escape** → clears hover without committing (matches flyout behavior
 *     for keyboard users who opened the preview via focus and want out).
 *
 * No tooltip here: the flyout shows the module name in its header. Showing a
 * tooltip on top of an already-open flyout is redundant noise.
 */
@Component({
  selector: 'app-nav-rail',
  imports: [NG_MODULES],
  templateUrl: './nav-rail.component.html',
  styleUrl: './nav-rail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'w-16 shrink-0 h-full border-r border-surface bg-surface-50 dark:bg-surface-900 flex flex-col items-center py-3 gap-2 overflow-y-auto overflow-x-hidden',
    '(mouseleave)': 'nav.closeHoverModule()',
    '(focusout)': 'onRailFocusOut($event)',
    '(keydown.escape)': 'nav.clearHoverImmediate()',
  },
})
export class NavRailComponent {
  protected nav = inject(NavStateService);

  /**
   * Close the preview only when focus leaves the rail entirely — not when it
   * moves between rail buttons. `relatedTarget` is the element receiving
   * focus; if it's still inside this host, do nothing.
   */
  onRailFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    const rail = event.currentTarget as Node | null;
    if (next && rail && rail.contains(next)) return;
    this.nav.closeHoverModule();
  }
}
