//Angular
import { isPlatformBrowser, NgClass, NgStyle } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  effect,
  inject,
  OnInit,
  PLATFORM_ID,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
// PrimeNG
import { MenuItem } from 'primeng/api';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { ChartModule } from 'primeng/chart';
import { DatePickerModule } from 'primeng/datepicker';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { MenuModule } from 'primeng/menu';
import { MeterGroupModule } from 'primeng/metergroup';
import { OverlayBadgeModule } from 'primeng/overlaybadge';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import type { CanvasFontSpec, Chart, TooltipModel, TooltipItem } from 'chart.js';
import { AppConfigService } from '../../core/services/app-config/app-config.service';
import { Transaction, MeterItem, OverviewChartData, ChartDatasetResult } from './models/overview.interface';

const NG_MODULES = [RouterModule, FormsModule, NgClass, NgStyle];
const PRIME_MODULES = [
  ChartModule,
  SelectButtonModule,
  AvatarModule,
  TooltipModule,
  IconFieldModule,
  InputIconModule,
  ButtonModule,
  TableModule,
  MeterGroupModule,
  InputTextModule,
  MenuModule,
  TagModule,
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
export class OverviewComponent implements OnInit {
  chartData: OverviewChartData | undefined;
  chartOptions: Record<string, unknown> | undefined;
  dates: Date[] | undefined = [];
  selectedTime: string = 'Mensual';
  timeOptions: string[] = ['Semanal', 'Mensual', 'Anual'];
  menuItems: MenuItem[] | undefined;
  sampleAppsTableDatas: Transaction[] = [];
  metersData: MeterItem[] = [];
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
  private cd = inject(ChangeDetectorRef);
  private configService = inject(AppConfigService);

  themeEffect = effect(() => {
    if (this.configService.transitionComplete()) {
      this.initChart();
    }
  });

  ngOnInit() {
    this.menuItems = [
      {
        label: 'Actualizar',
        icon: 'pi pi-refresh',
      },
      {
        label: 'Exportar',
        icon: 'pi pi-upload',
      },
    ];

    this.sampleAppsTableDatas = [
      {
        id: '#1254',
        name: { text: 'Amy Yelsner', label: 'AY', color: 'blue' },
        coin: 'btc',
        date: '5 May',
        process: { type: 'success', value: 'Compra' },
        amount: '3.005 BTC',
      },
      {
        id: '#2355',
        name: { text: 'Anna Fali', label: 'AF', color: '#ECFCCB' },
        coin: 'eth',
        date: '17 Mar',
        process: { type: 'success', value: 'Compra' },
        amount: '0.050 ETH',
      },
      {
        id: '#1235',
        name: { text: 'Stepen Shaw', label: 'SS', color: '#ECFCCB' },
        coin: 'btc',
        date: '24 May',
        process: { type: 'danger', value: 'Venta' },
        amount: '3.050 BTC',
      },
      {
        id: '#2355',
        name: { text: 'Anna Fali', label: 'AF', color: '#ECFCCB' },
        coin: 'eth',
        date: '17 Mar',
        process: { type: 'danger', value: 'Venta' },
        amount: '0.050 ETH',
      },
      {
        id: '#2355',
        name: { text: 'Anna Fali', label: 'AF', color: '#ECFCCB' },
        coin: 'eth',
        date: '17 Mar',
        process: { type: 'danger', value: 'Venta' },
        amount: '0.050 ETH',
      },
      {
        id: '#7896',
        name: { text: 'John Doe', label: 'JD', color: 'green' },
        coin: 'btc',
        date: '12 Jun',
        process: { type: 'success', value: 'Compra' },
        amount: '2.500 BTC',
      },
      {
        id: '#5648',
        name: { text: 'Jane Smith', label: 'JS', color: '#FFDDC1' },
        coin: 'eth',
        date: '23 Feb',
        process: { type: 'success', value: 'Compra' },
        amount: '1.200 ETH',
      },
      {
        id: '#3265',
        name: { text: 'Michael Johnson', label: 'MJ', color: '#FFD700' },
        coin: 'btc',
        date: '30 Abr',
        process: { type: 'danger', value: 'Venta' },
        amount: '4.000 BTC',
      },
      {
        id: '#1423',
        name: { text: 'Emily Davis', label: 'ED', color: '#FFCCCB' },
        coin: 'btc',
        date: '15 Ene',
        process: { type: 'danger', value: 'Venta' },
        amount: '5.050 LTC',
      },
      {
        id: '#6854',
        name: { text: 'Robert Brown', label: 'RB', color: '#C0C0C0' },
        coin: 'eth',
        date: '2 Dic',
        process: { type: 'success', value: 'Compra' },
        amount: '0.300 ETH',
      },
    ];

    this.metersData = [
      { label: 'BTC', color: '#F59E0B', value: 15, text: '27.215' },
      { label: 'ETH', color: '#717179', value: 5, text: '4.367' },
      { label: 'GBP', color: '#22C55E', value: 25, text: '£ 147.562,32' },
      { label: 'EUR', color: '#84CC16', value: 11, text: '€ 137.457,25' },
      { label: 'USD', color: '#14B8A6', value: 29, text: '$ 133.364,12' },
      { label: 'XAU', color: '#EAB308', value: 29, text: '200 g' },
    ];

    this.initChart();
  }

  initChart(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.chartData = this.setChartData(this.selectedTime);
      this.chartOptions = this.setChartOptions();
      this.cd.markForCheck();
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
                'rounded-[8px]',
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
    this.chartData = this.setChartData(this.selectedTime);
    this.chartOptions = this.setChartOptions();
  }
}
