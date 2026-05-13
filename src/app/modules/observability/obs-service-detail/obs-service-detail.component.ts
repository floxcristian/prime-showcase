import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { Avatar } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { Skeleton } from 'primeng/skeleton';
import { TabsModule } from 'primeng/tabs';
import { Timeline } from 'primeng/timeline';
import { TooltipModule } from 'primeng/tooltip';

import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { HealthBadgeComponent } from '../../../shared/components/health-badge/health-badge.component';
import { MetricCardComponent } from '../../../shared/components/metric-card/metric-card.component';
import { PillComponent } from '../../../shared/components/pill/pill.component';
import { RelativeTimePipe } from '../../../shared/pipes/relative-time.pipe';
import { ObservabilityMockService } from '../services/observability-mock.service';

const NG_MODULES = [CommonModule, RouterLink];
const PRIME_MODULES = [ButtonModule, TabsModule, TooltipModule];
const PRIME_STANDALONE = [Avatar, Skeleton, Timeline];
const LOCAL_COMPONENTS = [EmptyStateComponent, HealthBadgeComponent, MetricCardComponent, PillComponent];
const LOCAL_PIPES = [RelativeTimePipe];

type DetailTab = 'health' | 'errors' | 'performance' | 'deploys';

@Component({
  selector: 'app-obs-service-detail',
  imports: [NG_MODULES, PRIME_MODULES, PRIME_STANDALONE, LOCAL_COMPONENTS, LOCAL_PIPES],
  templateUrl: './obs-service-detail.component.html',
  styleUrl: './obs-service-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'flex-1 h-full overflow-y-auto pb-0.5',
  },
})
export class ObsServiceDetailComponent {
  private api = inject(ObservabilityMockService);
  private router = inject(Router);

  /** id de la ruta — bound automáticamente via withComponentInputBinding(). */
  readonly id = input.required<string>();

  /**
   * `rxResource` re-fetcha automáticamente cuando `request()` cambia. El
   * `value()` es `Signal<ServiceDetail | undefined>`. Cuando migremos a HTTP
   * real, sustituir por `httpResource` (mismo shape pero sin la fachada).
   */
  protected readonly serviceResource = rxResource({
    params: () => ({ id: this.id() }),
    stream: ({ params }) => this.api.getServiceDetail(params.id),
  });

  protected readonly service = this.serviceResource.value;
  protected readonly loading = computed(() => this.serviceResource.isLoading());
  protected readonly loadError = computed(() => this.serviceResource.error());

  protected retry(): void {
    this.serviceResource.reload();
  }

  protected backToList(): void {
    this.router.navigate(['/observability/services']);
  }

  protected readonly activeTab = signal<DetailTab>('health');

  protected formatPercent(v: number): string {
    return `${v.toFixed(2)}%`;
  }

  protected formatLatency(v: number): string {
    return `${v.toLocaleString()}ms`;
  }

  protected deployIcon(status: 'success' | 'failed' | 'rolled-back'): string {
    if (status === 'success') return 'fa-sharp fa-regular fa-circle-check';
    if (status === 'failed') return 'fa-sharp fa-regular fa-circle-xmark';
    return 'fa-sharp fa-regular fa-arrow-rotate-left';
  }

  protected deployStatusLabel(status: 'success' | 'failed' | 'rolled-back'): string {
    if (status === 'success') return 'Exitoso';
    if (status === 'failed') return 'Fallido';
    return 'Revertido';
  }
}
