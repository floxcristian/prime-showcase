//Angular
import { isPlatformBrowser, NgClass } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  PLATFORM_ID,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
// PrimeNG
import { MenuItem } from 'primeng/api';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { MenuModule } from 'primeng/menu';
import { MeterGroupModule } from 'primeng/metergroup';
import { OverlayBadgeModule } from 'primeng/overlaybadge';
import { SelectButton } from 'primeng/selectbutton';
import { Skeleton } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import type { ChartOptions } from 'chart.js';
import { AppConfigService } from '../../core/services/app-config/app-config.service';
import { ChartComponent } from '../../shared/components/chart/chart.component';
import { TRANSPARENT_TABLE_TOKENS } from '../../shared/tokens/table-tokens';
import { CoinBadge, CoinKind, Transaction, MeterItem, OverviewChartData, TimeRange } from './models/overview.interface';
import {
  COIN_BADGES,
  OVERVIEW_MENU_ITEMS,
  OVERVIEW_TRANSACTIONS,
  OVERVIEW_METERS,
} from './constants/overview-data';
import { OVERVIEW_CHART_SERIES } from './constants/overview-chart-data';
import { externalTooltipHandler } from './utils/chart-tooltip';

const NG_MODULES = [FormsModule, NgClass];
const PRIME_MODULES = [
  SelectButton,
  AvatarModule,
  TooltipModule,
  ButtonModule,
  TableModule,
  MeterGroupModule,
  MenuModule,
  Tag,
  OverlayBadgeModule,
  DatePickerModule,
  Skeleton,
];

@Component({
  selector: 'app-overview',
  imports: [NG_MODULES, PRIME_MODULES, ChartComponent],
  templateUrl: './overview.component.html',
  styleUrl: './overview.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'flex-1 flex flex-col pb-0.5',
  },
})
export class OverviewComponent {
  chartData = signal<OverviewChartData | undefined>(undefined);
  chartOptions = signal<ChartOptions<'bar'> | undefined>(undefined);
  dates = signal<Date[]>([]);
  selectedTime = signal<TimeRange>('Mensual');
  timeOptions: TimeRange[] = ['Semanal', 'Mensual', 'Anual'];
  menuItems: MenuItem[] = OVERVIEW_MENU_ITEMS;
  sampleAppsTableDatas: Transaction[] = OVERVIEW_TRANSACTIONS;
  metersData: MeterItem[] = OVERVIEW_METERS;
  coinBadges: Record<CoinKind, CoinBadge> = COIN_BADGES;

  // Single source of truth for the transactions table page size. Drives both
  // the live `[rows]` config and the placeholder skeleton row count so the
  // pre-hydration UI matches the hydrated layout (zero CLS).
  protected readonly transactionsRowsPerPage = 5;
  protected readonly transactionsSkeletonRows = Array.from({
    length: this.transactionsRowsPerPage,
  });

  getCoinBadge(coin: CoinKind): CoinBadge {
    return this.coinBadges[coin];
  }
  readonly tableTokens = TRANSPARENT_TABLE_TOKENS;

  // Dependencies
  private platformId = inject(PLATFORM_ID);
  private configService = inject(AppConfigService);

  constructor() {
    // Rebuild the chart when either the time filter changes or a dark-mode
    // transition completes. `themeChanged` ticks post-View-Transition so CSS
    // custom properties have flipped by the time Chart.js reads them via
    // getComputedStyle.
    //
    // `untracked` is load-bearing: setChartOptions() reads
    // `configService.darkTheme()` internally and we must NOT register that as
    // a dependency — the effect would then fire on toggle BEFORE the
    // transition callback applied `.p-dark`, and Chart.js would pick up the
    // previous theme's colors.
    effect(() => {
      this.selectedTime();
      this.configService.themeChanged();
      untracked(() => this.initChart());
    });
  }

  initChart(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.chartData.set(this.setChartData(this.selectedTime()));
      this.chartOptions.set(this.setChartOptions());
    }
  }

  setChartData(timeUnit: TimeRange): OverviewChartData {
    const { labels, data } = OVERVIEW_CHART_SERIES[timeUnit];
    const documentStyle = getComputedStyle(document.documentElement);
    const primary200 = documentStyle.getPropertyValue('--p-primary-200');
    const primary300 = documentStyle.getPropertyValue('--p-primary-300');
    const primary400 = documentStyle.getPropertyValue('--p-primary-400');
    const primary500 = documentStyle.getPropertyValue('--p-primary-500');
    const primary600 = documentStyle.getPropertyValue('--p-primary-600');
    return {
      labels,
      datasets: [
        {
          type: 'bar',
          label: 'Billetera Personal',
          backgroundColor: primary400,
          hoverBackgroundColor: primary600,
          data: data[0],
          maxBarThickness: 32,
          categoryPercentage: 0.75,
          barPercentage: 0.85,
        },
        {
          type: 'bar',
          label: 'Billetera Corporativa',
          backgroundColor: primary300,
          hoverBackgroundColor: primary500,
          data: data[1],
          maxBarThickness: 32,
          categoryPercentage: 0.75,
          barPercentage: 0.85,
        },
        {
          type: 'bar',
          label: 'Billetera de Inversión',
          backgroundColor: primary200,
          hoverBackgroundColor: primary400,
          data: data[2],
          borderRadius: {
            topLeft: 4,
            topRight: 4,
          },
          borderSkipped: false,
          maxBarThickness: 32,
          categoryPercentage: 0.75,
          barPercentage: 0.85,
        },
      ],
    };
  }

  setChartOptions(): ChartOptions<'bar'> {
    const darkTheme = this.configService.darkTheme();
    const documentStyle = getComputedStyle(document.documentElement);
    const surface100 = documentStyle.getPropertyValue('--p-surface-100');
    const surface900 = documentStyle.getPropertyValue('--p-surface-900');
    const surface400 = documentStyle.getPropertyValue('--p-surface-400');
    const surface500 = documentStyle.getPropertyValue('--p-surface-500');

    return {
      maintainAspectRatio: false,
      aspectRatio: 0.8,
      plugins: {
        tooltip: {
          enabled: false,
          position: 'nearest',
          // Construcción DOM del tooltip extraída a utils/chart-tooltip.ts
          // (precedente: layouts/side-menu/utils/stats-charts-builder.ts).
          external: externalTooltipHandler,
        },
        legend: {
          display: false,
        },
      },
      scales: {
        x: {
          stacked: true,
          ticks: {
            color: darkTheme ? surface500 : surface400,
          },
          grid: {
            display: false,
          },
          border: {
            display: false,
          },
        },
        y: {
          beginAtZero: true,
          stacked: true,
          ticks: {
            color: darkTheme ? surface500 : surface400,
          },
          grid: {
            display: true,
            color: darkTheme ? surface900 : surface100,
          },
          border: {
            display: false,
          },
        },
      },
    };
  }

}
