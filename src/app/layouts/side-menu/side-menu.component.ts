// Angular
import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
// PrimeNG
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { DividerModule } from 'primeng/divider';
import { DrawerModule } from 'primeng/drawer';
import { OverlayBadgeModule } from 'primeng/overlaybadge';
import { SelectButton } from 'primeng/selectbutton';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TooltipModule } from 'primeng/tooltip';
// Models
import { SidebarNavItem } from './models/sidebar-nav-item.interface';
import type {
  CallLog,
  EmailRecord,
  PreferenceGroup,
  Opportunity,
} from './models/settings-drawer.interface';
// Constants
import { SIDEBAR_NAV_ITEMS } from './constants/sidebar-nav-items';
import {
  CALL_LOGS,
  EMAIL_RECORDS,
  PREFERENCES,
  OPPORTUNITIES,
} from './constants/settings-drawer-data';

const NG_MODULES = [RouterModule, NgClass, FormsModule];
const PRIME_MODULES = [
  AvatarModule,
  ButtonModule,
  DividerModule,
  DrawerModule,
  OverlayBadgeModule,
  SelectButton,
  ToggleSwitchModule,
  TooltipModule,
];

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
export class SideMenuComponent implements OnInit {
  isSlimMenu: boolean = true;
  sampleAppsSidebarNavs: SidebarNavItem[] = SIDEBAR_NAV_ITEMS;
  selectedSampleAppsSidebarNav: string = '';
  sampleAppsSidebarNavsMore: { icon: string; title: string }[] = [];

  // Drawer
  dashboardSidebarVisible: boolean = false;
  selectedSidebarOption: string = 'Estadísticas';
  sidebarOptions: string[] = [
    'Registros',
    'Preferencias',
    'Estadísticas',
    'Oportunidades',
  ];

  // Drawer data
  callLogs: CallLog[] = CALL_LOGS;
  emailRecords: EmailRecord[] = EMAIL_RECORDS;
  preferences: PreferenceGroup[] = PREFERENCES;
  opportunities: Opportunity[] = OPPORTUNITIES;

  ngOnInit(): void {
    this.selectedSampleAppsSidebarNav = 'Resumen';
    this.sampleAppsSidebarNavsMore = [
      { icon: 'pi pi-cog', title: 'Configuración' },
    ];
  }
}
