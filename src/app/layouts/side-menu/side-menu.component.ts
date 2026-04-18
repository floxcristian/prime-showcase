// Angular
import { NgClass } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterModule } from '@angular/router';
// PrimeNG
import { AvatarModule } from 'primeng/avatar';
import { DividerModule } from 'primeng/divider';
import { TooltipModule } from 'primeng/tooltip';
// App
import { SettingsDrawerComponent } from './settings-drawer/settings-drawer.component';
// Models
import { SidebarNavItem } from './models/sidebar-nav-item.interface';
// Constants
import { SIDEBAR_NAV_ITEMS } from './constants/sidebar-nav-items';

const NG_MODULES = [RouterModule, NgClass];
const PRIME_MODULES = [AvatarModule, DividerModule, TooltipModule];
const LOCAL_COMPONENTS = [SettingsDrawerComponent];

@Component({
  selector: 'app-side-menu',
  imports: [NG_MODULES, PRIME_MODULES, LOCAL_COMPONENTS],
  templateUrl: './side-menu.component.html',
  styleUrl: './side-menu.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'h-full',
  },
})
export class SideMenuComponent {
  isSlimMenu = signal(true);
  sampleAppsSidebarNavs: SidebarNavItem[] = SIDEBAR_NAV_ITEMS;
  settingsNavTitle = 'Configuración';
  settingsNavIcon = 'fa-sharp fa-regular fa-gear';

  dashboardSidebarVisible = signal(false);

  private injector = inject(Injector);
  private settingsTriggerRef =
    viewChild<ElementRef<HTMLButtonElement>>('settingsTrigger');

  restoreTriggerFocus(): void {
    afterNextRender(
      () => {
        this.settingsTriggerRef()?.nativeElement.focus();
      },
      { injector: this.injector },
    );
  }
}
