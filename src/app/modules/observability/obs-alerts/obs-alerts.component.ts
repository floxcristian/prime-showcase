import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { rxResource, toObservable, toSignal } from '@angular/core/rxjs-interop';
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
import { debounceTime } from 'rxjs';

import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { SeverityChipComponent } from '../../../shared/components/severity-chip/severity-chip.component';
import { StatusChipComponent } from '../../../shared/components/status-chip/status-chip.component';
import { RelativeTimePipe } from '../../../shared/pipes/relative-time.pipe';
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
   * `rxResource` en vez de `toSignal` crudo — expone `error()` para la rama
   * de retry. Ref: [time.service.ts] mismo patrón para signal-first + error
   * recoverable.
   */
  protected readonly alertsResource = rxResource({
    stream: () => this.api.getAlerts(),
  });
  protected readonly alerts = this.alertsResource.value;
  protected readonly loading = computed(() => this.alertsResource.isLoading());
  protected readonly loadError = computed(() => this.alertsResource.error());

  protected retry(): void {
    this.alertsResource.reload();
  }

  // Filtros — arrays mutables para compatibilidad con p-multiselect ngModel.
  /**
   * `searchInput` (immediate) / `searchTerm` (debounced 200ms). Typing local
   * fluido + filtrado cost-effective sobre listas grandes.
   */
  protected readonly searchInput = signal<string>('');
  protected readonly searchTerm = toSignal(
    toObservable(this.searchInput).pipe(debounceTime(200)),
    { initialValue: '' },
  );
  protected readonly selectedSeverities = signal<AlertSeverity[]>([]);
  protected readonly selectedStatuses = signal<AlertStatus[]>([]);
  protected readonly onlyUnacked = signal<boolean>(false);

  protected readonly severityOptions: { label: string; value: AlertSeverity }[] = [
    { label: 'Crítico', value: 'critical' },
    { label: 'Advertencia', value: 'warn' },
    { label: 'Info', value: 'info' },
  ];

  protected readonly statusOptions: { label: string; value: AlertStatus }[] = [
    { label: 'Activa', value: 'firing' },
    { label: 'Acusada', value: 'acknowledged' },
    { label: 'Resuelta', value: 'resolved' },
    { label: 'Silenciada', value: 'silenced' },
  ];

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
