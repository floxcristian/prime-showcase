import { ChangeDetectionStrategy, Component, PLATFORM_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Chart, type ChartData, type ChartOptions } from 'chart.js';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChartComponent } from './chart.component';

// ─── Canvas 2D context polyfill para jsdom ──────────────────────────────────
// jsdom no implementa `canvas.getContext('2d')` (retorna null), y Chart.js lee
// métricas de texto + dimensiones del contexto al instanciarse. Sin este
// polyfill, `new Chart(canvas, ...)` tira `TypeError: Cannot read properties
// of null (reading 'save')`.
//
// Mockeamos getContext a nivel prototype una sola vez (beforeAll). Es más
// robusto que `vi.mock('chart.js', ...)` a nivel módulo: el mock a nivel
// módulo tiene problemas de aislamiento entre specs que comparten worker (la
// primera spec que carga chart.js fija la resolución para las demás, y
// vi.mock llegando después no lo desplaza). El polyfill de canvas, en cambio,
// es universal: cualquier spec que instancie Chart.js funciona.
//
// Ref: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D
function createFakeContext(): Partial<CanvasRenderingContext2D> {
  return {
    // Text metrics — Chart.js llama measureText() para calcular tick labels
    measureText: () => ({ width: 10 }) as TextMetrics,
    // Drawing state — pair de save/restore envuelve cada frame
    save: () => undefined,
    restore: () => undefined,
    // Paths
    beginPath: () => undefined,
    closePath: () => undefined,
    moveTo: () => undefined,
    lineTo: () => undefined,
    arc: () => undefined,
    quadraticCurveTo: () => undefined,
    bezierCurveTo: () => undefined,
    // Styles
    stroke: () => undefined,
    fill: () => undefined,
    clearRect: () => undefined,
    fillRect: () => undefined,
    strokeRect: () => undefined,
    fillText: () => undefined,
    strokeText: () => undefined,
    // Transforms
    scale: () => undefined,
    rotate: () => undefined,
    translate: () => undefined,
    setTransform: () => undefined,
    transform: () => undefined,
    resetTransform: () => undefined,
    // Clipping + misc
    clip: () => undefined,
    rect: () => undefined,
    drawImage: () => undefined,
    createLinearGradient: () =>
      ({ addColorStop: () => undefined }) as CanvasGradient,
    createRadialGradient: () =>
      ({ addColorStop: () => undefined }) as CanvasGradient,
    createPattern: () => null,
    getImageData: () =>
      ({ data: new Uint8ClampedArray(4) }) as ImageData,
    putImageData: () => undefined,
    isPointInPath: () => false,
    isPointInStroke: () => false,
  };
}

// Polyfill idempotente — sólo se instala una vez aunque haya varios
// describe() en este archivo.
beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as HTMLCanvasElement & {
    __chartSpecPatched?: boolean;
  };
  if (proto.__chartSpecPatched) return;
  proto.getContext = vi.fn(
    () => createFakeContext() as CanvasRenderingContext2D,
  ) as unknown as typeof proto.getContext;
  proto.__chartSpecPatched = true;
});

/**
 * Cuenta las instancias actualmente registradas en el Chart registry — la
 * forma oficial de saber cuántos charts están vivos, sin monkey-patch.
 */
function liveChartCount(): number {
  return Object.keys((Chart as unknown as { instances: object }).instances)
    .length;
}

afterEach(() => {
  // Destruir cualquier chart que haya quedado vivo entre tests — si un test
  // crea y no destruye, contamina los siguientes.
  for (const chart of Object.values(
    (Chart as unknown as { instances: Record<string, Chart> }).instances,
  )) {
    chart.destroy();
  }
});

// ─── Harness components ─────────────────────────────────────────────────────
@Component({
  selector: 'app-chart-host',
  imports: [ChartComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-chart
      [type]="type()"
      [data]="data()"
      [options]="options()"
      [height]="'10rem'"
    />
  `,
})
class ChartHostComponent {
  readonly type = signal('bar' as const);
  readonly data = signal<ChartData | undefined>(undefined);
  readonly options = signal<ChartOptions | undefined>(undefined);
}

@Component({
  selector: 'app-aria-host',
  imports: [ChartComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-chart
      [type]="'bar'"
      [data]="data()"
      [ariaLabel]="'Ventas mensuales'"
    />
  `,
})
class AriaHostComponent {
  readonly data = signal<ChartData>({
    labels: ['A'],
    datasets: [{ data: [1] }],
  });
}

@Component({
  selector: 'app-size-numeric-host',
  imports: [ChartComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-chart [type]="'bar'" [height]="'160'" />`,
})
class SizeNumericHostComponent {}

@Component({
  selector: 'app-size-rem-host',
  imports: [ChartComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-chart [type]="'bar'" [height]="'20rem'" />`,
})
class SizeRemHostComponent {}

@Component({
  selector: 'app-size-px-host',
  imports: [ChartComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-chart [type]="'bar'" [height]="240" />`,
})
class SizePxHostComponent {}

describe('ChartComponent (browser platform)', () => {
  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [ChartHostComponent, AriaHostComponent],
      providers: [{ provide: PLATFORM_ID, useValue: 'browser' }],
    }).compileComponents();
  });

  it('renders a <canvas> element inside the host', () => {
    const fixture = TestBed.createComponent(ChartHostComponent);
    fixture.detectChanges();
    const canvas = fixture.nativeElement.querySelector('canvas');
    expect(canvas).not.toBeNull();
  });

  it('does NOT create a Chart instance until data is defined', () => {
    const before = liveChartCount();
    const fixture = TestBed.createComponent(ChartHostComponent);
    fixture.detectChanges();
    expect(liveChartCount()).toBe(before);
  });

  it('creates a Chart instance when data becomes available', () => {
    const before = liveChartCount();
    const fixture = TestBed.createComponent(ChartHostComponent);
    fixture.detectChanges();

    fixture.componentInstance.data.set({
      labels: ['A', 'B'],
      datasets: [{ data: [1, 2] }],
    });
    fixture.detectChanges();

    expect(liveChartCount()).toBe(before + 1);
  });

  it('destroys the previous Chart and recreates on data change', () => {
    const before = liveChartCount();
    const fixture = TestBed.createComponent(ChartHostComponent);
    fixture.componentInstance.data.set({
      labels: ['A'],
      datasets: [{ data: [1] }],
    });
    fixture.detectChanges();

    // Después del primer set, una instancia viva.
    expect(liveChartCount()).toBe(before + 1);

    fixture.componentInstance.data.set({
      labels: ['B'],
      datasets: [{ data: [2] }],
    });
    fixture.detectChanges();

    // Mismo patrón que `<p-chart>`: destroy + recreate por cambio de data —
    // sigue siendo 1 instancia viva (el primer chart se destruyó).
    expect(liveChartCount()).toBe(before + 1);
  });

  it('destroys the Chart instance when the component is destroyed', () => {
    const before = liveChartCount();
    const fixture = TestBed.createComponent(ChartHostComponent);
    fixture.componentInstance.data.set({
      labels: ['A'],
      datasets: [{ data: [1] }],
    });
    fixture.detectChanges();
    expect(liveChartCount()).toBe(before + 1);

    fixture.destroy();
    expect(liveChartCount()).toBe(before);
  });

  it('applies ariaLabel as attribute on the canvas (a11y)', () => {
    const fixture = TestBed.createComponent(AriaHostComponent);
    fixture.detectChanges();
    const canvas = fixture.nativeElement.querySelector(
      'canvas',
    ) as HTMLCanvasElement;
    expect(canvas.getAttribute('role')).toBe('img');
    expect(canvas.getAttribute('aria-label')).toBe('Ventas mensuales');
  });

  it('omits role/aria-label when ariaLabel input not provided', () => {
    const fixture = TestBed.createComponent(ChartHostComponent);
    fixture.detectChanges();
    const canvas = fixture.nativeElement.querySelector(
      'canvas',
    ) as HTMLCanvasElement;
    expect(canvas.hasAttribute('role')).toBe(false);
    expect(canvas.hasAttribute('aria-label')).toBe(false);
  });
});

describe('ChartComponent (server platform — SSR safety)', () => {
  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [ChartHostComponent],
      providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
    }).compileComponents();
  });

  it('renders <canvas> but never instantiates Chart server-side', () => {
    const before = liveChartCount();
    const fixture = TestBed.createComponent(ChartHostComponent);
    fixture.componentInstance.data.set({
      labels: ['A'],
      datasets: [{ data: [1] }],
    });
    fixture.detectChanges();

    // El HTML <canvas> SÍ se emite (para evitar CLS al hidratar), pero
    // `new Chart()` se salta — se instanciaría en el cliente tras hydration.
    const canvas = fixture.nativeElement.querySelector('canvas');
    expect(canvas).not.toBeNull();
    expect(liveChartCount()).toBe(before);
  });
});

describe('ChartComponent — size normalization', () => {
  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [
        SizeNumericHostComponent,
        SizeRemHostComponent,
        SizePxHostComponent,
      ],
      providers: [{ provide: PLATFORM_ID, useValue: 'browser' }],
    }).compileComponents();
  });

  it('converts numeric string height to px (match p-chart contract)', () => {
    const fixture = TestBed.createComponent(SizeNumericHostComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement.querySelector(
      'app-chart',
    ) as HTMLElement;
    expect(host.style.height).toBe('160px');
  });

  it('passes through CSS-unit strings as-is', () => {
    const fixture = TestBed.createComponent(SizeRemHostComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement.querySelector(
      'app-chart',
    ) as HTMLElement;
    expect(host.style.height).toBe('20rem');
  });

  it('converts numeric input to px', () => {
    const fixture = TestBed.createComponent(SizePxHostComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement.querySelector(
      'app-chart',
    ) as HTMLElement;
    expect(host.style.height).toBe('240px');
  });
});
