import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelect } from 'primeng/multiselect';
import { Skeleton } from 'primeng/skeleton';
import { Slider } from 'primeng/slider';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';

import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { TableFilterShellComponent } from '../../../shared/components/table-filter-shell/table-filter-shell.component';
import { TooltipDismissOnClickDirective } from '../../../shared/directives/tooltip-dismiss-on-click.directive';
import { RelativeTimePipe } from '../../../shared/pipes/relative-time.pipe';
import { NOW, seededRandom } from '../mocks/mock-utils';
import type { HealthState, ServiceSummary } from '../models/observability.interface';
import { ObservabilityMockService } from '../services/observability-mock.service';

interface UptimeSegment {
  readonly state: HealthState;
  readonly at: number; // epoch ms — centro temporal del período
  readonly tooltip: string;
}

interface ServiceUptimeRow {
  readonly service: ServiceSummary;
  readonly segments: readonly UptimeSegment[];
  readonly incidentCount: number;
  readonly summaryAriaLabel: string;
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
    Tag,
    TooltipModule,
    EmptyStateComponent,
    TableFilterShellComponent,
    TooltipDismissOnClickDirective,
    RelativeTimePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'flex-1 h-full overflow-y-auto overflow-x-clip overflow-hidden border border-surface rounded-2xl p-6',
  },
  template: `
    <!-- Header -->
    <div class="flex items-start gap-2 justify-between flex-wrap">
      <div class="min-w-0">
        <h1 class="text-2xl leading-8 text-color font-medium">Uptime</h1>
        <div class="mt-1 leading-6 text-muted-color">
          Estado de salud y cuánto tiempo estuvieron disponibles tus servicios en los últimos 30 días.
        </div>
      </div>
      @if (statusPill(); as pill) {
        <!--
          Status pill informativo (no interactivo): elemento estático,
          NO un <p-button>. Antes usábamos <p-button outlined> imitando
          el look de customers count pill, pero eso introduce cursor
          pointer + hover effect que mienten al user — el elemento no
          es clickeable. Patrón Linear/GitHub: badges informativos van
          como <span>/<div> con styling similar al outlined button pero
          sin affordances de interacción.
        -->
        <div
          class="hidden sm:inline-flex items-center gap-2 px-4 py-1 rounded-lg border border-surface text-color font-medium leading-6"
          role="status"
          [attr.aria-label]="pill.label"
        >
          <i [class]="pill.icon" aria-hidden="true"></i>
          <span>{{ pill.label }}</span>
        </div>
      }
    </div>

    <!--
      Toolbar — solo info + refresh. Los filtros viven en cada columna
      de la tabla via <p-columnFilter>; un toolbar duplicado confundía
      al user (¿cuál filter aplica? ¿se sincronizan?). Pattern Linear /
      GitHub: filtros donde se filtran los datos (column header), no
      arriba en una toolbar separada.
    -->
    <div class="mt-6 lg:mt-10 mb-4 flex items-center gap-2 lg:gap-3 flex-wrap">
      <div class="ml-auto flex items-center gap-2 lg:gap-3 shrink-0">
        @if (lastFetchedAt(); as ts) {
          <span class="text-sm text-muted-color leading-5 hidden sm:inline" aria-live="polite">
            Actualizado {{ ts | relativeTime }}
          </span>
        }
        <!--
          Refresh button — feedback de loading vía icon rotation.

          NO usa [loading] del p-button: PrimeNG swap-ea el icon por un
          SVG spinner que es casi idéntico al fa-arrows-rotate (ambos
          círculos con flechas) → durante 1-2 frames de transición se
          ven los dos overlapped, apariencia de "2 iconos" reportada
          en QA.

          En su lugar, durante loading rotamos el MISMO icon via
          animate-spin (Tailwind keyframe linear infinite). El icon
          fa-arrows-rotate ya semántica "girar/refrescar" → rotarlo
          comunica "trabajando" sin swap (sin flicker) y sin ocultar
          la rotación con un spinner ajeno. Patrón Linear / Stripe
          Dashboard / Vercel para refresh buttons.
          prefers-reduced-motion neutraliza la animación globalmente
          (styles.scss).

          [disabled]="loading()" bloquea tap-spam DURANTE el fetch.
          El tradeoff conocido — disabled aplica pointer-events:none
          → tooltip "Actualizar" no aparece en hover durante loading —
          es ACEPTABLE acá porque el spin icon ya es el feedback
          visual del estado: el user que ve el ícono girando no
          necesita el tooltip para entender "está actualizando". El
          tooltip cumple rol discovery (idle, primer hover); el spin
          cumple rol state (loading). Roles complementarios, no
          superpuestos.

          retry() además guardea contra reentry como defense-in-depth.
        -->
        <p-button
          [icon]="'fa-sharp fa-regular fa-arrows-rotate' + (loading() ? ' animate-spin' : '')"
          [disabled]="loading()"
          outlined
          severity="secondary"
          ariaLabel="Actualizar"
          pTooltip="Actualizar"
          tooltipPosition="bottom"
          (onClick)="retry()"
        />
      </div>
    </div>

    @if (allRows().length === 0 && loadError()) {
      <app-empty-state
        icon="fa-triangle-exclamation"
        title="No pudimos cargar los servicios"
        description="Hubo un problema al obtener los datos. Reintentalo en unos segundos."
        [bordered]="true"
        actionLabel="Reintentar"
        actionIcon="fa-sharp fa-regular fa-arrows-rotate"
        (actionClick)="retry()"
      />
    } @else if (allRows().length === 0 && !loading()) {
      <app-empty-state
        icon="fa-server"
        title="Sin servicios registrados"
        description="Cuando agregues servicios al registry aparecerán acá."
        [bordered]="true"
      />
    } @else {
      <!--
        El feedback de loading lo maneja la tabla via [loading]="loading()":
          - Initial load (allRows=[] + loading): PrimeNG renderiza
            <ng-template #loadingbody> con skeleton rows.
          - Reload con data: PrimeNG aplica un overlay/mask sobre las
            filas existentes — la data previa queda visible mientras se
            actualiza (stale-while-revalidate UX).
        Antes había una barra de loading custom + un skeleton standalone
        encima de la tabla — duplicaban el feedback. Confiar en el
        mecanismo built-in del p-table es más simple y consistente.

        Para errores de reload con data previa, mantenemos el banner
        inline porque el [loading] no comunica failure — solo "trabajando".
      -->
      @if (loadError() && allRows().length > 0) {
        <div class="border border-surface rounded-2xl p-3 mb-2 flex items-center gap-3 text-sm" role="alert">
          <i class="fa-sharp fa-regular fa-triangle-exclamation text-color" aria-hidden="true"></i>
          <span class="flex-1 text-muted-color leading-5">
            No pudimos refrescar los datos. Estás viendo la última versión disponible.
          </span>
          <p-button
            label="Reintentar"
            severity="secondary"
            size="small"
            [text]="true"
            icon="fa-sharp fa-regular fa-arrows-rotate"
            (onClick)="retry()"
          />
        </div>
      }

      @if (allUnknown()) {
        <!--
          Edge case: todos los servicios reportan health "unknown" (sin
          datos de monitoreo). El bar grid se ve como una pared gris
          uniforme que no le dice nada al SRE. Acá lo guíamos al fix:
          revisar la integración. CTA primario hacia la documentación —
          patrón Datadog Onboarding: el banner identifica el problema +
          ofrece la siguiente acción concreta, no solo señala el síntoma.
        -->
        <div
          class="border border-surface rounded-2xl p-4 mb-4 flex flex-col sm:flex-row sm:items-center gap-3"
          role="status"
        >
          <i
            class="fa-sharp fa-regular fa-circle-info text-color text-xl shrink-0 self-start sm:self-center"
            aria-hidden="true"
          ></i>
          <div class="flex-1 min-w-0">
            <div class="text-color font-medium leading-6">Sin datos de uptime para ningún servicio</div>
            <div class="text-muted-color text-sm leading-5 mt-1">
              Verificá la integración de monitoreo. Una vez que los servicios reporten métricas, vas a ver el historial
              acá.
            </div>
          </div>
          <p-button
            label="Ver guía de integración"
            severity="secondary"
            [outlined]="true"
            icon="fa-sharp fa-regular fa-book-open"
            iconPos="left"
            class="shrink-0"
          />
        </div>
      }
      <!--
        Tabla principal — built-in PrimeNG.

        Layout puramente "out of the box": filtros built-in por columna
        (con custom filter templates donde aplica), sort nativo, paginator
        nativo, striped rows, gridlines, skeleton via loadingbody, loading
        state durante refresh.

        Por qué se omite [dt]: TRANSPARENT_TABLE_TOKENS define
        row.background = transparent, lo que pisaría el striping de
        stripedRows. Dejamos que PrimeNG controle backgrounds.

        Wrapper con overflow-hidden para que las gridlines no toquen
        las esquinas redondeadas del border container.

        En mobile (<md), el min-width 64rem fuerza scroll horizontal —
        consistente con tablas de obs-services / obs-alerts del módulo.
      -->
      <div class="rounded-lg border border-surface w-full overflow-hidden">
        <p-table
          [value]="$any(rows())"
          [loading]="loading()"
          [paginator]="true"
          [rows]="10"
          [rowsPerPageOptions]="[10, 25, 50]"
          [stripedRows]="true"
          [showGridlines]="true"
          [rowHover]="true"
          sortMode="single"
          dataKey="service.id"
          [tableStyle]="{ 'min-width': '64rem' }"
          [showCurrentPageReport]="true"
          currentPageReportTemplate="Mostrando {first}–{last} de {totalRecords} servicios"
        >
          <ng-template #header>
            <!--
                Distribución de columnas: las 4 columnas con dato corto
                fijas (Estado / Servicio / Equipo / Alertas), suman ~520px;
                "Últimos 30 días" toma el remanente (~440px en min-width
                64rem) — donde más se beneficia el segment grid.

                whitespace-nowrap en cada th: invariante del DS — los
                headers de tabla nunca wrappean.
              -->
            <tr>
              <!--
                  Layout del th — patrón big-tech estándar (Linear /
                  Datadog / Stripe / Material UI X DataGrid / Jira):
                    [Label][SortIcon] .... [FilterButton]
                  El sort icon va inline JUNTO al label: ambos forman la
                  unidad visual de sort — todo el TH es el trigger de
                  click (pSortableColumn captura). El filter button
                  queda esquinado a la derecha como control discreto
                  con popover propio. flex + justify-between separa los
                  dos grupos hacia los extremos del cell.
                -->
              <th pSortableColumn="severityRank" class="w-40 whitespace-nowrap">
                <div class="flex w-full items-center justify-between gap-2">
                  <span class="flex items-center gap-1">
                    <span>Estado</span>
                    <p-sortIcon field="severityRank" />
                  </span>
                  <span pTooltip="Filtrar" tooltipPosition="bottom"
                    ><p-columnFilter
                      field="service.health"
                      matchMode="in"
                      display="menu"
                      [showMatchModes]="false"
                      [showOperator]="false"
                      [showAddButton]="false"
                      [pt]="columnFilterPt"
                    >
                      <ng-template #filter let-value let-filter="filterCallback">
                        <app-table-filter-shell>
                          <p-multiselect
                            [options]="healthOptions"
                            optionLabel="label"
                            optionValue="value"
                            [ngModel]="value"
                            (ngModelChange)="filter($event)"
                            placeholder="Cualquiera"
                            class="w-full"
                          />
                        </app-table-filter-shell>
                      </ng-template> </p-columnFilter
                  ></span>
                </div>
              </th>
              <th pSortableColumn="service.name" class="w-56 whitespace-nowrap">
                <div class="flex w-full items-center justify-between gap-2">
                  <span class="flex items-center gap-1">
                    <span>Servicio</span>
                    <p-sortIcon field="service.name" />
                  </span>
                  <!--
                      type="text" built-in renderiza un input de ancho
                      fijo. Pasamos a custom template para controlar
                      el width del input pInputText con clase w-full.
                    -->
                  <span pTooltip="Filtrar" tooltipPosition="bottom"
                    ><p-columnFilter
                      field="service.name"
                      matchMode="contains"
                      display="menu"
                      [showMatchModes]="false"
                      [showOperator]="false"
                      [showAddButton]="false"
                      [pt]="columnFilterPt"
                    >
                      <ng-template #filter let-value let-filter="filterCallback">
                        <app-table-filter-shell>
                          <input
                            type="text"
                            pInputText
                            [ngModel]="value"
                            (ngModelChange)="filter($event)"
                            placeholder="Buscar nombre"
                            class="w-full"
                          />
                        </app-table-filter-shell>
                      </ng-template> </p-columnFilter
                  ></span>
                </div>
              </th>
              <th pSortableColumn="service.team" class="w-40 whitespace-nowrap">
                <div class="flex w-full items-center justify-between gap-2">
                  <span class="flex items-center gap-1">
                    <span>Equipo</span>
                    <p-sortIcon field="service.team" />
                  </span>
                  <span pTooltip="Filtrar" tooltipPosition="bottom"
                    ><p-columnFilter
                      field="service.team"
                      matchMode="in"
                      display="menu"
                      [showMatchModes]="false"
                      [showOperator]="false"
                      [showAddButton]="false"
                      [pt]="columnFilterPt"
                    >
                      <ng-template #filter let-value let-filter="filterCallback">
                        <app-table-filter-shell>
                          <p-multiselect
                            [options]="availableTeams()"
                            [ngModel]="value"
                            (ngModelChange)="filter($event)"
                            placeholder="Cualquiera"
                            class="w-full"
                          />
                        </app-table-filter-shell>
                      </ng-template> </p-columnFilter
                  ></span>
                </div>
              </th>
              <!--
                  Columna "Últimos 30 días" — segment grid + footer igual
                  que la tabla de arriba. NO es sortable (orden por una
                  serie de 60 segments no tiene semántica clara), pero
                  SÍ filtrable por rango de uptime% via slider. Sin sort
                  icon → el affordance derecho es solo el filter trigger.
                -->
              <th class="whitespace-nowrap">
                <div class="flex w-full items-center justify-between gap-2">
                  <span>Últimos 30 días</span>
                  <span pTooltip="Filtrar" tooltipPosition="bottom"
                    ><p-columnFilter
                      field="service.uptime30d.value"
                      matchMode="between"
                      display="menu"
                      [showMatchModes]="false"
                      [showOperator]="false"
                      [showAddButton]="false"
                      [pt]="columnFilterPt"
                    >
                      <ng-template #filter let-value let-filter="filterCallback">
                        <app-table-filter-shell>
                          <div class="flex flex-col gap-3 px-1">
                            <span class="text-sm text-muted-color leading-5">
                              Rango: {{ (value && value[0]) ?? 0 }}% – {{ (value && value[1]) ?? 100 }}%
                            </span>
                            <p-slider
                              [ngModel]="value ?? [0, 100]"
                              (ngModelChange)="filter($event)"
                              [range]="true"
                              [min]="0"
                              [max]="100"
                              class="w-full"
                            />
                          </div>
                        </app-table-filter-shell>
                      </ng-template> </p-columnFilter
                  ></span>
                </div>
              </th>
              <!--
                  Columna numérica corta — texto centrado en header y body.
                  Patrón Datadog/Stripe para columnas tipo count: el ojo
                  escanea verticalmente alineado al centro, más rápido que
                  con números a la izquierda. Rompemos justify-between
                  intencionalmente acá: el label + sort icon van juntos
                  centrados en lugar de separados a los extremos.
                -->
              <th pSortableColumn="service.activeAlertsCount" class="w-24 whitespace-nowrap text-center">
                <div class="flex w-full items-center justify-center gap-2">
                  <span>Alertas</span>
                  <p-sortIcon field="service.activeAlertsCount" />
                </div>
              </th>
              <!--
                  Columna de acción "Ver detalle" — última posición. No
                  sortable ni filterable, sin label visible (sólo el icon
                  comunica). Patrón Linear / Datadog / GitHub: row action
                  buttons al final de la fila, alineados a la derecha,
                  icon-only con tooltip. w-12 = ancho mínimo para el
                  button text-secondary rounded sin que sobre padding.
                -->
              <th class="w-12 whitespace-nowrap"></th>
            </tr>
          </ng-template>

          <ng-template #body let-row>
            <tr>
              <td>
                <p-tag [severity]="tagSeverity(row.service.health)" [value]="stateLabel(row.service.health)" />
              </td>
              <td>
                <span class="text-color font-medium">{{ row.service.name }}</span>
              </td>
              <td>
                <span class="text-muted-color">{{ row.service.team }}</span>
              </td>
              <td>
                <!--
                    Segment grid + time anchor footer — mismo pattern
                    que la tabla custom de arriba. El bar consume
                    row.segments precomputados; el footer muestra
                    anchors temporales y uptime%.
                  -->
                <div class="flex flex-col gap-2">
                  <div
                    class="flex items-stretch gap-0.5 h-7 min-w-0"
                    role="img"
                    tabindex="0"
                    [attr.aria-label]="row.summaryAriaLabel"
                  >
                    @for (seg of row.segments; track seg.at) {
                      <span
                        class="flex-1 rounded-lg"
                        [style.background-color]="segmentColor(seg.state)"
                        [pTooltip]="seg.tooltip"
                        tooltipPosition="top"
                      ></span>
                    }
                  </div>
                  <div class="flex items-center gap-3 text-xs text-muted-color leading-4">
                    <span class="shrink-0">hace 30 días</span>
                    <div class="flex-1 border-t border-surface-200 dark:border-surface-800"></div>
                    <span class="shrink-0 text-color font-semibold"
                      >{{ row.service.uptime30d.value.toFixed(2) }}% uptime</span
                    >
                    <div class="flex-1 border-t border-surface-200 dark:border-surface-800"></div>
                    <span class="shrink-0">hoy</span>
                  </div>
                </div>
              </td>
              <td class="text-center">
                <span class="text-color">{{ row.service.activeAlertsCount }}</span>
              </td>
              <td class="text-right">
                <p-button
                  icon="fa-sharp fa-regular fa-chevron-right"
                  severity="secondary"
                  [text]="true"
                  [rounded]="true"
                  ariaLabel="Ver detalle"
                  pTooltip="Ver detalle"
                  tooltipPosition="left"
                  (onClick)="viewDetail(row.service.id)"
                />
              </td>
            </tr>
          </ng-template>

          <!--
              loadingbody: PrimeNG renderiza este template en lugar del
              body cuando [loading]=true. Skeleton heterogéneo: la celda
              de "Últimos 30 días" usa un bar placeholder (h-7) para
              representar visualmente el segment grid que va a aparecer.
            -->
          <ng-template #loadingbody>
            @for (i of skeletonPlaceholders; track i) {
              <tr>
                <td>
                  <p-skeleton width="6rem" height="1.5rem" />
                </td>
                <td>
                  <p-skeleton width="60%" height="1rem" />
                </td>
                <td>
                  <p-skeleton width="50%" height="1rem" />
                </td>
                <td>
                  <p-skeleton width="100%" height="1.75rem" />
                </td>
                <td>
                  <p-skeleton width="2rem" height="1rem" />
                </td>
                <td>
                  <p-skeleton shape="circle" size="2rem" />
                </td>
              </tr>
            }
          </ng-template>

          <ng-template #emptymessage>
            <tr>
              <td colspan="6" class="text-center text-muted-color">Sin resultados</td>
            </tr>
          </ng-template>
        </p-table>
      </div>
    }
  `,
})
export class ObsUptimeComponent {
  private api = inject(ObservabilityMockService);
  private router = inject(Router);

  protected readonly servicesResource = rxResource({
    stream: () => this.api.getServices(),
  });
  protected readonly loading = computed(() => this.servicesResource.isLoading());
  protected readonly loadError = computed(() => this.servicesResource.error());

  /**
   * Timestamp del último fetch exitoso. Permite renderizar "Actualizado
   * hace X" en la toolbar — feedback de freshness que evita asumir data
   * stale tras dejar la pestaña abierta. El RelativeTimePipe se invalida
   * automáticamente por el TimeService global cada 60s.
   */
  private readonly _lastFetchedAt = signal<string | null>(null);
  protected readonly lastFetchedAt = this._lastFetchedAt.asReadonly();

  /**
   * Raw rows — todos los servicios. El sort default por severidad ya no
   * vive acá: lo aplica PrimeNG p-table built-in vía `[sortField]` /
   * `[sortOrder]` y los `pSortableColumn` declarados en cada th. Eso
   * permite al user re-ordenar por cualquier columna sin que pisemos su
   * elección desde el computed.
   */
  protected readonly allRows = computed<readonly ServiceUptimeRow[]>(() => {
    const list = this.servicesResource.value() ?? [];
    return list.map((svc) => buildRow(svc));
  });

  /**
   * Rows visibles tras aplicar filtros (Estado / Equipo).
   *
   * **Sort default**: aplicamos sort por `severityRank` asc en el computed
   * porque las mobile cards (md-) iteran este array directamente — sin
   * pSortableColumn ni intervención de PrimeNG. El desktop p-table tiene
   * `[sortField]="severityRank" [sortOrder]="1"` matching → idempotente
   * en el render inicial. Cuando user clickea otra columna en desktop,
   * PrimeNG re-sortea internamente; mobile sigue mostrando el orden por
   * severidad (consistente con expectativa "más urgente arriba").
   */
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
   * con label en español).
   */
  protected readonly healthOptions: {
    label: string;
    value: HealthState;
  }[] = [
    { label: 'Saludable', value: 'ok' },
    { label: 'Degradado', value: 'warn' },
    { label: 'Crítico', value: 'critical' },
    { label: 'Sin datos', value: 'unknown' },
  ];

  /**
   * Lista deduplicada de equipos para el `<p-columnFilter>` de Equipo.
   * Computado desde la data del fetch — refleja teams reales de la sesión.
   */
  protected readonly availableTeams = computed<string[]>(() => {
    const list = this.servicesResource.value() ?? [];
    return Array.from(new Set(list.map((s) => s.team))).sort();
  });

  /**
   * Passthrough config para `<p-columnFilter>` — aplica `.p-button-tonal`
   * al clear button del filter popup. Patrón Material 3 / Mercado Libre:
   * cuando hay 2 acciones (Limpiar + Aplicar), la secundaria va con bg
   * tonal del primary (no outlined neutro), reforzando jerarquía visual
   * sin gritar como un primary filled.
   *
   * **Por qué `root.class` y no solo `class`**: el slot `class` directo
   * en `ButtonPassThrough` aplica al HOST del `<p-button>` Angular
   * component, NO al `<button>` interno. La utility `.p-button-tonal`
   * (definida en `styles.scss`) matchea el `<button>` real — mismo
   * elemento que recibe la clase cuando se usa el patrón `styleClass`
   * en los demás módulos. `root.class` apunta al elemento correcto.
   *
   * Reusado en los 4 column filters para mantener consistency cross-columna.
   */
  protected readonly columnFilterPt = {
    pcFilterClearButton: { root: { class: 'p-button-tonal' } },
    /**
     * Botones agrupados a la derecha (no space-between default de
     * PrimeNG) con gap-2 (8px) entre ellos. Patrón Linear / Stripe /
     * GitHub / Notion / Vercel: filter actions como grupo
     * right-anchored — secondary ("Limpiar") a la izquierda del primary
     * ("Aplicar"), ambos al borde derecho del popup, con respiración
     * mínima entre ellos. Comunica "estas son las salidas del dialog"
     * como unidad, en lugar de presentarlos como alternativas
     * equivalentes.
     *
     * `!justify-end` con `!` modifier de Tailwind para sobreescribir
     * el `justify-content: space-between` que PrimeNG aplica por
     * default al `.p-datatable-filter-button-bar`. `gap-2` matchea
     * el spacing canónico del DS para action button groups (mismo
     * que customers form actions, preferences toolbar, etc.).
     */
    filterButtonBar: { class: '!justify-end gap-2' },
  };

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
   *   - con issues       → "X con incidentes" + warning amarillo
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

    const issues = list.filter((r) => r.service.health === 'critical' || r.service.health === 'warn').length;
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

    return {
      icon: 'fa-sharp-duotone fa-regular fa-triangle-exclamation text-yellow-500',
      label: issues === 1 ? '1 servicio con incidentes' : `${issues} servicios con incidentes`,
    };
  });

  constructor() {
    // Sync `_lastFetchedAt` con cada emisión exitosa del resource. La
    // condición chequea que haya valor Y que NO esté loading (durante
    // reload el value previo se mantiene mientras isLoading=true; recién
    // cuando termina el fetch el timestamp debe moverse).
    effect(() => {
      const val = this.servicesResource.value();
      if (val !== undefined && !this.servicesResource.isLoading()) {
        this._lastFetchedAt.set(new Date().toISOString());
      }
    });
  }

  protected retry(): void {
    // Guard contra reentry: si ya hay fetch en curso, no disparar otro.
    // El button no usa [loading]/[disabled] (ver comentario en template
    // sobre por qué — bug visual + tooltip rompido), así que el guard
    // protege a nivel handler en lugar de a nivel UI.
    if (this.servicesResource.isLoading()) return;
    this.servicesResource.reload();
  }

  protected viewDetail(serviceId: string): void {
    this.router.navigate(['/observability/services', serviceId]);
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
  protected segmentColor(state: HealthState): string {
    if (state === 'ok') return 'var(--p-green-500)';
    if (state === 'warn') return 'var(--p-yellow-500)';
    if (state === 'critical') return 'var(--p-red-500)';
    return 'var(--p-surface-400)';
  }

  // ─── Helpers exclusivos de la tabla "Variante PrimeNG built-in" ──────
  /**
   * Mapping HealthState → PrimeNG `<p-tag>` severity. unknown → secondary
   * (neutral, sin connotación positiva ni negativa) en lugar de no
   * exponer el chip — el user necesita saber que existe el row, solo que
   * está sin datos.
   */
  protected tagSeverity(state: HealthState): 'success' | 'warn' | 'danger' | 'secondary' {
    if (state === 'ok') return 'success';
    if (state === 'warn') return 'warn';
    if (state === 'critical') return 'danger';
    return 'secondary';
  }

  protected stateLabel(state: HealthState): string {
    return stateLabel(state);
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
// Lógica de generación de filas — pura, testeable, sin DI.
// ───────────────────────────────────────────────────────────────────────────

const segmentCache = new Map<string, readonly UptimeSegment[]>();
const rowCache = new Map<string, ServiceUptimeRow>();

/**
 * Build memoizado de la fila. Cache key incluye los inputs que afectan el
 * cómputo (`health`, `lastAlertAt`); cambios en otros campos del summary
 * no invalidan los segmentos.
 */
function buildRow(svc: ServiceSummary): ServiceUptimeRow {
  const cacheKey = `${svc.id}|${svc.health}|${svc.lastAlertAt ?? ''}|${svc.uptime30d.value}`;
  const cached = rowCache.get(cacheKey);
  if (cached) return cached;

  const segments = buildSegments(svc, SEGMENT_COUNT);
  const incidentCount = segments.filter((s) => s.state === 'warn' || s.state === 'critical').length;

  const row: ServiceUptimeRow = {
    service: svc,
    segments,
    incidentCount,
    summaryAriaLabel: buildAriaLabel(svc, incidentCount),
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
 * en distintos boots renderiza los mismos segmentos. `reload()` sin
 * cambios reales en data NO regenera 480 segmentos.
 */
function buildSegments(svc: ServiceSummary, n: number): readonly UptimeSegment[] {
  const cacheKey = `${svc.id}|${svc.health}|${svc.lastAlertAt ?? ''}|${svc.uptime30d.value}`;
  const cached = segmentCache.get(cacheKey);
  if (cached) return cached;

  const segments = computeSegments(svc, n);
  segmentCache.set(cacheKey, segments);
  return segments;
}

function computeSegments(svc: ServiceSummary, n: number): readonly UptimeSegment[] {
  const baseTime = anchorTime(svc);

  if (svc.health === 'unknown' || svc.uptime30d.value === 0) {
    return Array.from({ length: n }, (_, i) => makeSegment('unknown', segmentTimestamp(baseTime, n, i)));
  }

  const rand = seededRandom(`uptime-${svc.id}`);
  const uptime = svc.uptime30d.value;
  const incidentProb = (100 - uptime) / 100;
  const criticalRatio = Math.min(0.7, Math.max(0.2, incidentProb * 8));

  // Ventana de impacto de la última alerta: ±2 segmentos = ±24h.
  const alertTimeMs = svc.lastAlertAt ? new Date(svc.lastAlertAt).getTime() : null;
  const alertImpactRadius = SEGMENT_MS * 2;

  const result: UptimeSegment[] = [];
  for (let i = 0; i < n; i++) {
    const at = segmentTimestamp(baseTime, n, i);
    const r = rand();
    let state: HealthState;

    // Coerce: si está en la ventana de la alerta, refleja el health del
    // servicio. Esto hace que el último segmento (cerca de "ahora") matchee
    // con la línea "Última alerta hace X" de la columna vecina.
    if (alertTimeMs !== null && Math.abs(at - alertTimeMs) <= alertImpactRadius) {
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

/** Centro temporal del segmento `i` (de `n` totales) anclado a `baseTime`. */
function segmentTimestamp(baseTime: number, n: number, i: number): number {
  return baseTime - (n - 1 - i) * SEGMENT_MS;
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
    tooltip: `${day} ${range} · ${stateLabel(state)}`,
  };
}

function stateLabel(state: HealthState): string {
  if (state === 'ok') return 'Saludable';
  if (state === 'warn') return 'Degradado';
  if (state === 'critical') return 'Crítico';
  return 'Sin datos';
}

/**
 * Anclaje temporal UNIFORME para todos los servicios. Usamos la constante
 * `NOW` de mock-utils (capturada al import del módulo) — todos los bars
 * comparten el mismo "hoy" como punto de anclaje del último segmento.
 *
 * **Bug que resuelve**: la versión previa usaba `lastDeployAt` per-service
 * como ancla → cada bar tenía un "hoy" distinto, y los segmentos no se
 * alineaban temporalmente entre servicios. Visualmente sutil pero
 * incorrecto: la columna del último segmento debería representar la
 * misma "ventana de ahora" para todos.
 *
 * En producción real `NOW` vendría del request del backend (server clock)
 * para evitar clock skew client-side; acá vive en el mock.
 */
function anchorTime(_svc: ServiceSummary): number {
  return NOW;
}

/**
 * Aria label rico para el bar contenedor — keyboard / screen-reader users
 * obtienen el resumen numérico que los segments transmiten visualmente solo
 * por color. WCAG 1.4.1: la información no debe depender exclusivamente
 * del color.
 */
function buildAriaLabel(svc: ServiceSummary, incidents: number): string {
  if (svc.health === 'unknown') return `${svc.name}: sin datos de uptime registrados en los últimos 30 días`;

  const uptime = svc.uptime30d.value.toFixed(2);
  const base = `Uptime de ${svc.name} en los últimos 30 días: ${uptime}%`;
  if (incidents === 0) return `${base}, sin incidentes`;
  if (incidents === 1) return `${base}, 1 segmento con incidente`;
  return `${base}, ${incidents} segmentos con incidentes`;
}

function plural(n: number, singular: string, plural: string): string {
  return n === 1 ? singular : plural;
}
