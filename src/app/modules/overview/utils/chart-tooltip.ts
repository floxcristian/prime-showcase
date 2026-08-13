import type { CanvasFontSpec, Chart, TooltipItem, TooltipModel } from 'chart.js';

/**
 * Tooltip custom (external) para el chart de barras del overview.
 *
 * Chart.js dibuja el tooltip fuera del árbol Angular, así que el markup se
 * construye imperativamente con DOM APIs — mismo precedente que
 * `layouts/side-menu/utils/stats-charts-builder.ts`: la lógica vive en un
 * util DOM-only, testeable y separado del componente.
 *
 * EXCEPCIÓN DOCUMENTADA AL DESIGN SYSTEM (DESIGN.md → "Elevation & Depth"):
 * el `shadow-[...]` de abajo es la única sombra permitida del proyecto. El
 * tooltip no hereda el vocabulario de design tokens y la elevación no se
 * puede expresar con `border border-surface` (rompería el layout). ESLint no
 * la detecta porque vive en strings TS, fuera del scope del visitor HTML.
 */

/** Busca (o crea, en el primer hover) el contenedor del tooltip. */
function getOrCreateTooltipEl(chart: Chart): HTMLDivElement {
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
      'transition-opacity',
      'duration-[0.1s]',
      'pointer-events-none',
      'shadow-[0px_25px_20px_-5px_rgba(0,0,0,0.10),0px_10px_8px_-6px_rgba(0,0,0,0.10)]'
    );
    parentNode.appendChild(tooltipEl);
  }

  return tooltipEl;
}

/** Reconstruye las filas (dot + label + valor) del cuerpo del tooltip. */
function renderTooltipBody(
  tooltipEl: HTMLDivElement,
  tooltip: TooltipModel<'bar'>
): void {
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
  // Copia antes de invertir: el callback corre en cada hover y un
  // `.reverse()` in-place mutaría la estructura interna de Chart.js.
  [...tooltip.dataPoints].reverse().forEach((item: TooltipItem<'bar'>) => {
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

/**
 * Handler para `plugins.tooltip.external` del chart de barras apiladas.
 * Construye/actualiza el tooltip DOM y lo posiciona junto al grupo de
 * barras, clampeado a los bordes del canvas.
 */
export function externalTooltipHandler(context: {
  chart: Chart;
  tooltip: TooltipModel<'bar'>;
}): void {
  const { chart, tooltip } = context;
  const tooltipEl = getOrCreateTooltipEl(chart);

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
    renderTooltipBody(tooltipEl, tooltip);
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
}
