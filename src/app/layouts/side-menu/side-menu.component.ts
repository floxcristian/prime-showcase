// Angular
import { NgClass } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  signal,
  viewChild,
} from '@angular/core';
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
  PreferenceItem,
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
export class SideMenuComponent {
  isSlimMenu = signal(true);
  sampleAppsSidebarNavs: SidebarNavItem[] = SIDEBAR_NAV_ITEMS;
  selectedSampleAppsSidebarNav = signal('Resumen');
  sampleAppsSidebarNavsMore: { icon: string; title: string }[] = [
    { icon: 'fa-sharp fa-regular fa-gear', title: 'Configuración' },
  ];

  // Drawer
  dashboardSidebarVisible = signal(false);
  selectedSidebarOption = signal('Estadísticas');
  sidebarOptions: string[] = [
    'Registros',
    'Preferencias',
    'Estadísticas',
    'Oportunidades',
  ];

  // Focus management refs
  private settingsTriggerRef =
    viewChild<ElementRef<HTMLButtonElement>>('settingsTrigger');
  private drawerCloseRef = viewChild('drawerCloseBtn', { read: ElementRef });

  private focusElement(ref: ElementRef<HTMLElement> | undefined): void {
    const host = ref?.nativeElement;
    if (!host) return;
    const focusable = host.matches('button, [tabindex]')
      ? host
      : host.querySelector<HTMLElement>('button, [tabindex]');
    focusable?.focus();
  }

  // Drawer data
  callLogs: CallLog[] = CALL_LOGS;
  emailRecords: EmailRecord[] = EMAIL_RECORDS;
  preferences = signal<PreferenceGroup[]>(PREFERENCES);
  opportunities: Opportunity[] = OPPORTUNITIES;

  onDrawerShow(): void {
    queueMicrotask(() => this.focusElement(this.drawerCloseRef()));
  }

  onDrawerHide(): void {
    queueMicrotask(() => this.focusElement(this.settingsTriggerRef()));
  }

  togglePreference(pref: PreferenceItem): void {
    this.preferences.update(groups =>
      groups.map(group => ({
        ...group,
        prefs: group.prefs.map(item =>
          item === pref ? { ...item, checked: !item.checked } : item
        ),
      }))
    );
  }
}
