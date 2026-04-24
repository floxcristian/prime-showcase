import { MenuItem } from 'primeng/api';
import { CoinBadge, CoinKind, Transaction, MeterItem } from '../models/overview.interface';

export const COIN_BADGES: Record<CoinKind, CoinBadge> = {
  btc: {
    label: 'Bitcoin',
    icon: 'fa-brands fa-bitcoin',
    classes: 'bg-yellow-500 text-surface-0',
  },
  eth: {
    label: 'Ethereum',
    icon: 'fa-brands fa-ethereum',
    classes: 'bg-surface-950 text-surface-0 dark:bg-surface-0 dark:text-surface-950',
  },
};

export const OVERVIEW_MENU_ITEMS: MenuItem[] = [
  {
    label: 'Actualizar',
    icon: 'fa-sharp fa-regular fa-arrows-rotate',
  },
  {
    label: 'Exportar',
    icon: 'fa-sharp fa-regular fa-upload',
  },
];

export const OVERVIEW_TRANSACTIONS: Transaction[] = [
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
    id: '#2418',
    name: { text: 'Anna Fali', label: 'AF', color: '#ECFCCB' },
    coin: 'eth',
    date: '22 Mar',
    process: { type: 'danger', value: 'Venta' },
    amount: '0.050 ETH',
  },
  {
    id: '#2503',
    name: { text: 'Anna Fali', label: 'AF', color: '#ECFCCB' },
    coin: 'eth',
    date: '28 Mar',
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
    amount: '5.050 BTC',
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

export const OVERVIEW_METERS: MeterItem[] = [
  { label: 'BTC', color: '#F59E0B', value: 15, text: '27.215' },
  { label: 'ETH', color: '#717179', value: 5, text: '4.367' },
  { label: 'GBP', color: '#22C55E', value: 25, text: '£ 147.562,32' },
  { label: 'EUR', color: '#84CC16', value: 11, text: '€ 137.457,25' },
  { label: 'USD', color: '#14B8A6', value: 29, text: '$ 133.364,12' },
  { label: 'XAU', color: '#EAB308', value: 29, text: '200 g' },
];
