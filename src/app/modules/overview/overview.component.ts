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
import { ChartModule } from 'primeng/chart';
import { DatePickerModule } from 'primeng/datepicker';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { MenuModule } from 'primeng/menu';
import { MeterGroupModule } from 'primeng/metergroup';
import { OverlayBadgeModule } from 'primeng/overlaybadge';
import { SelectButton } from 'primeng/selectbutton';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import type { CanvasFontSpec, Chart, TooltipModel, TooltipItem } from 'chart.js';
import { AppConfigService } from '../../core/services/app-config/app-config.service';
import { CoinBadge, CoinKind, Transaction, MeterItem, OverviewChartData, ChartDatasetResult } from './models/overview.interface';
import {
  COIN_BADGES,
  OVERVIEW_MENU_ITEMS,
  OVERVIEW_TRANSACTIONS,
  OVERVIEW_METERS,
} from './constants/overview-data';

const NG_MODULES = [FormsModule, NgClass];
const PRIME_MODULES = [
  ChartModule,
  SelectButton,
  AvatarModule,
  TooltipModule,
  IconField,
  InputIcon,
  ButtonModule,
  TableModule,
  MeterGroupModule,
  InputTextModule,
  MenuModule,
  Tag,
  OverlayBadgeModule,
  DatePickerModule,
];

@Component({
  selector: 'app-overview',
  imports: [NG_MODULES, PRIME_MODULES],
  templateUrl: './overview.component.html',
  styleUrl: './overview.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'flex-1 h-full overflow-y-auto pb-0.5',
  },
})
export class OverviewComponent {
  chartData = signal<OverviewChartData | undefined>(undefined);
  chartOptions = signal<Record<string, unknown> | undefined>(undefined);
  dates = signal<Date[]>([]);
  selectedTime = signal('Mensual');
  timeOptions: string[] = ['Semanal', 'Mensual', 'Anual'];
  menuItems: MenuItem[] = OVERVIEW_MENU_ITEMS;
  sampleAppsTableDatas: Transaction[] = OVERVIEW_TRANSACTIONS;
  metersData: MeterItem[] = OVERVIEW_METERS;
  coinBadges: Record<CoinKind, CoinBadge> = COIN_BADGES;

  getCoinBadge(coin: string): CoinBadge {
    return this.coinBadges[coin as CoinKind];
  }
  tableTokens = {
    header: {
      background: 'transparent',
    },
    headerCell: {
      background: 'transparent',
    },
    row: {
      background: 'transparent',
    },
  };

  // Dependencies
  private platformId = inject(PLATFORM_ID);
  private configService = inject(AppConfigService);

  themeEffect = effect(() => {
    this.configService.transitionComplete();
    // Use untracked to avoid re-running this effect when selectedTime changes.
    // Theme changes rebuild the chart; time selection changes are handled by changeSelect().
    untracked(() => this.initChart());
  });

  initChart(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.chartData.set(this.setChartData(this.selectedTime()));
      this.chartOptions.set(this.setChartOptions());
    }
  }

  setChartData(timeUnit: string): OverviewChartData {
    const datasets = this.createDatasets(timeUnit);
    const documentStyle = getComputedStyle(document.documentElement);
    const primary200 = documentStyle.getPropertyValue('--p-primary-200');
    const primary300 = documentStyle.getPropertyValue('--p-primary-300');
    const primary400 = documentStyle.getPropertyValue('--p-primary-400');
    const primary500 = documentStyle.getPropertyValue('--p-primary-500');
    const primary600 = documentStyle.getPropertyValue('--p-primary-600');
    return {
      labels: datasets.labels,
      datasets: [
        {
          type: 'bar',
          label: 'Billetera Personal',
          backgroundColor: primary400,
          hoverBackgroundColor: primary600,
          data: (datasets.data ?? [])[0] ?? [],
          barThickness: 32,
        },
        {
          type: 'bar',
          label: 'Billetera Corporativa',
          backgroundColor: primary300,
          hoverBackgroundColor: primary500,
          data: (datasets.data ?? [])[1] ?? [],
          barThickness: 32,
        },
        {
          type: 'bar',
          label: 'Billetera de Inversión',
          backgroundColor: primary200,
          hoverBackgroundColor: primary400,
          data: (datasets.data ?? [])[2] ?? [],
          borderRadius: {
            topLeft: 8,
            topRight: 8,
          },
          borderSkipped: false,
          barThickness: 32,
        },
      ],
    };
  }

  setChartOptions(): Record<string, unknown> {
    const { darkTheme } = this.configService.appState();
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
          external: function (context: { chart: Chart; tooltip: TooltipModel<'bar'> }) {
            const { chart, tooltip } = context;
            const parentNode = chart.canvas.parentNode as HTMLElement;
            let tooltipEl = parentNode.querySelector<HTMLDivElement>(
              'div.chartjs-tooltip'
            );

            if (!tooltipEl) {
              tooltipEl = document.createElement('div');
              tooltipEl.classList.add(
                'chartjs-tooltip',
                'dark:bg-surface-950',
                'bg-surface-0',
                'p-3',
                'rounded-lg',
                'overflow-hidden',
                'opacity-100',
                'absolute',
                'transition-all',
                'duration-[0.1s]',
                'pointer-events-none',
                'shadow-[0px_25px_20px_-5px_rgba(0,0,0,0.10),0px_10px_8px_-6px_rgba(0,0,0,0.10)]'
              );
              parentNode.appendChild(tooltipEl);
            }

            if (tooltip.opacity === 0) {
              tooltipEl.style.opacity = '0';

              return;
            }

            const datasetPointsX = tooltip.dataPoints.map(
              (dp: TooltipItem<'bar'>) => dp.element.x
            );
            const avgX =
              datasetPointsX.reduce((a: number, b: number) => a + b, 0) /
              datasetPointsX.length;
            const avgY = tooltip.dataPoints[0].element.y;

            if (tooltip.body) {
              tooltipEl.innerHTML = '';
              const tooltipBody = document.createElement('div');

              tooltipBody.classList.add(
                'flex',
                'flex-col',
                'gap-4',
                'px-3',
                'py-3',
                'min-w-[18rem]'
              );
              tooltip.dataPoints.reverse().forEach((item: TooltipItem<'bar'>) => {
                const row = document.createElement('div');

                row.classList.add('flex', 'items-center', 'gap-2', 'w-full');
                const point = document.createElement('div');

                point.classList.add('w-2.5', 'h-2.5', 'rounded-full');
                point.style.backgroundColor = item.dataset.backgroundColor as string;
                row.appendChild(point);
                const label = document.createElement('span');

                label.appendChild(document.createTextNode(item.dataset.label as string));
                label.classList.add(
                  'text-base',
                  'font-medium',
                  'text-color',
                  'flex-1',
                  'text-left',
                  'capitalize'
                );
                row.appendChild(label);
                const value = document.createElement('span');

                value.appendChild(document.createTextNode(item.formattedValue));
                value.classList.add(
                  'text-base',
                  'font-medium',
                  'text-color',
                  'text-right'
                );
                row.appendChild(value);
                tooltipBody.appendChild(row);
              });
              tooltipEl.appendChild(tooltipBody);
            }

            const { offsetLeft: positionX } = chart.canvas;

            tooltipEl.style.opacity = '1';
            tooltipEl.style.font = (tooltip.options.bodyFont as CanvasFontSpec).string;
            tooltipEl.style.padding = '0';
            const chartWidth = chart.width;
            const tooltipWidth = tooltipEl.offsetWidth;
            const chartHeight = chart.height;
            const tooltipHeight = tooltipEl.offsetHeight;

            let tooltipX = positionX + avgX + 24;
            let tooltipY = avgY;

            if (tooltipX + tooltipWidth > chartWidth) {
              tooltipX = positionX + avgX - tooltipWidth - 20;
            }

            if (tooltipY < 0) {
              tooltipY = 0;
            } else if (tooltipY + tooltipHeight > chartHeight) {
              tooltipY = chartHeight - tooltipHeight;
            }

            tooltipEl.style.left = tooltipX + 'px';
            tooltipEl.style.top = tooltipY + 'px';
          },
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
            borderColor: 'transparent',
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
            borderColor: 'transparent',
          },
          border: {
            display: false,
          },
        },
      },
    };
  }

  createDatasets(val: string): ChartDatasetResult {
    let data: number[][] | undefined;
    let labels: string[] | undefined;

    if (val === 'Semanal') {
      labels = [
        '6 May',
        '13 May',
        '20 May',
        '27 May',
        '3 Jun',
        '10 Jun',
        '17 Jun',
        '24 Jun',
        '1 Jul',
        '8 Jul',
        '15 Jul',
        '22 Jul',
      ];
      data = [
        [
          9000, 3000, 13000, 3000, 5000, 17000, 11000, 4000, 15000, 4000, 11000,
          5000,
        ],
        [
          1800, 7600, 11100, 6800, 3300, 5800, 3600, 7200, 4300, 8100, 6800,
          3700,
        ],
        [
          3800, 4800, 2100, 6600, 1000, 3800, 6500, 4200, 4300, 7000, 6800,
          3700,
        ],
      ];
    } else if (val === 'Mensual') {
      labels = [
        'Ene',
        'Feb',
        'Mar',
        'Abr',
        'May',
        'Jun',
        'Jul',
        'Ago',
        'Sep',
        'Oct',
        'Nov',
        'Dic',
      ];
      data = [
        [
          4000, 10000, 15000, 4000, 16000, 8000, 12000, 14000, 17000, 5000,
          12000, 6000,
        ],
        [
          2100, 8400, 2400, 7500, 3700, 6500, 7400, 8000, 4800, 9000, 7600,
          4200,
        ],
        [
          4100, 5200, 2400, 7400, 2300, 4100, 7200, 8000, 4800, 9000, 7600,
          4200,
        ],
      ];
    } else if (val === 'Anual') {
      labels = ['2019', '2020', '2021', '2022', '2023', '2024'];
      data = [
        [
          4500, 10500, 15500, 4500, 16500, 8500, 12500, 14500, 17500, 5500,
          12500, 6500,
        ],
        [
          2250, 8700, 2550, 7650, 3850, 6650, 7650, 8250, 4950, 9250, 7850,
          4450,
        ],
        [
          4350, 5450, 2650, 7650, 2550, 4350, 7450, 8250, 4950, 9250, 7850,
          4450,
        ],
      ];
    }

    return {
      data,
      labels,
    };
  }

  changeSelect(): void {
    this.chartData.set(this.setChartData(this.selectedTime()));
    this.chartOptions.set(this.setChartOptions());
  }
}
