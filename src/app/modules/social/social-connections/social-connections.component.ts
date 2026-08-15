// Angular
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';

// PrimeNG
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Skeleton } from 'primeng/skeleton';
import { Toast } from 'primeng/toast';

// Shared
import { LoadErrorStateComponent } from '../../../shared/components/load-error-state/load-error-state.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';

// Local
import { PROVIDER_CATALOG } from '../mocks/provider-catalog';
import type {
  ProviderId,
  TenantProviderState,
} from '../models/provider.interface';
import type { SocialAccount, SocialNetwork } from '../models/social.interface';
import { SocialSettingsService } from '../services/social-settings.service';
import { ConnectorCardComponent } from './components/connector-card/connector-card.component';

const PRIME_STANDALONE = [ConfirmDialog, Skeleton, Toast];
const LOCAL_COMPONENTS = [
  ConnectorCardComponent,
  LoadErrorStateComponent,
  PageHeaderComponent,
];

/** Una card del grid: la red + el conector del catálogo que la alimenta. */
interface ConnectorTarget {
  readonly providerId: ProviderId;
  readonly network: SocialNetwork;
}

/** VM que la página calcula por card (estado listo + cuenta de la red). */
interface ConnectorCardVm extends ConnectorTarget {
  readonly ready: boolean;
  readonly account: SocialAccount | undefined;
}

/**
 * Redes con card, DERIVADAS del catálogo (RFC-003 D4.1: "el catálogo
 * manda"). Agregar una red mañana es agregar una entry a
 * `PROVIDER_CATALOG`, no tocar esta página. El orden es el del catálogo,
 * que ya sigue el orden canónico de `SOCIAL_NETWORKS`.
 */
const CONNECTOR_TARGETS: readonly ConnectorTarget[] = PROVIDER_CATALOG.filter(
  (descriptor) => descriptor.kind === 'analytics-connector',
).flatMap((descriptor) =>
  (descriptor.capabilities.networks ?? []).map((network) => ({
    providerId: descriptor.id,
    network,
  })),
);

/**
 * Prerequisito de conexión (RFC-003 D4.2): el conector está `enabled` y su
 * key activa existe y está `valid`. Es el mismo criterio que
 * `SocialSettingsService.hasReadyProvider(kind)` pero por PROVIDER: cada red
 * usa su propio conector, así que un Instagram listo no habilita TikTok.
 */
function isConnectorReady(
  state: TenantProviderState,
  providerId: ProviderId,
): boolean {
  const config = state.configs.find(
    (entry) => entry.providerId === providerId,
  );
  if (!config?.enabled || !config.activeKeyId) {
    return false;
  }
  return state.keys.some(
    (key) => key.id === config.activeKeyId && key.status === 'valid',
  );
}

/**
 * Cuentas conectadas del cliente — grid de conectores con "OAuth" simulado
 * (RFC-003 D4). Página de configuración: NO tiene refresh-toolbar (el
 * estado es local al cliente, no hay dato remoto que refrescar) ni empty
 * state de página — el grid SIEMPRE renderiza, con todas las redes en
 * `disconnected` para un cliente nuevo. Esa captura vacía es el pitch
 * "cero cuentas hardcodeadas" y la que congelan las baselines
 * (RFC-001 D7).
 *
 * Cascada de la página (RFC-001 D5): skeleton → error de carga → grid.
 *
 * **Por qué un resource sobre un service sincrónico.** `getState()` es la
 * fachada Observable del puerto (`mockLatency(200, 300)`) y es lo que un
 * backend real va a devolver; el resource existe para pintar `<p-skeleton>`
 * en SSR y en el primer frame del browser sin mismatch de hidratación
 * (RFC-003 D6.2). El CONTENIDO, en cambio, se lee de los signals del
 * service: así toda mutación (connect/disconnect/revocación en cascada
 * desde `/social/providers`) se refleja al instante sin refetch.
 */
@Component({
  selector: 'app-social-connections',
  imports: [PRIME_STANDALONE, LOCAL_COMPONENTS],
  templateUrl: './social-connections.component.html',
  styleUrl: './social-connections.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Una sola instancia de cada overlay para las N cards del grid: las cards
  // inyectan estos services y la página renderiza <p-toast>/<p-confirmdialog>.
  providers: [MessageService, ConfirmationService],
  host: {
    class:
      'flex-1 h-full overflow-y-auto overflow-x-clip overflow-hidden border border-surface rounded-2xl p-6',
  },
})
export class SocialConnectionsComponent {
  private readonly settings = inject(SocialSettingsService);

  private readonly stateResource = rxResource({
    stream: () => this.settings.getState(),
  });

  protected readonly loading = computed(() => this.stateResource.isLoading());
  protected readonly loadError = computed(() => this.stateResource.error());

  protected readonly cards = computed<readonly ConnectorCardVm[]>(() => {
    const state = this.settings.state();
    const accounts = this.settings.accounts();
    return CONNECTOR_TARGETS.map((target) => ({
      ...target,
      ready: isConnectorReady(state, target.providerId),
      account: accounts.find((account) => account.network === target.network),
    }));
  });

  /** Una skeleton por card del catálogo — cero layout shift al resolver. */
  protected readonly skeletonPlaceholders = CONNECTOR_TARGETS.map(
    (target) => target.network,
  );

  protected retry(): void {
    // Guard contra reentry, igual que `trackedResource.retry()`.
    if (this.stateResource.isLoading()) {
      return;
    }
    this.stateResource.reload();
  }
}
