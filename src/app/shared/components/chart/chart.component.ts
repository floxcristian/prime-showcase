import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  computed,
  inject,
  input,
  PLATFORM_ID,
  untracked,
  viewChild,
} from '@angular/core';
import {
  Chart,
  type ChartData,
  type ChartOptions,
  type ChartType,
} from 'chart.js';

// Side-effect import: registra las piezas de Chart.js usadas en la app. MUY
// importante que sea import-por-side-effect (no tree-shakeable), si no el
// bundler lo elimina y new Chart() tira "controller bar is not a registered
// controller". Ver chart-registry.ts para el listado y rationale.
import './chart-registry';

/**
 * Normaliza un size a CSS. Mismo contrato que `<p-chart>`:
 *   - `number`              → `"<n>px"`
 *   - `"160"` (dígitos)     → `"160px"`
 *   - `"20rem"`, `"50%"`    → as-is
 *   - `undefined` / `null`  → `null` (no aplica style, deja que CSS/layout decida)
 */
function toCssSize(value: string | number | undefined | null): string | null {
  if (value == null) return null;
  if (typeof value === 'number') return `${value}px`;
  const trimmed = value.trim();
  if (trimmed === '') return null;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return `${trimmed}px`;
  return trimmed;
}

/**
 * Thin wrapper alrededor de Chart.js — reemplaza `<p-chart>` con un bundle
 * tree-shakeado (solo bar/line/doughnut + category/linear scales + Tooltip +
 * Filler). Ahorro medido: ver tools/bundle/baseline.json.
 *
 * **Contract:** misma superficie que `<p-chart>` para los props realmente
 * usados en el codebase (`type`, `data`, `options`, `width`, `height`,
 * `ariaLabel`). No expone eventos (`onDataSelect`) ni APIs imperativas
 * (`refresh()`, `getBase64Image()`) — nunca se usaron. Agregarlos si aparece
 * caso de uso, pero no especular.
 *
 * **Lifecycle:**
 *   - Se crea el `Chart` cuando canvas está mounted Y `data` llegó. El
 *     effect gatea ambos vía el `viewChild` signal y el `data` input signal
 *     — reacciona automáticamente cuando cualquiera cambia. Pattern igual
 *     al que overview.component.ts usa via `effect(themeChanged → set data)`.
 *   - En cada cambio de `type`, `data` u `options` se destruye y recrea
 *     — misma estrategia que PrimeNG. Simpler than `chart.update()` y evita
 *     state residual cuando se reconstruyen options (p.ej. grid colors
 *     nuevas post dark-mode toggle).
 *   - `DestroyRef.onDestroy` libera el canvas + listeners de Chart.js.
 *
 * **SSR:** el `<canvas>` se emite server-side (para hydration sin CLS),
 * pero `new Chart()` se salta via `isPlatformBrowser` guard. Al hidratar,
 * el effect re-corre en el browser con platform=browser → chart se crea.
 * El flujo funciona tanto con hidratación eager como `@defer (hydrate on
 * viewport)` (patrón usado en overview).
 *
 * **Zoneless-safe:** no usa `NgZone`. Chart.js internamente hace rAF para
 * animations; en zoneless eso no dispara CD pero tampoco lo necesita —
 * los cambios del DOM del canvas no son reactivos por naturaleza.
 */
@Component({
  selector: 'app-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <canvas
      #canvas
      [attr.role]="ariaLabel() ? 'img' : null"
      [attr.aria-label]="ariaLabel()"
    ></canvas>
  `,
  host: {
    class: 'block relative',
    '[style.width]': 'widthCss()',
    '[style.height]': 'heightCss()',
  },
})
export class ChartComponent {
  readonly type = input.required<ChartType>();
  readonly data = input<ChartData | undefined>(undefined);
  readonly options = input<ChartOptions | undefined>(undefined);
  readonly width = input<string | number | undefined>(undefined);
  readonly height = input<string | number | undefined>(undefined);
  readonly ariaLabel = input<string | undefined>(undefined);

  protected readonly widthCss = computed(() => toCssSize(this.width()));
  protected readonly heightCss = computed(() => toCssSize(this.height()));

  private readonly canvasRef =
    viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly platformId = inject(PLATFORM_ID);
  private chart: Chart | null = null;

  constructor() {
    const destroyRef = inject(DestroyRef);

    // Gates: SSR + canvas mounted + data available. Hasta que los tres se
    // cumplan, el effect es no-op. Cuando entran los tres, crea (o recrea)
    // el chart. `untracked` alrededor del DOM-write es defense-in-depth —
    // Chart.js no debería leer signals internamente pero si alguna vez lo
    // hiciera (via un plugin custom), evitamos loops.
    effect(() => {
      const type = this.type();
      const data = this.data();
      const options = this.options();
      const canvas = this.canvasRef();

      untracked(() => {
        if (!isPlatformBrowser(this.platformId)) return;
        if (!canvas || !data) return;
        this.chart?.destroy();
        this.chart = new Chart(canvas.nativeElement, { type, data, options });
      });
    });

    destroyRef.onDestroy(() => {
      this.chart?.destroy();
      this.chart = null;
    });
  }
}
