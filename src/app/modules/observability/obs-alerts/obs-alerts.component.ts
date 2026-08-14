import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelect } from 'primeng/multiselect';
import { Skeleton } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { ToggleSwitch } from 'primeng/toggleswitch';

import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { LoadErrorStateComponent } from '../../../shared/components/load-error-state/load-error-state.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { SeverityChipComponent } from '../../../shared/components/severity-chip/severity-chip.component';
import {
  ALERT_SEVERITIES,
  ALERT_SEVERITY_LABELS,
} from '../../../shared/components/severity-chip/severity-chip.tokens';
import { StatusChipComponent } from '../../../shared/components/status-chip/status-chip.component';
import {
  ALERT_STATUS_LABELS,
  ALERT_STATUSES,
} from '../../../shared/components/status-chip/status-chip.tokens';
import { RelativeTimePipe } from '../../../shared/pipes/relative-time.pipe';
import { debouncedSearch } from '../../../shared/utils/debounced-search';
import { trackedResource } from '../../../shared/utils/tracked-resource';
import type {
  AlertSeverity,
  AlertStatus,
  AlertSummary,
} from '../models/observability.interface';
import { ObservabilityMockService } from '../services/observability-mock.service';

const NG_MODULES = [CommonModule, FormsModule, RouterLink];
const PRIME_MODULES = [ButtonModule, InputTextModule, TableModule];
const PRIME_STANDALONE = [IconField, InputIcon, MultiSelect, Skeleton, ToggleSwitch];
const LOCAL_COMPONENTS = [
  EmptyStateComponent,
  LoadErrorStateComponent,
  PageHeaderComponent,
  SeverityChipComponent,
  StatusChipComponent,
];
const LOCAL_PIPES = [RelativeTimePipe];

@Component({
  selector: 'app-obs-alerts',
  imports: [
    NG_MODULES,
    PRIME_MODULES,
    PRIME_STANDALONE,
    LOCAL_COMPONENTS,
    LOCAL_PIPES,
  ],
  templateUrl: './obs-alerts.component.html',
  styleUrl: './obs-alerts.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'flex-1 h-full overflow-y-auto overflow-x-clip overflow-hidden border border-surface rounded-2xl p-6',
  },
})
export class ObsAlertsComponent {
  private api = inject(ObservabilityMockService);

  /**
   * `trackedResource()` (versión parcial del pattern de users / roles /
   * customers / obs-uptime): acá consumimos `value/loading/loadError/
   * retry`; `rows` y `lastFetchedAt` quedan sin uso porque esta vista
   * filtra client-side y no muestra freshness en toolbar.
   */
  private readonly alertsData = trackedResource<AlertSummary>(() =>
    this.api.getAlerts(),
  );
  protected readonly alerts = this.alertsData.value;
  protected readonly loading = this.alertsData.loading;
  protected readonly loadError = this.alertsData.loadError;

  protected retry(): void {
    this.alertsData.retry();
  }

  // Filtros — arrays mutables para compatibilidad con p-multiselect ngModel.
  //
  // NOTA de triage: el panel de filtros (search + multiselects + toggle
  // + "Limpiar") se repite casi idéntico en obs-services. NO se extrajo
  // como componente compartido — 2 copias con projection pesada no lo
  // justifican aún. Si aparece una tercera vista con el mismo panel,
  // extraer entonces.
  /**
   * `input` (inmediato, bindeado al `<input>`) / `term` (debounced
   * 200ms, consumido por `filtered`) — ver
   * `shared/utils/debounced-search.ts`.
   */
  private readonly search = debouncedSearch();
  protected readonly searchInput = this.search.input;
  protected readonly searchTerm = this.search.term;
  protected readonly selectedSeverities = signal<AlertSeverity[]>([]);
  protected readonly selectedStatuses = signal<AlertStatus[]>([]);
  protected readonly onlyUnacked = signal<boolean>(false);

  // Options derivadas del vocabulario compartido de los chips
  // (`severity-chip.tokens.ts` / `status-chip.tokens.ts`) — mismo
  // criterio que las health options de obs-services/obs-uptime sobre
  // `health-badge.tokens.ts`.
  protected readonly severityOptions: { label: string; value: AlertSeverity }[] =
    ALERT_SEVERITIES.map((value) => ({
      label: ALERT_SEVERITY_LABELS[value],
      value,
    }));

  protected readonly statusOptions: { label: string; value: AlertStatus }[] =
    ALERT_STATUSES.map((value) => ({
      label: ALERT_STATUS_LABELS[value],
      value,
    }));

  protected readonly filtered = computed<AlertSummary[]>(() => {
    const list = this.alerts() ?? [];
    const q = this.searchTerm().trim().toLowerCase();
    const sevs = this.selectedSeverities();
    const stats = this.selectedStatuses();
    const unackedOnly = this.onlyUnacked();
    return list.filter((a) => {
      if (q) {
        const hay = `${a.title} ${a.serviceName} ${a.description}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (sevs.length > 0 && !sevs.includes(a.severity)) return false;
      if (stats.length > 0 && !stats.includes(a.status)) return false;
      if (unackedOnly && a.status !== 'firing') return false;
      return true;
    });
  });

  protected readonly resultCount = computed(() => this.filtered().length);

  protected resetFilters(): void {
    this.searchInput.set('');
    this.selectedSeverities.set([]);
    this.selectedStatuses.set([]);
    this.onlyUnacked.set(false);
  }
}
