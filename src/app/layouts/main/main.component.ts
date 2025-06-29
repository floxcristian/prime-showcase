import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { DrawerModule } from 'primeng/drawer';
import { ButtonModule } from 'primeng/button';
import { SideMenuComponent } from '../side-menu/side-menu.component';
import { SIDEBAR_NAV_ITEMS } from '../side-menu/constants/sidebar-nav-items';
import { SidebarNavItem } from '../side-menu/models/sidebar-nav-item.interface';

const NG_MODULES = [CommonModule, RouterOutlet];
const PRIME_MODULES = [DrawerModule, ButtonModule];
const COMPONENTS = [SideMenuComponent];

@Component({
  selector: 'app-main',
  imports: [...NG_MODULES, ...PRIME_MODULES, ...COMPONENTS],
  templateUrl: './main.component.html',
  styleUrl: './main.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'flex-1 h-full overflow-y-auto pb-0.5',
  },
})
export class MainComponent {
  mobileMenuVisible = signal(false);
  sampleAppsSidebarNavs = SIDEBAR_NAV_ITEMS;

  toggleMobileMenu() {
    this.mobileMenuVisible.update(visible => !visible);
  }

  closeMobileMenu() {
    this.mobileMenuVisible.set(false);
  }

  onNavItemClick(navItem: SidebarNavItem) {
    if (navItem.children && !navItem.selectable) {
      navItem.expanded = !navItem.expanded;
      // Collapse other expanded items (accordion behavior)
      this.sampleAppsSidebarNavs.forEach(item => {
        if (item !== navItem && item.children) {
          item.expanded = false;
        }
      });
    } else if (navItem.selectable) {
      this.closeMobileMenu();
    }
  }
}