import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';

import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { PillComponent } from '../../../shared/components/pill/pill.component';
import { RelativeTimePipe } from '../../../shared/pipes/relative-time.pipe';
import { TimeService } from '../../../shared/services/time.service';
import { minutesAgo, seededRandom } from '../mocks/mock-utils';
import { SERVICES_MOCK } from '../mocks/services-mock';

type NotifChannel = 'push' | 'email' | 'in-app';
type NotifStatus = 'delivered' | 'failed' | 'pending';

interface NotifEntry {
  readonly id: string;
  readonly at: string;
  readonly channel: NotifChannel;
  readonly serviceId: string;
  readonly serviceName: string;
  readonly title: string;
  readonly status: NotifStatus;
  readonly errorReason?: string;
}

const CHANNEL_META: Record<
  NotifChannel,
  { readonly label: string; readonly icon: string }
> = {
  push: { label: 'Push', icon: 'fa-sharp fa-regular fa-mobile' },
  email: { label: 'Email', icon: 'fa-sharp fa-regular fa-envelope' },
  'in-app': { label: 'In-app', icon: 'fa-sharp fa-regular fa-bell' },
};

const STATUS_META: Record<
  NotifStatus,
  { readonly label: string; readonly icon: string; readonly tone: 'ok' | 'fail' | 'pending' }
> = {
  delivered: {
    label: 'Entregado',
    icon: 'fa-sharp fa-regular fa-check',
    tone: 'ok',
  },
  failed: {
    label: 'Falló',
    icon: 'fa-sharp fa-regular fa-circle-xmark',
    tone: 'fail',
  },
  pending: {
    label: 'Pendiente',
    icon: 'fa-sharp fa-regular fa-clock',
    tone: 'pending',
  },
};

const TITLES = [
  'Error rate cruzó 4% en el último 5m',
  'Nuevo deploy en producción',
  'Uptime check fallando hace 8 min',
  'p99 latency degradándose últimas 30m',
  'Alerta resuelta: queue lag normalizado',
  'Memory pressure recuperada',
];

/**
 * Historial de notificaciones — últimos 30 días por canal.
 *
 * MVP funcional: tabla paginada con filtros básicos por canal y botón de
 * "envío de prueba". Los datos son mock determinístico (40 entries
 * generadas con `seededRandom`). En producción este componente consumiría
 * `GET /me/notifications?range=30d` con paginación servidor.
 */
@Component({
  selector: 'app-obs-notifications-history',
  imports: [
    CommonModule,
    ButtonModule,
    TableModule,
    EmptyStateComponent,
    PillComponent,
    RelativeTimePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'flex-1 h-full overflow-y-auto overflow-x-clip overflow-hidden border border-surface rounded-2xl p-6',
  },
  template: `
    <!-- Header — patrón compartido con CRM > Clientes -->
    <div class="flex items-start gap-2 justify-between flex-wrap mb-6">
      <div class="min-w-0">
        <h1 class="text-2xl leading-8 text-color font-medium">
          Historial de notificaciones
        </h1>
        <div class="mt-1 leading-6 text-muted-color">
          Lo que te llegó por cada canal en los últimos 30 días. Útil para
          verificar entregas o entender por qué falló una.
        </div>
      </div>
      <div class="flex gap-2 whitespace-nowrap">
        <p-button
          label="Enviar prueba"
          severity="secondary"
          [outlined]="true"
          icon="fa-sharp fa-regular fa-paper-plane"
        />
      </div>
    </div>

    <!-- Filtro por canal: chips toggle (active = filled, inactive = outlined) -->
    <div class="border border-surface rounded-2xl p-4 mb-6">
      <div class="flex items-center gap-3 flex-wrap">
        <span class="text-color font-semibold leading-6">Canal:</span>
        <button
          type="button"
          (click)="setChannelFilter('all')"
          [attr.aria-pressed]="channelFilter() === 'all'"
          class="px-4 py-1 rounded-lg flex items-center gap-2 cursor-pointer hover:bg-emphasis transition-colors"
          [ngClass]="{
            'text-color bg-emphasis': channelFilter() === 'all',
            'text-muted-color bg-transparent': channelFilter() !== 'all'
          }"
        >
          <span class="font-medium">Todos</span>
          <app-pill>{{ entries().length }}</app-pill>
        </button>
        @for (ch of channels; track ch) {
          <button
            type="button"
            (click)="setChannelFilter(ch)"
            [attr.aria-pressed]="channelFilter() === ch"
            class="px-4 py-1 rounded-lg flex items-center gap-2 cursor-pointer hover:bg-emphasis transition-colors"
            [ngClass]="{
              'text-color bg-emphasis': channelFilter() === ch,
              'text-muted-color bg-transparent': channelFilter() !== ch
            }"
          >
            <i [class]="channelIcon(ch)" aria-hidden="true"></i>
            <span class="font-medium">{{ channelLabel(ch) }}</span>
            <app-pill>{{ countByChannel(ch) }}</app-pill>
          </button>
        }
      </div>
    </div>

    @if (filtered().length === 0) {
      <app-empty-state
        icon="fa-bell-slash"
        title="Sin notificaciones"
        description="No hay registros para el filtro actual."
        [bordered]="true"
        actionLabel="Mostrar todos los canales"
        actionIcon="fa-sharp fa-regular fa-rotate-left"
        (actionClick)="setChannelFilter('all')"
      />
    } @else {
      <p-table
        [value]="$any(filtered())"
        [paginator]="true"
        [rows]="20"
        [rowsPerPageOptions]="[20, 50, 100]"
        [tableStyle]="{ 'min-width': '50rem' }"
      >
        <ng-template #header>
          <tr>
            <!--
              whitespace-nowrap defensivo: invariante del DS — los headers
              de tabla nunca wrappean (Linear/Stripe/Datadog).
            -->
            <th class="w-32 whitespace-nowrap">Cuándo</th>
            <th class="w-28 whitespace-nowrap">Canal</th>
            <th class="w-56 whitespace-nowrap">Servicio</th>
            <th class="whitespace-nowrap">Título</th>
            <th class="w-32 whitespace-nowrap">Estado</th>
          </tr>
        </ng-template>
        <ng-template #body let-n>
          <tr>
            <td>
              <span class="text-muted-color text-sm">{{
                n.at | relativeTime
              }}</span>
            </td>
            <td>
              <div class="flex items-center gap-2">
                <i
                  [class]="channelIcon(n.channel)"
                  class="text-color"
                  aria-hidden="true"
                ></i>
                <span class="text-color">{{ channelLabel(n.channel) }}</span>
              </div>
            </td>
            <td>
              <span class="text-color font-medium">{{ n.serviceName }}</span>
            </td>
            <td>
              <span class="text-color line-clamp-1">{{ n.title }}</span>
              @if (n.errorReason) {
                <div class="text-xs text-muted-color leading-4 mt-1">
                  {{ n.errorReason }}
                </div>
              }
            </td>
            <td>
              <app-pill [icon]="statusIcon(n.status)">
                {{ statusLabel(n.status) }}
              </app-pill>
            </td>
          </tr>
        </ng-template>
      </p-table>
    }
  `,
})
export class ObsNotificationsHistoryComponent {
  // Time service inyectado para invalidar el RelativeTimePipe en el template
  // (hereda el tick global; sin él los timestamps de la tabla quedan stale).
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- consumido por el pipe en el template via DI.
  private readonly time = inject(TimeService);

  protected readonly channels: readonly NotifChannel[] = ['push', 'email', 'in-app'];

  protected channelIcon(c: NotifChannel): string {
    return CHANNEL_META[c].icon;
  }
  protected channelLabel(c: NotifChannel): string {
    return CHANNEL_META[c].label;
  }
  protected statusIcon(s: NotifStatus): string {
    return STATUS_META[s].icon;
  }
  protected statusLabel(s: NotifStatus): string {
    return STATUS_META[s].label;
  }

  protected readonly entries = signal<readonly NotifEntry[]>(buildHistory(40));
  protected readonly channelFilter = signal<NotifChannel | 'all'>('all');

  protected readonly filtered = computed<readonly NotifEntry[]>(() => {
    const f = this.channelFilter();
    if (f === 'all') return this.entries();
    return this.entries().filter((e) => e.channel === f);
  });

  protected setChannelFilter(value: NotifChannel | 'all'): void {
    this.channelFilter.set(value);
  }

  protected countByChannel(ch: NotifChannel): number {
    return this.entries().filter((e) => e.channel === ch).length;
  }
}

/**
 * Genera N notificaciones determinísticas — seed fija "notif-history" para
 * estabilidad across navigations. Distribución realista:
 *   - 70% delivered, 20% pending, 10% failed
 *   - canales rotan en ciclo
 *   - timestamps decrecientes (la primera es la más reciente)
 */
function buildHistory(n: number): readonly NotifEntry[] {
  const rand = seededRandom('notif-history');
  const channels: readonly NotifChannel[] = ['push', 'email', 'in-app'];
  const failureReasons = [
    'Push token inválido o revocado',
    'SMTP relay timeout',
    'Device offline > 24h',
  ];
  return Array.from({ length: n }, (_, i) => {
    const r = rand();
    const status: NotifStatus =
      r < 0.7 ? 'delivered' : r < 0.9 ? 'pending' : 'failed';
    const svc = SERVICES_MOCK[i % SERVICES_MOCK.length];
    return {
      id: `notif-${i.toString().padStart(3, '0')}`,
      at: minutesAgo(8 + i * 47),
      channel: channels[i % channels.length],
      serviceId: svc.id,
      serviceName: svc.name,
      title: TITLES[i % TITLES.length],
      status,
      errorReason:
        status === 'failed'
          ? failureReasons[i % failureReasons.length]
          : undefined,
    };
  });
}
