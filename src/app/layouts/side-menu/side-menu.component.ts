import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TooltipModule } from 'primeng/tooltip';
import { DividerModule } from 'primeng/divider';
import { AvatarModule } from 'primeng/avatar';
import { SIDEBAR_NAV_ITEMS, SIDEBAR_NAV_ITEMS_MORE } from './constants/sidebar-nav-items';
import { SidebarNavItem } from './models/sidebar-nav-item.interface';

@Component({
  selector: 'app-side-menu',
  imports: [CommonModule, RouterModule, TooltipModule, DividerModule, AvatarModule],
  templateUrl: './side-menu.component.html',
  styleUrl: './side-menu.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SideMenuComponent {
  @Input() isMobile = false;
  @Output() menuItemClick = new EventEmitter<void>();

  isSlimMenu = signal(false);
  sampleAppsSidebarNavs = SIDEBAR_NAV_ITEMS;
  sampleAppsSidebarNavsMore = SIDEBAR_NAV_ITEMS_MORE;

  toggleSlimMode() {
    this.isSlimMenu.update(slim => !slim);
    // Collapse all expanded items when switching to slim mode
    if (this.isSlimMenu()) {
      this.collapseAllItems();
    }
  }

  onNavItemClick(navItem: SidebarNavItem) {
    // If item has children and is not selectable, toggle expansion
    if (navItem.children && !navItem.selectable) {
      // Don't expand/collapse in slim mode on desktop
      if (!this.isSlimMenu() || this.isMobile) {
        navItem.expanded = !navItem.expanded;
        // Collapse other expanded items (accordion behavior)
        this.sampleAppsSidebarNavs.forEach(item => {
          if (item !== navItem && item.children) {
            item.expanded = false;
          }
        });
      }
    } else if (navItem.selectable) {
      // If item is selectable, emit menu item click
      this.onMenuItemClick();
    }
  }

  onMenuItemClick() {
    this.menuItemClick.emit();
  }

  onSettingsClick(title: string) {
    console.log('Settings clicked:', title);
    this.menuItemClick.emit();
  }

  private collapseAllItems() {
    this.sampleAppsSidebarNavs.forEach(item => {
      if (item.children) {
        item.expanded = false;
      }
    });
  }
}