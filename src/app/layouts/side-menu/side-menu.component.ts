import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TooltipModule } from 'primeng/tooltip';
import { DividerModule } from 'primeng/divider';
import { AvatarModule } from 'primeng/avatar';
import { SIDEBAR_NAV_ITEMS, SIDEBAR_NAV_ITEMS_MORE } from './constants/sidebar-nav-items';

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
  }

  onMenuItemClick() {
    this.menuItemClick.emit();
  }

  onSettingsClick(title: string) {
    console.log('Settings clicked:', title);
  }
}