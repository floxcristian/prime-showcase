import { NgClass } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
} from '@angular/core';
import { RouterModule } from '@angular/router';

import { NavModule } from '../models/nav-module.interface';
import { NavStateService } from '../nav-state.service';

const NG_MODULES = [NgClass, RouterModule];

/**
 * Renders the L2/L3 accordion for a given module. Used in two surfaces:
 *   1. **Committed sidebar** (`<app-side-menu>`) — shows the active module.
 *   2. **Hover flyout** (`<app-nav-flyout>`) — shows a previewed module.
 *
 * Accordion expand state is owned by NavStateService so it survives across
 * surface switches (expanding "Adm. Clientes" in the flyout persists when
 * that module becomes the committed sidebar).
 *
 * Emits `leafClicked` so the hosting surface can commit the module on
 * navigation (the flyout relies on this to set the module active before the
 * URL sync fires, so the routed page lands in the right sidebar context).
 */
@Component({
  selector: 'app-nav-sections',
  imports: [NG_MODULES],
  templateUrl: './nav-sections.component.html',
  styleUrl: './nav-sections.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'flex-1 overflow-y-auto overflow-x-hidden px-2 py-3 w-full',
  },
})
export class NavSectionsComponent {
  protected nav = inject(NavStateService);

  readonly module = input.required<NavModule>();
  readonly columns = input<number>(1);
  readonly leafClicked = output<void>();
}
