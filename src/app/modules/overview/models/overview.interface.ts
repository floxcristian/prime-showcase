export interface TransactionName {
  text: string;
  label: string;
  color: string;
}

export interface TransactionProcess {
  type: 'success' | 'danger';
  value: 'Compra' | 'Venta';
}

export type CoinKind = 'btc' | 'eth';

export interface Transaction {
  id: string;
  name: TransactionName;
  coin: CoinKind;
  date: string;
  process: TransactionProcess;
  amount: string;
}

export interface CoinBadge {
  label: string;
  icon: string;
  classes: string;
}

export interface MeterItem {
  label: string;
  color: string;
  value: number;
  text: string;
}

import type { ChartData } from 'chart.js';

// Chart.js's own typing — handles every valid dataset field for bar charts
// (backgroundColor, hoverBackgroundColor, barThickness, borderRadius,
// borderSkipped, etc.) without maintaining a parallel local shape that drifts
// from the library's API.
export type OverviewChartData = ChartData<'bar', number[]>;

// Rango temporal del filtro del chart. Union cerrada: tipa el signal, el
// selectbutton y el Record de datasets — una rama nueva obliga a agregar
// datos (error de compilación) en vez de devolver undefined silencioso.
export type TimeRange = 'Semanal' | 'Mensual' | 'Anual';

export interface ChartDatasetResult {
  labels: string[];
  // Tupla de 3 series: [personal, corporativa, inversión].
  data: [number[], number[], number[]];
}
