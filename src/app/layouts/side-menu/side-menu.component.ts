import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { NavSectionsComponent } from '../nav/nav-sections/nav-sections.component';
import { NavStateService } from '../nav/nav-state.service';

@Component({
  selector: 'app-side-menu',
  imports: [NavSectionsComponent],
  templateUrl: './side-menu.component.html',
  styleUrl: './side-menu.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'w-60 shrink-0 h-full border-r border-surface bg-surface-50 dark:bg-surface-900 flex flex-col overflow-hidden',
  },
})
export class SideMenuComponent {
  protected nav = inject(NavStateService);
}
