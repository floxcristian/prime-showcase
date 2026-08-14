import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { Skeleton } from 'primeng/skeleton';
import { TabsModule } from 'primeng/tabs';

import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { LoadErrorStateComponent } from '../../../shared/components/load-error-state/load-error-state.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { PillComponent } from '../../../shared/components/pill/pill.component';
import { SeverityChipComponent } from '../../../shared/components/severity-chip/severity-chip.component';
import { RelativeTimePipe } from '../../../shared/pipes/relative-time.pipe';
import { trackedResource } from '../../../shared/utils/tracked-resource';
import type {
  InboxBucket,
  InboxItem,
} from '../models/observability.interface';
import { AcknowledgementsStore } from '../services/acknowledgements.store';
import { ObservabilityMockService } from '../services/observability-mock.service';

const NG_MODULES = [CommonModule, RouterLink];
const PRIME_MODULES = [ButtonModule, TabsModule];
const PRIME_STANDALONE = [Skeleton];
const LOCAL_COMPONENTS = [
  EmptyStateComponent,
  LoadErrorStateComponent,
  PageHeaderComponent,
  PillComponent,
  SeverityChipComponent,
];
const LOCAL_PIPES = [RelativeTimePipe];

interface BucketView {
  readonly key: InboxBucket;
  readonly title: string;
  readonly icon: string;
  readonly emptyTitle: string;
  readonly emptyDescription: string;
  readonly emptyIcon: string;
  readonly items: readonly InboxItem[];
}

@Component({
  selector: 'app-obs-inbox',
  imports: [
    NG_MODULES,
    PRIME_MODULES,
    PRIME_STANDALONE,
    LOCAL_COMPONENTS,
    LOCAL_PIPES,
  ],
  templateUrl: './obs-inbox.component.html',
  styleUrl: './obs-inbox.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'flex-1 h-full overflow-y-auto overflow-x-clip overflow-hidden border border-surface rounded-2xl p-6',
  },
})
export class ObsInboxComponent {
  private api = inject(ObservabilityMockService);
  private acks = inject(AcknowledgementsStore);

  /**
   * `trackedResource()` (versión parcial del pattern de users / roles /
   * customers / obs-uptime): acá consumimos `value/loading/loadError/
   * retry`; `rows` y `lastFetchedAt` quedan sin uso porque esta vista
   * agrupa client-side y no muestra freshness en toolbar.
   */
  private readonly inboxData = trackedResource<InboxItem>(() =>
    this.api.getInbox(),
  );
  protected readonly inbox = this.inboxData.value;
  protected readonly loading = this.inboxData.loading;
  protected readonly loadError = this.inboxData.loadError;

  protected retry(): void {
    this.inboxData.retry();
  }

  /** Skeleton rows del loading state — mismo patrón que obs-uptime. */
  protected readonly skeletonPlaceholders = [0, 1, 2, 3];

  protected readonly buckets = computed<readonly BucketView[]>(() => {
    const items = this.inbox() ?? [];
    return [
      {
        key: 'now',
        title: 'Ahora',
        icon: 'fa-sharp fa-regular fa-bell-on',
        emptyTitle: 'Todo en orden',
        emptyDescription: 'Nada requiere tu atención inmediata.',
        emptyIcon: 'fa-square-check',
        items: items.filter((i) => i.bucket === 'now'),
      },
      {
        key: 'today',
        title: 'Hoy',
        icon: 'fa-sharp fa-regular fa-calendar-day',
        emptyTitle: 'Sin pendientes para hoy',
        emptyDescription: 'Cuando algo necesite revisión aparecerá acá.',
        emptyIcon: 'fa-calendar-check',
        items: items.filter((i) => i.bucket === 'today'),
      },
      {
        key: 'info',
        title: 'Informativo',
        icon: 'fa-sharp fa-regular fa-circle-info',
        emptyTitle: 'Sin novedades',
        emptyDescription: 'Deploys, alertas resueltas y cambios aparecen acá.',
        emptyIcon: 'fa-circle-info',
        items: items.filter((i) => i.bucket === 'info'),
      },
    ];
  });

  protected isAcked(item: InboxItem): boolean {
    return item.acknowledged || this.acks.isAcked(item.id);
  }

  protected ackItem(item: InboxItem): void {
    this.acks.ack(item.id);
  }

  protected typeIcon(type: InboxItem['type']): string {
    switch (type) {
      case 'error':
        return 'fa-sharp fa-regular fa-bug';
      case 'alert':
        return 'fa-sharp fa-regular fa-bell';
      case 'uptime':
        return 'fa-sharp fa-regular fa-heart-pulse';
      case 'deploy':
        return 'fa-sharp fa-regular fa-rocket-launch';
      case 'trend':
        return 'fa-sharp fa-regular fa-chart-line';
    }
  }
}
