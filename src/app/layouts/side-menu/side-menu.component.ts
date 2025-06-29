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

  isExpanded = signal(false);
  hoveredItem: string | null = null;
  sampleAppsSidebarNavs = SIDEBAR_NAV_ITEMS;
  sampleAppsSidebarNavsMore = SIDEBAR_NAV_ITEMS_MORE;

  onMouseEnter() {
    if (!this.isMobile) {
      this.isExpanded.set(true);
    }
  }

  onMouseLeave() {
    if (!this.isMobile) {
      this.isExpanded.set(false);
      this.hoveredItem = null;
      // Collapse all expanded items when leaving
      this.collapseAllItems();
    }
  }

  onNavItemClick(navItem: SidebarNavItem) {
    // If item has children and is not selectable
    if (navItem.children && !navItem.selectable) {
      // In expanded mode or mobile, toggle expansion
      if (this.isExpanded() || this.isMobile) {
        navItem.expanded = !navItem.expanded;
        // Collapse other expanded items (accordion behavior)
        this.sampleAppsSidebarNavs.forEach(item => {
          if (item !== navItem && item.children) {
            item.expanded = false;
          }
        });
      } else {
        // In collapsed mode, show hover menu
        this.hoveredItem = this.hoveredItem === navItem.title ? null : navItem.title;
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