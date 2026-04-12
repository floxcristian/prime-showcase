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

export interface ChartDataset {
  type: 'bar';
  label: string;
  backgroundColor: string;
  hoverBackgroundColor: string;
  data: number[];
  barThickness: number;
  borderRadius?: { topLeft: number; topRight: number };
  borderSkipped?: boolean;
}

export interface OverviewChartData {
  labels?: string[];
  datasets: ChartDataset[];
}

export interface ChartDatasetResult {
  labels: string[] | undefined;
  data: number[][] | undefined;
}
