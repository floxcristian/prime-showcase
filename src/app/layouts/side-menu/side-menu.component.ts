// Angular
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
// PrimeNG
import { TooltipModule } from 'primeng/tooltip';
import { DividerModule } from 'primeng/divider';
import { AvatarModule } from 'primeng/avatar';
// Models
import { SidebarNavItem } from './models/sidebar-nav-item.interface';
// Constants
import { SIDEBAR_NAV_ITEMS } from './constants/sidebar-nav-items';

const NG_MODULES = [CommonModule, RouterModule];
const PRIME_MODULES = [TooltipModule, DividerModule, AvatarModule];

@Component({
  selector: 'app-side-menu',
  imports: [NG_MODULES, PRIME_MODULES],
  templateUrl: './side-menu.component.html',
  styleUrl: './side-menu.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'h-full',
  },
})
export class SideMenuComponent {
  @Input() isMobile: boolean = false;
  @Output() menuItemClick = new EventEmitter<void>();

  isSlimMenu = signal(false);
  sampleAppsSidebarNavs: SidebarNavItem[] = SIDEBAR_NAV_ITEMS;
  selectedSampleAppsSidebarNav: string = '';
  sampleAppsSidebarNavsMore: { icon: string; title: string }[] = [];

  ngOnInit(): void {
    this.selectedSampleAppsSidebarNav = 'Overview';
    this.sampleAppsSidebarNavsMore = [
      { icon: 'pi pi-cog', title: 'Settings' },
      { icon: 'pi pi-question-circle', title: 'Help' }
    ];
  }

  toggleSlimMode(): void {
    this.isSlimMenu.update(slim => !slim);
  }

  onMenuItemClick(): void {
    this.menuItemClick.emit();
  }

  onSettingsClick(title: string): void {
    console.log(`${title} clicked`);
    this.menuItemClick.emit();
  }
}