// Angular
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
// PrimeNG
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Skeleton } from 'primeng/skeleton';
import { Toast } from 'primeng/toast';
// Shared
import { CHIP_NETWORK_LABELS } from '../../../shared/components/network-chip/network-chip.tokens';
import { LoadErrorStateComponent } from '../../../shared/components/load-error-state/load-error-state.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
// Local
import { PROVIDER_CATALOG } from '../mocks/provider-catalog';
import type {
  ApiKeyEntry,
  ConnectorConfig,
  ProviderDescriptor,
  ProviderId,
  ProviderKind,
} from '../models/provider.interface';
import { SocialSettingsService } from '../services/social-settings.service';
import { ApiKeyDialogComponent } from './components/api-key-dialog/api-key-dialog.component';
import { ProviderCardComponent } from './components/provider-card/provider-card.component';

const PRIME_STANDALONE = [ConfirmDialog, Skeleton, Toast];
const LOCAL_COMPONENTS = [
  ApiKeyDialogComponent,
  LoadErrorStateComponent,
  PageHeaderComponent,
  ProviderCardComponent,
];

/**
 * Nombre es-CL de cada categoría. Doble uso: header de sección (RFC-003
 * D5.1) y copy del impacto de revocación ("…dejará de ser el proveedor
 * activo de Video", D5.5).
 */
const PROVIDER_KIND_LABELS: Record<ProviderKind, string> = {
  'analytics-connector': 'Conectores de analytics',
  'text-gen': 'Texto',
  'image-gen': 'Imágenes',
  'video-gen': 'Video',
};

/**
 * Orden FIJO de las cuatro secciones (RFC-003 D5.1) — no se deriva del
 * catálogo para que el orden de presentación no dependa del orden de
 * declaración de `PROVIDER_CATALOG`.
 */
const SECTION_KINDS: readonly ProviderKind[] = [
  'analytics-connector',
  'text-gen',
  'image-gen',
  'video-gen',
];

/** Card lista para pintar: descriptor del catálogo + su porción del estado. */
interface ProviderCardVm {
  readonly descriptor: ProviderDescriptor;
  readonly config: ConnectorConfig | undefined;
  readonly activeKey: ApiKeyEntry | undefined;
  readonly isActiveProvider: boolean;
}

interface ProviderSectionVm {
  readonly kind: ProviderKind;
  readonly title: string;
  readonly cards: readonly ProviderCardVm[];
}

/** Placeholders del skeleton — mismo idiom que obs-service-detail. */
const SKELETON_CARDS = [0, 1, 2, 3];

/**
 * Catálogo de proveedores y conectores del cliente (RFC-003 D5): alta de
 * API keys con plaintext mostrado UNA vez, verificación simulada
 * determinista, toggle de habilitado y provider activo por categoría.
 *
 * La página es el único punto que habla con `SocialSettingsService` (el
 * puerto `ProviderConfigPort`): las cards y el dialog son presentacionales
 * y emiten intenciones. El estado que se pinta sale del signal `state()`
 * del service — así toda mutación se refleja sin refetch; el `rxResource`
 * sobre `getState()` existe solo para el skeleton de carga inicial y la
 * paridad SSR (RFC-003 D6.2: el server pinta skeleton, el browser
 * rehidrata desde storage).
 *
 * No tiene empty state de página (RFC-003 D3): el catálogo SIEMPRE
 * renderiza — un cliente nuevo ve las diez cards en estado "sin key", que
 * es justamente la captura del pitch para las baselines (RFC-001 D7).
 */
@Component({
  selector: 'app-social-providers',
  imports: [PRIME_STANDALONE, LOCAL_COMPONENTS],
  providers: [MessageService, ConfirmationService],
  templateUrl: './social-providers.component.html',
  styleUrl: './social-providers.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    // Página-card (RFC-001 D5): catálogo dentro de una sola superficie.
    class:
      'flex-1 h-full overflow-y-auto overflow-x-clip overflow-hidden border border-surface rounded-2xl p-6',
  },
})
export class SocialProvidersComponent {
  private readonly settings = inject(SocialSettingsService);
  private readonly messages = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  private readonly destroyRef = inject(DestroyRef);

  /** Fachada Observable del puerto — solo para loading/error de la carga
   *  inicial (ver JSDoc de la clase). */
  private readonly stateResource = rxResource({
    stream: () => this.settings.getState(),
  });

  protected readonly loading = computed(() => this.stateResource.isLoading());
  protected readonly loadError = computed(() => this.stateResource.error());
  protected readonly skeletonCards = SKELETON_CARDS;

  protected retry(): void {
    this.stateResource.reload();
  }

  /** Provider con una mutación en curso (toggle / activo / revocación). */
  private readonly pendingId = signal<ProviderId | null>(null);
  /** Provider con una verificación en curso — alimenta el `[loading]`. */
  private readonly verifyingId = signal<ProviderId | null>(null);

  protected isPending(providerId: ProviderId): boolean {
    return this.pendingId() === providerId;
  }

  protected isVerifying(providerId: ProviderId): boolean {
    return this.verifyingId() === providerId;
  }

  // ── Dialog de alta de key ────────────────────────────────────────────

  protected readonly dialogDescriptor = signal<ProviderDescriptor | null>(null);
  protected readonly dialogVisible = signal(false);

  protected openKeyDialog(descriptor: ProviderDescriptor): void {
    this.dialogDescriptor.set(descriptor);
    this.dialogVisible.set(true);
  }

  // ── View model ───────────────────────────────────────────────────────

  /**
   * Las cuatro secciones con sus cards, derivadas del catálogo filtrado por
   * `kind` y cruzadas con el estado del cliente. Un solo computed: el
   * template no invoca métodos de lookup por card.
   */
  protected readonly sections = computed<readonly ProviderSectionVm[]>(() => {
    const state = this.settings.state();
    return SECTION_KINDS.map((kind) => ({
      kind,
      title: PROVIDER_KIND_LABELS[kind],
      cards: PROVIDER_CATALOG.filter(
        (descriptor) => descriptor.kind === kind,
      ).map((descriptor) => {
        const config = state.configs.find(
          (entry) => entry.providerId === descriptor.id,
        );
        return {
          descriptor,
          config,
          activeKey: this.resolveActiveKey(state.keys, config, descriptor.id),
          isActiveProvider: state.activeByKind[kind] === descriptor.id,
        };
      }),
    }));
  });

  /**
   * Key que la card muestra: la referenciada por el config y, si el config
   * quedó sin referencia (alta previa a la reconciliación), la primera del
   * provider — mismo criterio de auto-reparación que usa el service.
   */
  private resolveActiveKey(
    keys: readonly ApiKeyEntry[],
    config: ConnectorConfig | undefined,
    providerId: ProviderId,
  ): ApiKeyEntry | undefined {
    const byConfig = config?.activeKeyId
      ? keys.find((entry) => entry.id === config.activeKeyId)
      : undefined;
    return byConfig ?? keys.find((entry) => entry.providerId === providerId);
  }

  // ── Mutaciones ───────────────────────────────────────────────────────

  /** Toggle enabled. El service rechaza habilitar sin key `valid` (última
   *  línea); el toggle ya viene deshabilitado en ese caso. */
  protected onEnabledChange(card: ProviderCardVm, enabled: boolean): void {
    const { descriptor } = card;
    this.pendingId.set(descriptor.id);
    this.settings
      .setEnabled(descriptor.id, enabled)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.pendingId.set(null),
        error: (error: Error) => {
          this.pendingId.set(null);
          this.messages.add({
            severity: 'error',
            summary: 'No se pudo cambiar el estado del proveedor',
            detail: error.message,
            life: 5000,
          });
        },
      });
  }

  /**
   * Verificación simulada (RFC-003 D5.3): determinista por key — reintentar
   * la MISMA key repite el resultado, por eso el toast de rechazo sugiere
   * generar una nueva.
   */
  protected onVerify(card: ProviderCardVm): void {
    const key = card.activeKey;
    if (!key) {
      return;
    }
    const { descriptor } = card;
    this.verifyingId.set(descriptor.id);
    this.settings
      .verifyKey(key.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (entry) => {
          this.verifyingId.set(null);
          if (entry.status === 'valid') {
            this.messages.add({
              severity: 'success',
              summary: 'Key verificada',
              detail: `Ya podés habilitar ${descriptor.name}.`,
              life: 3000,
            });
            return;
          }
          this.messages.add({
            severity: 'error',
            summary: 'No pudimos verificar la key',
            detail: `La key de ${descriptor.name} fue rechazada. Verificá que la copiaste completa o generá una nueva.`,
            life: 5000,
          });
        },
        error: (error: Error) => {
          this.verifyingId.set(null);
          this.messages.add({
            severity: 'error',
            summary: 'No pudimos verificar la key',
            detail: error.message,
            life: 5000,
          });
        },
      });
  }

  /** "Usar como activo" (RFC-003 D5.4) — solo categorías de generación. */
  protected onUseAsActive(card: ProviderCardVm): void {
    const { descriptor } = card;
    this.pendingId.set(descriptor.id);
    this.settings
      .setActiveProvider(descriptor.kind, descriptor.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.pendingId.set(null);
          this.messages.add({
            severity: 'success',
            summary: 'Proveedor activo actualizado',
            detail: `${descriptor.name} es el proveedor por defecto de ${PROVIDER_KIND_LABELS[descriptor.kind]}.`,
            life: 3000,
          });
        },
        error: (error: Error) => {
          this.pendingId.set(null);
          this.messages.add({
            severity: 'error',
            summary: 'No se pudo cambiar el proveedor activo',
            detail: error.message,
            life: 5000,
          });
        },
      });
  }

  /**
   * Revocación (RFC-003 D5.5): el impacto se CALCULA antes de abrir el
   * confirm — el usuario lee exactamente qué se rompe, no una advertencia
   * genérica.
   */
  protected onRevoke(card: ProviderCardVm): void {
    const key = card.activeKey;
    if (!key) {
      return;
    }
    this.confirm.confirm({
      header: 'Revocar API key',
      message: this.buildRevocationImpact(card, key),
      icon: 'fa-sharp fa-regular fa-triangle-exclamation',
      acceptLabel: 'Revocar',
      acceptButtonStyleClass: 'p-button-danger',
      rejectLabel: 'Cancelar',
      rejectButtonStyleClass: 'p-button-text',
      accept: () => this.revoke(card, key),
    });
  }

  /**
   * Enumera el impacto concreto: provider deshabilitado, pérdida del rol de
   * activo en su categoría y cuentas de la red que pasan a error. Los tres
   * predicados espejan la cascada del service (`applyRevocationCascade`),
   * que dispara sobre las configs cuyo `activeKeyId` es esta key.
   */
  private buildRevocationImpact(
    card: ProviderCardVm,
    key: ApiKeyEntry,
  ): string {
    const { descriptor, config } = card;
    const isActiveKey = config?.activeKeyId === key.id;
    const clauses: string[] = [];

    if (isActiveKey && config?.enabled) {
      clauses.push(`${descriptor.name} quedará deshabilitado`);
    }
    if (isActiveKey && card.isActiveProvider) {
      clauses.push(
        `dejará de ser el proveedor activo de ${PROVIDER_KIND_LABELS[descriptor.kind]}`,
      );
    }
    const affectedNetworks = isActiveKey
      ? this.settings
          .accounts()
          .filter((account) => account.connectorId === descriptor.id)
          .map((account) => CHIP_NETWORK_LABELS[account.network])
      : [];
    if (affectedNetworks.length > 0) {
      clauses.push(
        `las cuentas de ${joinEs(affectedNetworks)} conectadas pasarán a estado de error`,
      );
    }

    const impact =
      clauses.length > 0
        ? `${joinEs(clauses)}.`
        : 'La key deja de listarse y el proveedor queda sin credencial.';
    return `Vas a revocar la key ${key.maskedKey} de ${descriptor.name}. ${impact}`;
  }

  private revoke(card: ProviderCardVm, key: ApiKeyEntry): void {
    const { descriptor } = card;
    const previousActive = this.settings.state().activeByKind[descriptor.kind];
    this.pendingId.set(descriptor.id);
    this.settings
      .revokeKey(key.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.pendingId.set(null);
          this.messages.add({
            severity: 'success',
            summary: 'Key revocada',
            detail: `${descriptor.name} quedó sin credencial configurada.`,
            life: 3000,
          });
          this.announcePromotion(descriptor.kind, previousActive);
        },
        error: (error: Error) => {
          this.pendingId.set(null);
          this.messages.add({
            severity: 'error',
            summary: 'No se pudo revocar la key',
            detail: error.message,
            life: 5000,
          });
        },
      });
  }

  /** D5.5.3: si la cascada promovió a otro provider de la categoría, se
   *  avisa cuál — el cambio de default no puede ser silencioso. */
  private announcePromotion(
    kind: ProviderKind,
    previousActive: ProviderId | undefined,
  ): void {
    const nextActive = this.settings.state().activeByKind[kind];
    if (!nextActive || nextActive === previousActive) {
      return;
    }
    const promoted = PROVIDER_CATALOG.find(
      (descriptor) => descriptor.id === nextActive,
    );
    this.messages.add({
      severity: 'info',
      summary: 'Proveedor activo actualizado',
      detail: `${promoted?.name ?? nextActive} pasó a ser el proveedor activo de ${PROVIDER_KIND_LABELS[kind]}.`,
      life: 4000,
    });
  }
}

/** Enumeración en es-CL: "a, b y c" (la última va con «y», no con coma). */
function joinEs(items: readonly string[]): string {
  if (items.length <= 1) {
    return items[0] ?? '';
  }
  return `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`;
}
