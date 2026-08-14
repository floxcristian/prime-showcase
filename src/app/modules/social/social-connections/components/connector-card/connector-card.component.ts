// Angular
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { map, type Observable, timer } from 'rxjs';

// PrimeNG
import { ConfirmationService, MessageService, type MenuItem } from 'primeng/api';
import { Avatar } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { Menu } from 'primeng/menu';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';

// Shared
import {
  CHIP_NETWORK_ICONS,
  CHIP_NETWORK_LABELS,
} from '../../../../../shared/components/network-chip/network-chip.tokens';
import { RelativeTimePipe } from '../../../../../shared/pipes/relative-time.pipe';
import { mockLatency } from '../../../../../shared/utils/mock-latency';
import { seededRandom } from '../../../../../shared/utils/mock-utils';

// Local
import type {
  ConnectionStatus,
  SocialAccount,
  SocialNetwork,
} from '../../../models/social.interface';
import { SocialSettingsService } from '../../../services/social-settings.service';
import {
  CONNECTION_STATUS_LABELS,
  CONNECTION_STATUS_SEVERITIES,
  type ConnectionSeverity,
} from '../../constants/connection-status.tokens';

const NG_MODULES = [RouterLink];
const PRIME_MODULES = [ButtonModule];
const PRIME_STANDALONE = [Avatar, Menu, Tag, Tooltip];
const LOCAL_PIPES = [RelativeTimePipe];

/**
 * Probabilidad de que el "OAuth" simulado falle (RFC-003 D4.3.2): el roll
 * `seededRandom(`${clientSeed}:${network}:attempt-${n}`)()` menor a este
 * umbral produce el estado de error con retry.
 */
const OAUTH_FAILURE_PROBABILITY = 0.15;

/**
 * Latencia del consentimiento OAuth (RFC-003 D4.3.1). El camino de ÉXITO la
 * hereda del puerto (`connectAccount`/`reconnectAccount` ya envuelven
 * `timer(mockLatency(1200, 800))`); el camino de FALLA la aplica acá para
 * que fallar se sienta igual de "remoto" que conectar — sin ella el error
 * aparecería instantáneo y delataría que la resolución es local.
 */
const OAUTH_LATENCY_MIN_MS = 1200;
const OAUTH_LATENCY_RANGE_MS = 800;

/** `life` de toasts de confirmación breve (convención de `ux-patterns.md`). */
const TOAST_SUCCESS_LIFE_MS = 3000;

/** Miles con separador es-CL (`18.420`) — formateo en el .ts, nunca `| number`. */
const FOLLOWERS_FORMATTER = new Intl.NumberFormat('es-CL');

/**
 * Card de conector de una red social — unidad del grid de
 * `social-connections` (RFC-003 D4.1). Renderiza el estado de conexión de
 * UNA red y es dueña de su interacción: connect/reconnect con "OAuth"
 * simulado (D4.3), desconexión confirmada (D4.5) y los hints de
 * prerequisito de key (D4.2).
 *
 * **Presentación por input, mutación por puerto.** La página calcula el VM
 * (cuenta de la red + si el conector está listo) y lo pasa como inputs; las
 * mutaciones las hace la card contra `SocialSettingsService` (el puerto),
 * cuyos signals re-alimentan el VM de la página. Así el estado efímero de
 * la interacción (`connecting`, error del intento, contador de intentos)
 * queda scoped a la card que lo muestra, como pide el RFC, sin que la
 * página tenga que llevar mapas por red.
 *
 * **Determinismo (D4.3.2).** El resultado sale de
 * `seededRandom(`${clientSeed}:${network}:attempt-${n}`)`: el mismo cliente
 * ve SIEMPRE el mismo resultado en el mismo intento (baselines y demos
 * reproducibles), y como el contador `n` entra en el seed, el retry puede
 * resolver distinto — el estado de error se demuestra sin quedar pegado.
 *
 * Toast y confirm dialog los renderiza la página
 * (`<p-toast>` / `<p-confirmdialog>`), que además provee `MessageService` y
 * `ConfirmationService`: una sola instancia de cada overlay para las N
 * cards del grid.
 */
@Component({
  selector: 'app-connector-card',
  imports: [NG_MODULES, PRIME_MODULES, PRIME_STANDALONE, LOCAL_PIPES],
  templateUrl: './connector-card.component.html',
  styleUrl: './connector-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'border border-surface rounded-2xl p-6 flex flex-col gap-4',
  },
})
export class ConnectorCardComponent {
  private readonly settings = inject(SocialSettingsService);
  private readonly messages = inject(MessageService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly destroyRef = inject(DestroyRef);

  /** Red del catálogo que representa esta card (`capabilities.networks`). */
  readonly network = input.required<SocialNetwork>();

  /** Cuenta conectada de esa red, si existe (status EFECTIVO ya computado
   *  por `SocialSettingsService.accounts()`). */
  readonly account = input<SocialAccount | undefined>(undefined);

  /**
   * Prerequisito de D4.2: el `analytics-connector` de esta red está
   * `enabled` con key `valid`. Sin esto, conectar queda deshabilitado y la
   * card muestra el hint con link a `/social/providers`.
   */
  readonly connectorReady = input.required<boolean>();

  /** `[loading]` del CTA mientras dura el consentimiento simulado. */
  protected readonly connecting = signal(false);

  /** Mensaje del intento fallido (D4.3.2) — se limpia al reintentar. */
  protected readonly attemptError = signal<string | null>(null);

  /**
   * Contador `n` de intentos de esta card, EN MEMORIA (no se persiste):
   * entra en el seed para que el retry pueda resolver distinto. Plain
   * field, no signal: no se lee desde el template.
   */
  private attempts = 0;

  protected readonly networkLabel = computed(
    () => CHIP_NETWORK_LABELS[this.network()],
  );

  /** Logo de marca real — único caso donde DESIGN.md permite `fa-brands`. */
  protected readonly brandIcon = computed(
    () => CHIP_NETWORK_ICONS[this.network()],
  );

  protected readonly status = computed<ConnectionStatus>(
    () => this.account()?.status ?? 'disconnected',
  );

  protected readonly statusLabel = computed(
    () => CONNECTION_STATUS_LABELS[this.status()],
  );

  protected readonly statusSeverity = computed<ConnectionSeverity>(
    () => CONNECTION_STATUS_SEVERITIES[this.status()],
  );

  protected readonly isConnected = computed(() => this.status() === 'connected');

  /** Iniciales del avatar fallback (la cuenta mock nunca trae `avatarUrl`). */
  protected readonly initials = computed(() => {
    const account = this.account();
    if (!account) {
      return '';
    }
    const source = account.displayName.trim() || account.handle.replace('@', '');
    const words = source.split(/\s+/).filter((word) => word.length > 0);
    return words
      .slice(0, 2)
      .map((word) => word.charAt(0).toUpperCase())
      .join('');
  });

  protected readonly formattedFollowers = computed(() =>
    FOLLOWERS_FORMATTER.format(this.account()?.followers ?? 0),
  );

  /** D4.2: sin key válida del conector no se puede conectar. */
  protected readonly ctaDisabled = computed(() => !this.connectorReady());

  /** Vacío cuando el CTA está habilitado — `pTooltip=""` no renderiza nada. */
  protected readonly ctaTooltip = computed(() =>
    this.ctaDisabled() ? 'Configurá primero la API key del conector' : '',
  );

  protected readonly ctaLabel = computed(() => {
    if (this.account()) {
      return 'Reconectar';
    }
    return this.attemptError() ? 'Reintentar' : 'Conectar';
  });

  /** Acciones de la cuenta — el menú `···` solo se monta si hay cuenta. */
  protected readonly menuItems: MenuItem[] = [
    {
      label: 'Desconectar',
      icon: 'fa-sharp fa-regular fa-link-slash',
      command: () => this.confirmDisconnect(),
    },
  ];

  /**
   * Connect / reconnect — "OAuth" simulado de D4.3. Reconectar repite el
   * mismo flujo: refresca `connectedAt` y limpia `failureReason`
   * (`applyConnect` del service), preservando la cuenta.
   */
  protected onCta(): void {
    if (this.connecting() || this.ctaDisabled()) {
      return;
    }
    this.attemptError.set(null);
    this.connecting.set(true);
    this.attempts += 1;

    const network = this.network();
    const account = this.account();
    const failed =
      seededRandom(
        `${this.settings.clientSeed()}:${network}:attempt-${this.attempts}`,
      )() < OAUTH_FAILURE_PROBABILITY;

    // `null` = autorización rechazada; la latencia la aporta el timer local
    // (el puerto ya trae la suya en el camino de éxito).
    const flow$: Observable<SocialAccount | null> = failed
      ? timer(mockLatency(OAUTH_LATENCY_MIN_MS, OAUTH_LATENCY_RANGE_MS)).pipe(
          map(() => null),
        )
      : account
        ? this.settings.reconnectAccount(account.id)
        : this.settings.connectAccount(network);

    // takeUntilDestroyed: el mock emite con delay largo — si el usuario
    // navega antes de la emisión, el callback escribiría signals sobre una
    // instancia destruida.
    flow$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (connected) => {
        this.connecting.set(false);
        if (connected === null) {
          this.attemptError.set(this.authorizationErrorMessage());
          return;
        }
        this.messages.add({
          severity: 'success',
          summary: 'Cuenta conectada',
          detail: `Los datos de ${connected.handle} empiezan a sincronizarse.`,
          life: TOAST_SUCCESS_LIFE_MS,
        });
      },
      error: () => {
        // El puerto rechaza (p.ej. la cuenta desapareció entre medio):
        // mismo estado accionable que la falla de autorización.
        this.connecting.set(false);
        this.attemptError.set(this.authorizationErrorMessage());
      },
    });
  }

  /**
   * Desconexión con confirmación (D4.5). Copy exacto del RFC: el `handle`
   * ya viene con `@` desde `buildAccountMock`, así que no se le antepone
   * otro.
   */
  protected confirmDisconnect(): void {
    const account = this.account();
    if (!account) {
      return;
    }
    this.confirmation.confirm({
      header: 'Desconectar cuenta',
      message: `Vas a desconectar ${account.handle}. La analítica y el calendario de ${this.networkLabel()} dejarán de mostrar datos hasta que vuelvas a conectarla.`,
      icon: 'fa-sharp fa-regular fa-triangle-exclamation',
      acceptLabel: 'Desconectar',
      acceptButtonStyleClass: 'p-button-danger',
      rejectLabel: 'Cancelar',
      rejectButtonStyleClass: 'p-button-text',
      accept: () => this.disconnect(account.id),
    });
  }

  private disconnect(accountId: string): void {
    this.attemptError.set(null);
    this.settings
      .disconnectAccount(accountId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.messages.add({
          severity: 'info',
          summary: 'Cuenta desconectada',
          detail: `Dejamos de traer datos de ${this.networkLabel()}.`,
          life: TOAST_SUCCESS_LIFE_MS,
        });
      });
  }

  private authorizationErrorMessage(): string {
    return `No pudimos completar la autorización con ${this.networkLabel()}. Reintentá.`;
  }
}
