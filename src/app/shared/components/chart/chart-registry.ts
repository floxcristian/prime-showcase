import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  DoughnutController,
  Filler,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';

/**
 * Registro central de piezas de Chart.js (controllers + elements + scales +
 * plugins) para todo el codebase.
 *
 * Reemplaza al default `chart.js/auto` que mete todo: bar, bubble, doughnut,
 * line, pie, polarArea, radar, scatter + radialLinear, time, timeseries +
 * Legend, Title, Subtitle, Decimation, Colors. En esta app sólo usamos bar,
 * line y doughnut — el resto es bundle muerto.
 *
 * **Savings:** ~25-40 kB gz en el lazy chunk que contiene Chart.js.
 *
 * **Cómo agregar un tipo nuevo:** importar el controller/element/scale/plugin
 * correspondiente y añadirlo a la lista de `Chart.register()`. Si se olvida,
 * Chart.js tira error explícito en runtime ("controller not registered").
 *
 * **Side-effect module:** el archivo se evalúa una sola vez al cargar el
 * primer `import './chart-registry'` — `Chart.register()` es idempotente
 * (interno Map), así que múltiples evals son seguros. Marcado como
 * side-effect via el import en [chart.component.ts](./chart.component.ts) —
 * NO mover a top-level side-effect-less.
 *
 * **¿Por qué no `chart.js/auto` filtrado?** No existe esa API. `chart.js`
 * exporta cada pieza como named-export ES module, esbuild tree-shakea lo no
 * importado. `/auto` es un shim que `Chart.register(...registerables)` donde
 * `registerables` es un array con TODO. Si importamos sólo las piezas que
 * nos sirven + las registramos explícitamente, pagamos sólo por esas.
 *
 * Ref: https://www.chartjs.org/docs/latest/getting-started/integration.html#bundle-optimization
 */
Chart.register(
  // Controllers — tipo de chart
  BarController,
  LineController,
  DoughnutController,
  // Elements — primitivas que los controllers dibujan
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  // Scales — ejes (bar/line usan Category+Linear; doughnut no usa scales)
  CategoryScale,
  LinearScale,
  // Plugins
  Tooltip, // overview.component usa `tooltip.external` custom — requiere el plugin
  Filler, // stats-charts-builder line chart usa `fill: true` — requiere Filler
);
