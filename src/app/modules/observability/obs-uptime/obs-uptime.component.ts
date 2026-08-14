import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelect } from 'primeng/multiselect';
import { Skeleton } from 'primeng/skeleton';
import { Slider } from 'primeng/slider';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';

import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { HealthBadgeComponent } from '../../../shared/components/health-badge/health-badge.component';
import {
  HEALTH_LABELS,
  HEALTH_STATES,
} from '../../../shared/components/health-badge/health-badge.tokens';
import { LoadErrorStateComponent } from '../../../shared/components/load-error-state/load-error-state.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { RefreshToolbarComponent } from '../../../shared/components/refresh-toolbar/refresh-toolbar.component';
import { StaleDataBannerComponent } from '../../../shared/components/stale-data-banner/stale-data-banner.component';
import { TableFilterShellComponent } from '../../../shared/components/table-filter-shell/table-filter-shell.component';
import { TooltipDismissOnClickDirective } from '../../../shared/directives/tooltip-dismiss-on-click.directive';
import { COLUMN_FILTER_PT } from '../../../shared/tokens/table-tokens';
import { trackedResource } from '../../../shared/utils/tracked-resource';
import { now, seededRandom } from '../mocks/mock-utils';
import type {
  HealthState,
  ServiceSummary,
} from '../models/observability.interface';
import { ObservabilityMockService } from '../services/observability-mock.service';
import { formatPercent } from '../utils/format';

interface UptimeSegment {
  readonly state: HealthState;
  readonly at: number; // epoch ms — centro temporal del período
  readonly tooltip: string;
  /**
   * Color CSS precomputado en `makeSegment()`. El template bindea
   * `seg.color` directo — con ~600 segments visibles, resolver el color
   * por función en cada CD costaba 600 llamadas por ciclo.
   */
  readonly color: string;
}

interface ServiceUptimeRow {
  readonly service: ServiceSummary;
  readonly segments: readonly UptimeSegment[];
  readonly incidentCount: number;
  readonly summaryAriaLabel: string;
  /** Uptime% preformateado para el footer del segment grid. */
  readonly uptimeLabel: string;
  /**
   * Rank precomputado por health para sort built-in de PrimeNG p-table
   * (`pSortableColumn="severityRank"`). Critical=0 hasta Ok=3, así
   * `[sortOrder]="1"` (asc) pone críticos arriba — orden default deseado.
   */
  readonly severityRank: number;
}

const SEGMENT_COUNT = 60;
const SEGMENT_HOURS = 12; // 60 × 12h = 30 días
const SEGMENT_MS = SEGMENT_HOURS * 60 * 60 * 1000;

/**
 * Severity rank — orden invariante de statuspages serias (PagerDuty /
 * Datadog / Linear / GitHub Status): los críticos siempre van arriba.
 * `unknown` antes de `ok` porque "no sabemos" es un estado de atención,
 * no de relax — los SRE quieren ver primero todo lo que NO está confirmado
 * como saludable.
 */
const SEVERITY_RANK: Record<HealthState, number> = {
  critical: 0,
  warn: 1,
  unknown: 2,
  ok: 3,
};

/**
 * Formateadores reusables — uno solo a nivel módulo en vez de N por
 * segmento. `Intl.DateTimeFormat` es relativamente caro de instanciar.
 */
const DATE_FMT = new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium' });
const TIME_FMT = new Intl.DateTimeFormat('es-CL', {
  hour: '2-digit',
  minute: '2-digit',
});

/**
 * Statuspage interna — vista tabular del estado de salud por servicio.
 *
 * **Layout**: alineado con `/customers` (header + count pill + toolbar +
 * `<p-table>` con tokens transparentes). La columna especializada es el
 * segment grid embebido con time anchors estilo Atlassian Statuspage.
 *
 * **Mobile**: card list bajo `md` — la tabla con `min-width: 60rem` no es
 * usable en celular y los SRE chequean status desde el celular *en
 * incidente*. Mismo patrón que `obs-alerts`.
 *
 * **Sort**: por severidad descendente por default. Invariante.
 *
 * **A11y**: el bar contenedor es tabbable y expone aria-label rico con
 * uptime% y count de segmentos con incidentes. Los tooltips por segmento
 * son detalle complementario (mouse-only, OK).
 *
 * **Coherencia mock**: `buildSegments` respeta `lastAlertAt` — los
 * segmentos en la ventana ±24h del timestamp de la alerta se fuerzan a
 * warn/critical según el health del servicio. Sin esto, "última alerta
 * hace 8 min" + último segment verde se contradicen.
 */
@Component({
  selector: 'app-obs-uptime',
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    MultiSelect,
    Skeleton,
    Slider,
    TableModule,
    TooltipModule,
    EmptyStateComponent,
    HealthBadgeComponent,
    LoadErrorStateComponent,
    PageHeaderComponent,
    RefreshToolbarComponent,
    StaleDataBannerComponent,
    TableFilterShellComponent,
    TooltipDismissOnClickDirective,
  ],
  templateUrl: './obs-uptime.component.html',
  styleUrl: './obs-uptime.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'flex-1 h-full overflow-y-auto overflow-x-clip overflow-hidden border border-surface rounded-2xl p-6',
  },
})
export class ObsUptimeComponent {
  private api = inject(ObservabilityMockService);
  private router = inject(Router);

  /**
   * Resource principal — `trackedResource()` empaqueta el pattern
   * compartido con users / roles / customers: rxResource +
   * loading/loadError + freshness (`lastFetchedAt` + bump del
   * TimeService, consumido por `<app-refresh-toolbar>`) + retry con
   * guard. Acá no usamos `rows` (la tabla consume `allRows`/`rows`
   * derivados abajo) sino `value` crudo.
   */
  private readonly servicesData = trackedResource<ServiceSummary>(() =>
    this.api.getServices(),
  );
  protected readonly loading = this.servicesData.loading;
  protected readonly loadError = this.servicesData.loadError;
  protected readonly lastFetchedAt = this.servicesData.lastFetchedAt;

  /**
   * Anclaje temporal UNIFORME para todos los servicios, capturado UNA vez
   * por instancia del componente — todos los bars comparten el mismo
   * "hoy" como punto de anclaje del último segmento.
   *
   * **Bug que resuelve (alineación)**: una versión previa usaba
   * `lastDeployAt` per-service como ancla → cada bar tenía un "hoy"
   * distinto y los segmentos no se alineaban temporalmente entre
   * servicios.
   *
   * **Bug que resuelve (SSR)**: otra versión usaba una constante de
   * módulo capturada al import — en SSR eso congelaba el "hoy" al boot
   * del server para todos los requests siguientes. Como campo de
   * instancia, cada render (request en server, navegación en cliente)
   * ancla a su propio presente.
   *
   * En producción real el ancla vendría del request del backend (server
   * clock) para evitar clock skew client-side; acá vive en el mock.
   */
  private readonly anchorTime = now();

  /**
   * Caches de memoización de filas/segmentos — CAMPOS DE INSTANCIA, no
   * estado a nivel módulo. A nivel módulo eran estado compartido entre
   * requests SSR (mismo proceso sirve N requests) y crecían sin bound
   * durante la vida del server. Scoped al componente: viven lo que vive
   * la vista y se recolectan con ella.
   */
  private readonly segmentCache = new Map<string, readonly UptimeSegment[]>();
  private readonly rowCache = new Map<string, ServiceUptimeRow>();

  /**
   * Raw rows — todos los servicios. El sort default por severidad ya no
   * vive acá: lo aplica PrimeNG p-table built-in vía `[sortField]` /
   * `[sortOrder]` y los `pSortableColumn` declarados en cada th. Eso
   * permite al user re-ordenar por cualquier columna sin que pisemos su
   * elección desde el computed.
   */
  protected readonly allRows = computed<readonly ServiceUptimeRow[]>(() => {
    const list = this.servicesData.value() ?? [];
    return list.map((svc) =>
      buildRow(svc, this.anchorTime, this.rowCache, this.segmentCache),
    );
  });

  /**
   * Rows pasadas a `<p-table [value]>`. Sort default por severityRank
   * asc (críticos primero) — PrimeNG aplica el sort default desde
   * `[sortField]` `[sortOrder]` y mantiene un orden matching cuando el
   * user no ha clickeado todavía ninguna columna. Filtros son
   * responsabilidad de `<p-columnFilter>` por columna — PrimeNG filtra
   * el array internamente, no necesita lógica acá.
   */
  protected readonly rows = computed<readonly ServiceUptimeRow[]>(() =>
    [...this.allRows()].sort((a, b) => a.severityRank - b.severityRank),
  );

  /**
   * Options para el `<p-columnFilter>` de la columna Estado (multiselect
   * con label en español). Derivadas del vocabulario compartido de
   * `health-badge.tokens.ts` — mismo mapping que el `<app-health-badge>`.
   */
  protected readonly healthOptions: {
    label: string;
    value: HealthState;
  }[] = HEALTH_STATES.map((value) => ({ label: HEALTH_LABELS[value], value }));

  /**
   * Lista deduplicada de equipos para el `<p-columnFilter>` de Equipo.
   * Computado desde la data del fetch — refleja teams reales de la sesión.
   */
  protected readonly availableTeams = computed<string[]>(() => {
    const list = this.servicesData.value() ?? [];
    return Array.from(new Set(list.map((s) => s.team))).sort();
  });

  /**
   * Passthrough config compartida para `<p-columnFilter>` — el JSDoc
   * completo (por qué tonal, por qué `root.class`, por qué
   * `!justify-end gap-2`) vive en `shared/tokens/table-tokens.ts`.
   * Reusado en los 4 column filters para consistency cross-columna.
   */
  protected readonly columnFilterPt = COLUMN_FILTER_PT;

  /**
   * True cuando hay servicios pero ninguno reporta datos. Activa el banner
   * que guía al SRE a revisar la integración. Distinto de `rows().length
   * === 0` (sin servicios) — acá hay servicios, no datos.
   */
  protected readonly allUnknown = computed(() => {
    const list = this.rows();
    return list.length > 0 && list.every((r) => r.service.health === 'unknown');
  });

  /**
   * Pill semántico — invierte forma según hay incidentes o no:
   *   - sin issues       → "X servicios saludables" + dot verde
   *   - con issues       → "X con incidentes" + warning naranja
   *   - todos sin datos  → null (no hay nada que celebrar ni que alertar)
   *   - lista vacía      → null (empty state se encarga)
   *
   * Datadog/PagerDuty pattern: el header summary destaca lo accionable. Con
   * todo verde el icono tranquiliza; con incidentes el count alerta.
   */
  protected readonly statusPill = computed<{
    icon: string;
    label: string;
  } | null>(() => {
    const list = this.rows();
    if (list.length === 0) return null;

    const issues = list.filter(
      (r) => r.service.health === 'critical' || r.service.health === 'warn',
    ).length;
    const healthy = list.filter((r) => r.service.health === 'ok').length;

    // Edge case: todos los servicios `unknown` — sin issues confirmados pero
    // tampoco saludables confirmados. Ocultar pill: no hay narrativa simple.
    if (issues === 0 && healthy === 0) return null;

    if (issues === 0) {
      return {
        icon: 'fa-sharp fa-solid fa-circle text-green-500',
        label:
          healthy === list.length
            ? `${healthy} ${plural(healthy, 'servicio saludable', 'servicios saludables')}`
            : `${healthy} de ${list.length} servicios saludables`,
      };
    }

    // Sharp solid (no duotone: inline a 16px) + orange (color semántico de
    // warning del DS — yellow está reservado al ícono BTC).
    return {
      icon: 'fa-sharp fa-solid fa-triangle-exclamation text-orange-500',
      label:
        issues === 1
          ? '1 servicio con incidentes'
          : `${issues} servicios con incidentes`,
    };
  });

  protected retry(): void {
    // Guard contra reentry incluido en `trackedResource()` — protege a
    // nivel handler además del [disabled] del refresh button.
    this.servicesData.retry();
  }

  protected viewDetail(serviceId: string): void {
    this.router.navigate(['/observability/services', serviceId]);
  }

  /**
   * Placeholder rows para el `#loadingbody` de la tabla showcase. Array
   * de 5 entries — suficiente para que el skeleton se vea como "tabla
   * con contenido" sin sobrecargar render. PrimeNG sigue iterando el
   * `#body` cuando `[value]` cambia; el `#loadingbody` se renderiza solo
   * cuando `[loading]=true`.
   */
  protected readonly skeletonPlaceholders = [0, 1, 2, 3, 4];
}

// ───────────────────────────────────────────────────────────────────────────
// Lógica de generación de filas — pura, testeable, sin DI. Los caches de
// memoización llegan por parámetro (campos de instancia del componente),
// nunca estado de módulo.
// ───────────────────────────────────────────────────────────────────────────

/**
 * Build memoizado de la fila. Cache key incluye los inputs que afectan el
 * cómputo (`health`, `lastAlertAt`); cambios en otros campos del summary
 * no invalidan los segmentos.
 */
function buildRow(
  svc: ServiceSummary,
  anchor: number,
  rowCache: Map<string, ServiceUptimeRow>,
  segmentCache: Map<string, readonly UptimeSegment[]>,
): ServiceUptimeRow {
  const cacheKey = `${svc.id}|${svc.health}|${svc.lastAlertAt ?? ''}|${svc.uptime30d.value}`;
  const cached = rowCache.get(cacheKey);
  if (cached) return cached;

  const segments = buildSegments(svc, SEGMENT_COUNT, anchor, segmentCache);
  const incidentCount = segments.filter(
    (s) => s.state === 'warn' || s.state === 'critical',
  ).length;

  const row: ServiceUptimeRow = {
    service: svc,
    segments,
    incidentCount,
    summaryAriaLabel: buildAriaLabel(svc, incidentCount),
    uptimeLabel: formatPercent(svc.uptime30d.value),
    severityRank: SEVERITY_RANK[svc.health],
  };
  rowCache.set(cacheKey, row);
  return row;
}

/**
 * Sintetiza segmentos. Cada uno representa una ventana de SEGMENT_HOURS
 * (12h por default → 60 segmentos cubren 30 días).
 *
 * **Coherencia con `lastAlertAt`**: los segmentos cuyo timestamp cae en
 * la ventana ±2 segmentos del tiempo de la alerta se fuerzan a `warn` o
 * `critical` según el health del servicio. Sin esto, el PRNG generaba
 * segmentos verdes mientras "Última alerta hace 8 min" decía lo contrario
 * — incoherencia visual que rompe la confianza en la data.
 *
 * **Memoizado** por `(id, health, lastAlertAt, uptime)`: la misma vista
 * renderiza los mismos segmentos. `reload()` sin cambios reales en data
 * NO regenera 480 segmentos.
 */
function buildSegments(
  svc: ServiceSummary,
  n: number,
  anchor: number,
  segmentCache: Map<string, readonly UptimeSegment[]>,
): readonly UptimeSegment[] {
  const cacheKey = `${svc.id}|${svc.health}|${svc.lastAlertAt ?? ''}|${svc.uptime30d.value}`;
  const cached = segmentCache.get(cacheKey);
  if (cached) return cached;

  const segments = computeSegments(svc, n, anchor);
  segmentCache.set(cacheKey, segments);
  return segments;
}

function computeSegments(
  svc: ServiceSummary,
  n: number,
  anchor: number,
): readonly UptimeSegment[] {
  if (svc.health === 'unknown' || svc.uptime30d.value === 0) {
    return Array.from({ length: n }, (_, i) =>
      makeSegment('unknown', segmentTimestamp(anchor, n, i)),
    );
  }

  const rand = seededRandom(`uptime-${svc.id}`);
  const uptime = svc.uptime30d.value;
  const incidentProb = (100 - uptime) / 100;
  const criticalRatio = Math.min(0.7, Math.max(0.2, incidentProb * 8));

  // Ventana de impacto de la última alerta: ±2 segmentos = ±24h.
  const alertTimeMs = svc.lastAlertAt
    ? new Date(svc.lastAlertAt).getTime()
    : null;
  const alertImpactRadius = SEGMENT_MS * 2;

  const result: UptimeSegment[] = [];
  for (let i = 0; i < n; i++) {
    const at = segmentTimestamp(anchor, n, i);
    const r = rand();
    let state: HealthState;

    // Coerce: si está en la ventana de la alerta, refleja el health del
    // servicio. Esto hace que el último segmento (cerca de "ahora") matchee
    // con la línea "Última alerta hace X" de la columna vecina.
    if (
      alertTimeMs !== null &&
      Math.abs(at - alertTimeMs) <= alertImpactRadius
    ) {
      state = svc.health === 'critical' ? 'critical' : 'warn';
    } else if (r >= incidentProb * 5) {
      state = 'ok';
    } else {
      state = rand() < criticalRatio ? 'critical' : 'warn';
    }

    result.push(makeSegment(state, at));
  }

  return result;
}

/** Centro temporal del segmento `i` (de `n` totales) anclado a `anchor`. */
function segmentTimestamp(anchor: number, n: number, i: number): number {
  return anchor - (n - 1 - i) * SEGMENT_MS;
}

/**
 * Tooltip por segmento: rango temporal real ("15 mar, 12:00–24:00 ·
 * Crítico") en vez de timestamp puntual. El segmento representa una
 * ventana de SEGMENT_HOURS, mostrarlo como punto inducía a pensar que era
 * un evento específico. El rango deja claro que es agregado de un período.
 */
function makeSegment(state: HealthState, at: number): UptimeSegment {
  const start = new Date(at - SEGMENT_MS / 2);
  const end = new Date(at + SEGMENT_MS / 2);
  const day = DATE_FMT.format(start);
  const range = `${TIME_FMT.format(start)}–${TIME_FMT.format(end)}`;
  return {
    state,
    at,
    tooltip: `${day} ${range} · ${HEALTH_LABELS[state]}`,
    color: segmentColor(state),
  };
}

/**
 * Colores semánticos de data — leídos del theme Aura via CSS custom
 * properties (`--p-{color}-{shade}`). NO usamos utilities Tailwind
 * `bg-green-500`/`bg-red-500` porque verde/rojo no están en la whitelist
 * del DS. El theme Aura es theme-aware → estas vars resuelven a su
 * variante en dark mode sin requerir `dark:` overrides.
 *
 * **Por qué `surface-400` para `unknown` y no `surface-200`**: el row
 * cambia su background a `bg-emphasis` (≈ surface-100 light /
 * surface-700 dark) al hover. surface-200 está demasiado cerca de
 * surface-100 → los segments "sin datos" desaparecían al hover (issue
 * reportado). surface-400 contrasta limpio contra ambos hover bgs.
 */
function segmentColor(state: HealthState): string {
  if (state === 'ok') return 'var(--p-green-500)';
  if (state === 'warn') return 'var(--p-yellow-500)';
  if (state === 'critical') return 'var(--p-red-500)';
  return 'var(--p-surface-400)';
}

/**
 * Aria label rico para el bar contenedor — keyboard / screen-reader users
 * obtienen el resumen numérico que los segments transmiten visualmente solo
 * por color. WCAG 1.4.1: la información no debe depender exclusivamente
 * del color.
 */
function buildAriaLabel(svc: ServiceSummary, incidents: number): string {
  if (svc.health === 'unknown')
    return `${svc.name}: sin datos de uptime registrados en los últimos 30 días`;

  const uptime = formatPercent(svc.uptime30d.value);
  const base = `Uptime de ${svc.name} en los últimos 30 días: ${uptime}`;
  if (incidents === 0) return `${base}, sin incidentes`;
  if (incidents === 1) return `${base}, 1 segmento con incidente`;
  return `${base}, ${incidents} segmentos con incidentes`;
}

function plural(n: number, singular: string, plural: string): string {
  return n === 1 ? singular : plural;
}
