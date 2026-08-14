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
import { SelectButton } from 'primeng/selectbutton';
import { Skeleton } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { ToggleSwitch } from 'primeng/toggleswitch';

import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { HealthBadgeComponent } from '../../../shared/components/health-badge/health-badge.component';
import {
  HEALTH_LABELS,
  HEALTH_STATES,
} from '../../../shared/components/health-badge/health-badge.tokens';
import { LoadErrorStateComponent } from '../../../shared/components/load-error-state/load-error-state.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { PillComponent } from '../../../shared/components/pill/pill.component';
import { RelativeTimePipe } from '../../../shared/pipes/relative-time.pipe';
import { debouncedSearch } from '../../../shared/utils/debounced-search';
import { trackedResource } from '../../../shared/utils/tracked-resource';
import type {
  HealthState,
  ServiceSummary,
} from '../models/observability.interface';
import { ObservabilityMockService } from '../services/observability-mock.service';
import { formatPercent } from '../utils/format';

const NG_MODULES = [CommonModule, FormsModule, RouterLink];
const PRIME_MODULES = [ButtonModule, InputTextModule, TableModule];
const PRIME_STANDALONE = [
  IconField,
  InputIcon,
  MultiSelect,
  SelectButton,
  Skeleton,
  ToggleSwitch,
];
const LOCAL_COMPONENTS = [
  EmptyStateComponent,
  HealthBadgeComponent,
  LoadErrorStateComponent,
  PageHeaderComponent,
  PillComponent,
];
const LOCAL_PIPES = [RelativeTimePipe];

interface ViewModeOption {
  readonly label: string;
  readonly value: 'grid' | 'table';
  readonly icon: string;
}

@Component({
  selector: 'app-obs-services',
  imports: [
    NG_MODULES,
    PRIME_MODULES,
    PRIME_STANDALONE,
    LOCAL_COMPONENTS,
    LOCAL_PIPES,
  ],
  templateUrl: './obs-services.component.html',
  styleUrl: './obs-services.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'flex-1 h-full overflow-y-auto overflow-x-clip overflow-hidden border border-surface rounded-2xl p-6',
  },
})
export class ObsServicesComponent {
  private api = inject(ObservabilityMockService);

  /**
   * `trackedResource()` (versión parcial del pattern de users / roles /
   * customers / obs-uptime): acá consumimos `value/loading/loadError/
   * retry`; `rows` y `lastFetchedAt` quedan sin uso porque esta vista
   * filtra client-side y no muestra freshness en toolbar.
   */
  private readonly servicesData = trackedResource<ServiceSummary>(() =>
    this.api.getServices(),
  );
  protected readonly services = this.servicesData.value;
  protected readonly loading = this.servicesData.loading;
  protected readonly loadError = this.servicesData.loadError;

  protected retry(): void {
    this.servicesData.retry();
  }

  // ─── Filters ────────────────────────────────────────────────────────────
  //
  // NOTA de triage: el panel de filtros (search + multiselects + toggle
  // + "Limpiar") se repite casi idéntico en obs-alerts. NO se extrajo
  // como componente compartido — 2 copias con projection pesada no lo
  // justifican aún. Si aparece una tercera vista con el mismo panel,
  // extraer entonces.
  /**
   * `input` (inmediato, bindeado al `<input>`) / `term` (debounced
   * 200ms, consumido por `filteredServices`) — ver
   * `shared/utils/debounced-search.ts`.
   */
  private readonly search = debouncedSearch();
  protected readonly searchInput = this.search.input;
  protected readonly searchTerm = this.search.term;
  // Arrays mutables porque PrimeNG p-multiselect ngModel les hace push/pop
  // directo. Los `.includes()` siguen funcionando igual.
  protected readonly selectedTeams = signal<string[]>([]);
  protected readonly selectedHealth = signal<HealthState[]>([]);
  protected readonly onlyMine = signal<boolean>(false);

  // PrimeNG components consumen `T[]` mutable (no `readonly T[]`). Mantenemos
  // los datos del modelo como readonly (immutability good practice) y exponemos
  // copias mutables en la frontera del template via spread o slice.
  protected readonly availableTeams = computed<string[]>(() => {
    const list = this.services() ?? [];
    return Array.from(new Set(list.map((s) => s.team))).sort();
  });

  // Options derivadas del vocabulario compartido de health-badge.tokens.ts
  // — mismo mapping (label/orden) que el <app-health-badge> y obs-uptime.
  protected readonly healthOptions: { label: string; value: HealthState }[] =
    HEALTH_STATES.map((value) => ({ label: HEALTH_LABELS[value], value }));

  protected readonly viewMode = signal<'grid' | 'table'>('grid');
  protected readonly viewModeOptions: ViewModeOption[] = [
    { label: 'Grid', value: 'grid', icon: 'fa-sharp fa-regular fa-grid-2' },
    { label: 'Tabla', value: 'table', icon: 'fa-sharp fa-regular fa-table' },
  ];

  protected readonly filteredServices = computed<ServiceSummary[]>(() => {
    const list = this.services() ?? [];
    const q = this.searchTerm().trim().toLowerCase();
    const teams = this.selectedTeams();
    const healths = this.selectedHealth();
    const mine = this.onlyMine();
    return list.filter((svc) => {
      if (q) {
        const hay = `${svc.name} ${svc.slug} ${svc.team} ${svc.tags.join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (teams.length > 0 && !teams.includes(svc.team)) return false;
      if (healths.length > 0 && !healths.includes(svc.health)) return false;
      if (mine && !['E-commerce', 'Plataforma'].includes(svc.team)) return false;
      return true;
    });
  });

  protected readonly resultCount = computed(() => this.filteredServices().length);

  /** Skeleton cards del loading state — mismo patrón que obs-uptime. */
  protected readonly skeletonPlaceholders = [0, 1, 2, 3, 4, 5];

  protected formatPercent(v: number): string {
    return formatPercent(v);
  }

  protected resetFilters(): void {
    this.searchInput.set('');
    this.selectedTeams.set([]);
    this.selectedHealth.set([]);
    this.onlyMine.set(false);
  }
}
