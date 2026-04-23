// Angular
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  Injector,
  inject,
  model,
  output,
  PLATFORM_ID,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
// PrimeNG
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { ChartModule } from 'primeng/chart';
import { DrawerModule } from 'primeng/drawer';
import { OverlayBadgeModule } from 'primeng/overlaybadge';
import { SelectButton } from 'primeng/selectbutton';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TooltipModule } from 'primeng/tooltip';
// App
import { AppConfigService } from '../../../core/services/app-config/app-config.service';
import { PrimaryTitleToolbarComponent } from '../../primary-title-toolbar/primary-title-toolbar.component';
// Models
import type {
  CallLog,
  EmailRecord,
  PreferenceGroup,
  PreferenceItem,
  Opportunity,
} from '../models/settings-drawer.interface';
// Constants
import {
  CALL_LOGS,
  EMAIL_RECORDS,
  PREFERENCES,
  OPPORTUNITIES,
} from '../constants/settings-drawer-data';
import { STATS_CHARTS } from '../constants/stats-charts-data';
// Utils
import {
  buildStatsChartsConfigs,
  type StatsChartsConfigs,
} from '../utils/stats-charts-builder';
import { resolveStatsPalette } from '../utils/stats-palette';

const NG_MODULES = [FormsModule];
const PRIME_MODULES = [
  AvatarModule,
  ButtonModule,
  ChartModule,
  DrawerModule,
  OverlayBadgeModule,
  SelectButton,
  ToggleSwitchModule,
  TooltipModule,
];

@Component({
  selector: 'app-settings-drawer',
  imports: [NG_MODULES, PRIME_MODULES, PrimaryTitleToolbarComponent],
  templateUrl: './settings-drawer.component.html',
  styleUrl: './settings-drawer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // `display: contents` hace el host transparente al layout del padre. El
  // p-drawer real se mueve a <body> vía appendTo="body", así que este host
  // tag no debería contribuir al flujo. Sin esto, cuando el @defer del
  // toolbar resuelve (on interaction del avatar), el host aparece como
  // nuevo flex-child → añade un gap-3 (12px) entre los bloques del toolbar
  // → center + right shrinken 4px y avatar shifts 12px izquierda.
  host: { class: 'contents' },
})
export class SettingsDrawerComponent {
  // Two-way with parent — drawer open state.
  visible = model.required<boolean>();

  // Emitted after the drawer closes so the parent can restore focus to the
  // trigger button (the child has no handle on it). Ref: ADR-001 §7.
  hidden = output<void>();

  selectedSidebarOption = signal('Estadísticas');
  sidebarOptions: string[] = [
    'Registros',
    'Preferencias',
    'Estadísticas',
    'Oportunidades',
  ];

  callLogs: CallLog[] = CALL_LOGS;
  emailRecords: EmailRecord[] = EMAIL_RECORDS;
  preferences = signal<PreferenceGroup[]>(PREFERENCES);
  opportunities: Opportunity[] = OPPORTUNITIES;

  // Stats charts — rebuilt on dark-mode toggle so primary/surface tokens
  // resolve against the theme that is actually painted post-transition.
  charts = signal<StatsChartsConfigs | undefined>(undefined);

  // Corrige el role del drawer: PrimeNG emite role="complementary" en el root,
  // pero este panel es modal y el trigger anuncia aria-haspopup="dialog".
  // Ref: WAI-ARIA APG — dialog pattern requires role=dialog + aria-modal.
  readonly drawerPt = {
    root: {
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': 'Mi cuenta',
    },
  };

  private injector = inject(Injector);
  private document = inject(DOCUMENT);
  private platformId = inject(PLATFORM_ID);
  private configService = inject(AppConfigService);
  private drawerCloseRef = viewChild('drawerCloseBtn', { read: ElementRef });

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
    afterNextRender(
      () => {
        this.drawerCloseRef()?.nativeElement.querySelector('button')?.focus();
      },
      { injector: this.injector },
    );
  }

  onDrawerHide(): void {
    this.hidden.emit();
  }

  close(): void {
    this.visible.set(false);
  }

  togglePreference(pref: PreferenceItem): void {
    this.preferences.update((groups) =>
      groups.map((group) => ({
        ...group,
        prefs: group.prefs.map((item) =>
          item === pref ? { ...item, checked: !item.checked } : item,
        ),
      })),
    );
  }
}
