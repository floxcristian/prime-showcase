// Angular
import { DOCUMENT, isPlatformBrowser, NgClass } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  Injector,
  inject,
  PLATFORM_ID,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
// PrimeNG
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { ChartModule } from 'primeng/chart';
import { DividerModule } from 'primeng/divider';
import { DrawerModule } from 'primeng/drawer';
import { OverlayBadgeModule } from 'primeng/overlaybadge';
import { SelectButton } from 'primeng/selectbutton';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TooltipModule } from 'primeng/tooltip';
// App
import { AppConfigService } from '../../core/services/app-config/app-config.service';
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
import { STATS_CHARTS } from './constants/stats-charts-data';
// Utils
import {
  buildStatsChartsConfigs,
  type StatsChartsConfigs,
} from './utils/stats-charts-builder';
import { resolveStatsPalette } from './utils/stats-palette';

const NG_MODULES = [RouterModule, NgClass, FormsModule];
const PRIME_MODULES = [
  AvatarModule,
  ButtonModule,
  ChartModule,
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

  // Focus management
  private injector = inject(Injector);
  private settingsTriggerRef =
    viewChild<ElementRef<HTMLButtonElement>>('settingsTrigger');
  private drawerCloseRef = viewChild('drawerCloseBtn', { read: ElementRef });

  // Drawer data
  callLogs: CallLog[] = CALL_LOGS;
  emailRecords: EmailRecord[] = EMAIL_RECORDS;
  preferences = signal<PreferenceGroup[]>(PREFERENCES);
  opportunities: Opportunity[] = OPPORTUNITIES;

  // Stats charts — rebuilt on dark-mode toggle so primary/surface tokens
  // resolve against the theme that is actually painted post-transition.
  // A single aggregate signal holds all four chart configs so the template
  // binds one coherent snapshot instead of juggling eight separate signals.
  private document = inject(DOCUMENT);
  private platformId = inject(PLATFORM_ID);
  private configService = inject(AppConfigService);
  charts = signal<StatsChartsConfigs | undefined>(undefined);

  constructor() {
    effect(() => {
      this.configService.themeChanged();
      untracked(() => this.initStatsCharts());
    });
  }

  private initStatsCharts(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const palette = resolveStatsPalette(
      this.document,
      this.configService.darkTheme(),
    );
    this.charts.set(buildStatsChartsConfigs(STATS_CHARTS, palette));
  }

  onDrawerShow(): void {
    afterNextRender(() => {
      this.drawerCloseRef()?.nativeElement.querySelector('button')?.focus();
    }, { injector: this.injector });
  }

  onDrawerHide(): void {
    afterNextRender(() => {
      this.settingsTriggerRef()?.nativeElement.focus();
    }, { injector: this.injector });
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
