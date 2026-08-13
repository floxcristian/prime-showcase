import { ChartDatasetResult, TimeRange } from '../models/overview.interface';

// Series del chart de barras apiladas del overview, por rango temporal.
// Cada entrada trae sus labels y la tupla de 3 series (personal,
// corporativa, inversión). El Record cerrado sobre TimeRange garantiza en
// compilación que toda opción del selectbutton tiene datos.
export const OVERVIEW_CHART_SERIES: Record<TimeRange, ChartDatasetResult> = {
  Semanal: {
    labels: [
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
    ],
    data: [
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
    ],
  },
  Mensual: {
    labels: [
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
    ],
    data: [
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
    ],
  },
  Anual: {
    labels: ['2019', '2020', '2021', '2022', '2023', '2024'],
    data: [
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
    ],
  },
};
