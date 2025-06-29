// Angular
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
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
  isSlimMenu: boolean = true;
  sampleAppsSidebarNavs: SidebarNavItem[] = SIDEBAR_NAV_ITEMS;
  selectedSampleAppsSidebarNav: string = '';
  sampleAppsSidebarNavsMore: { icon: string; title: string }[] = [];
  dashboardSidebarVisible: boolean = false;

  ngOnInit(): void {
    this.selectedSampleAppsSidebarNav = 'Overview';
    this.sampleAppsSidebarNavsMore = [{ icon: 'pi pi-cog', title: 'Settings' }];
  }
}
