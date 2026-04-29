import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { Skeleton } from 'primeng/skeleton';
import { Tag } from 'primeng/tag';
import { Timeline } from 'primeng/timeline';

import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { SeverityChipComponent } from '../../../shared/components/severity-chip/severity-chip.component';
import { StatusChipComponent } from '../../../shared/components/status-chip/status-chip.component';
import { RelativeTimePipe } from '../../../shared/pipes/relative-time.pipe';
import { AcknowledgementsStore } from '../services/acknowledgements.store';
import { ObservabilityMockService } from '../services/observability-mock.service';

const NG_MODULES = [CommonModule, RouterLink];
const PRIME_MODULES = [ButtonModule];
const PRIME_STANDALONE = [Skeleton, Tag, Timeline];
const LOCAL_COMPONENTS = [
  EmptyStateComponent,
  SeverityChipComponent,
  StatusChipComponent,
];
const LOCAL_PIPES = [RelativeTimePipe];

@Component({
  selector: 'app-obs-alert-detail',
  imports: [
    NG_MODULES,
    PRIME_MODULES,
    PRIME_STANDALONE,
    LOCAL_COMPONENTS,
    LOCAL_PIPES,
  ],
  templateUrl: './obs-alert-detail.component.html',
  styleUrl: './obs-alert-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'flex-1 h-full overflow-y-auto pb-0.5',
  },
})
export class ObsAlertDetailComponent {
  private api = inject(ObservabilityMockService);
  private acks = inject(AcknowledgementsStore);
  private router = inject(Router);

  readonly id = input.required<string>();

  protected readonly alertResource = rxResource({
    params: () => ({ id: this.id() }),
    stream: ({ params }) => this.api.getAlertDetail(params.id),
  });

  protected readonly alert = this.alertResource.value;
  protected readonly loading = computed(() => this.alertResource.isLoading());
  protected readonly loadError = computed(() => this.alertResource.error());

  /**
   * Acked derivado del store global — persiste al navegar away+back dentro
   * de la sesión. Antes era un `signal<boolean>` local que se perdía al
   * desmontar el componente, lo que contradecía el UX compromisivo del ack.
   */
  protected readonly acked = computed(() => {
    const a = this.alert();
    return a ? this.acks.isAcked(a.id) : false;
  });

  protected ack(): void {
    const a = this.alert();
    if (a) this.acks.ack(a.id);
  }

  protected retry(): void {
    this.alertResource.reload();
  }

  protected backToList(): void {
    this.router.navigate(['/observability/alerts']);
  }

  protected actionLabel(action: string): string {
    if (action === 'fired') return 'Disparó';
    if (action === 'acknowledged') return 'Acusó';
    if (action === 'resolved') return 'Resolvió';
    if (action === 'silenced') return 'Silenció';
    return 'Comentó';
  }

  protected actionIcon(action: string): string {
    if (action === 'fired') return 'fa-sharp fa-regular fa-bell';
    if (action === 'acknowledged') return 'fa-sharp fa-regular fa-circle-check';
    if (action === 'resolved') return 'fa-sharp fa-regular fa-check-double';
    if (action === 'silenced') return 'fa-sharp fa-regular fa-bell-slash';
    return 'fa-sharp fa-regular fa-message';
  }

  /**
   * Mapea el nivel de log a `p-tag[severity]`. Patrón Datadog/Sentry:
   * el nivel es un *chip* semántico, no un color de texto arbitrario — así
   * el color vive en el theme (Aura maneja dark mode) y respetamos tokens.
   */
  protected logTagSeverity(
    level: 'error' | 'warn' | 'info',
  ): 'danger' | 'warn' | 'info' {
    if (level === 'error') return 'danger';
    if (level === 'warn') return 'warn';
    return 'info';
  }
}
