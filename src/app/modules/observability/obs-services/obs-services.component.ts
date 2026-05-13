import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource, toObservable, toSignal } from '@angular/core/rxjs-interop';
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
import { debounceTime } from 'rxjs';

import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { HealthBadgeComponent } from '../../../shared/components/health-badge/health-badge.component';
import { PillComponent } from '../../../shared/components/pill/pill.component';
import { RelativeTimePipe } from '../../../shared/pipes/relative-time.pipe';
import type { HealthState, ServiceSummary } from '../models/observability.interface';
import { ObservabilityMockService } from '../services/observability-mock.service';

const NG_MODULES = [CommonModule, FormsModule, RouterLink];
const PRIME_MODULES = [ButtonModule, InputTextModule, TableModule];
const PRIME_STANDALONE = [IconField, InputIcon, MultiSelect, SelectButton, Skeleton, ToggleSwitch];
const LOCAL_COMPONENTS = [EmptyStateComponent, HealthBadgeComponent, PillComponent];
const LOCAL_PIPES = [RelativeTimePipe];

interface ViewModeOption {
  readonly label: string;
  readonly value: 'grid' | 'table';
  readonly icon: string;
}

@Component({
  selector: 'app-obs-services',
  imports: [NG_MODULES, PRIME_MODULES, PRIME_STANDALONE, LOCAL_COMPONENTS, LOCAL_PIPES],
  templateUrl: './obs-services.component.html',
  styleUrl: './obs-services.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'flex-1 h-full overflow-y-auto overflow-x-clip overflow-hidden border border-surface rounded-2xl p-6',
  },
})
export class ObsServicesComponent {
  private api = inject(ObservabilityMockService);

  /**
   * `rxResource` expone `value/isLoading/error` de forma reactiva. Permite
   * renderizar la rama de error con retry CTA — algo que `toSignal` sin
   * wrap no ofrece (y obligaba a swallow silencioso del error).
   */
  protected readonly servicesResource = rxResource({
    stream: () => this.api.getServices(),
  });
  protected readonly services = this.servicesResource.value;
  protected readonly loading = computed(() => this.servicesResource.isLoading());
  protected readonly loadError = computed(() => this.servicesResource.error());

  protected retry(): void {
    this.servicesResource.reload();
  }

  // ─── Filters ────────────────────────────────────────────────────────────
  /**
   * `searchInput` es el valor inmediato bindeado al `<input>` (feedback
   * instantáneo al typing). `searchTerm` es la versión debounceada que
   * consume `filteredServices` — evita re-filtrar en cada keystroke sobre
   * listas grandes. Patrón Algolia/Linear: typing local, query debounced.
   */
  protected readonly searchInput = signal<string>('');
  protected readonly searchTerm = toSignal(toObservable(this.searchInput).pipe(debounceTime(200)), {
    initialValue: '',
  });
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

  protected readonly healthOptions: { label: string; value: HealthState }[] = [
    { label: 'Saludable', value: 'ok' },
    { label: 'Degradado', value: 'warn' },
    { label: 'Crítico', value: 'critical' },
    { label: 'Sin datos', value: 'unknown' },
  ];

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

  protected formatPercent(v: number): string {
    return `${v.toFixed(2)}%`;
  }

  protected resetFilters(): void {
    this.searchInput.set('');
    this.selectedTeams.set([]);
    this.selectedHealth.set([]);
    this.onlyMine.set(false);
  }
}
