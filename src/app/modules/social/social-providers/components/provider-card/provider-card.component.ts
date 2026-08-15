// Angular
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
// PrimeNG
import { ButtonModule } from 'primeng/button';
import { Tag } from 'primeng/tag';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { TooltipModule } from 'primeng/tooltip';
// Shared
import { CHIP_NETWORK_LABELS } from '../../../../../shared/components/network-chip/network-chip.tokens';
import { RelativeTimePipe } from '../../../../../shared/pipes/relative-time.pipe';
// Local
import type {
  ApiKeyEntry,
  ConnectorConfig,
  ProviderDescriptor,
} from '../../../models/provider.interface';
import {
  API_KEY_STATUS_LABELS,
  API_KEY_STATUS_SEVERITIES,
  type ApiKeySeverity,
} from '../../constants/api-key-status.tokens';

const NG_MODULES = [FormsModule];
const PRIME_MODULES = [ButtonModule, Tag, ToggleSwitch, TooltipModule];
const LOCAL_PIPES = [RelativeTimePipe];

/**
 * Card de un provider del catálogo (RFC-003 D5.1) — componente LOCAL de
 * `social-providers` (RFC-001 D8: sin consumidores fuera de esta página ⇒
 * ni `shared/` ni story).
 *
 * Presentacional puro: recibe el descriptor del catálogo + la porción de
 * `TenantProviderState` que le corresponde y emite intenciones. TODA
 * mutación (y por lo tanto toda latencia, toast y confirm) vive en la
 * página, que es quien habla con `SocialSettingsService` — la card nunca
 * inyecta el puerto.
 *
 * Se auto-configura leyendo `capabilities` (RFC-002 D3): cero
 * `if`-por-provider, agregar un provider al catálogo no toca este archivo.
 */
@Component({
  selector: 'app-provider-card',
  imports: [NG_MODULES, PRIME_MODULES, LOCAL_PIPES],
  templateUrl: './provider-card.component.html',
  styleUrl: './provider-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    // Card estándar de DESIGN.md. `h-full` para que dos cards de la misma
    // fila del grid queden a la misma altura aunque una tenga key y la
    // otra no (las acciones se alinean abajo con `mt-auto`).
    class: 'border border-surface rounded-2xl p-6 flex flex-col gap-4 h-full',
  },
})
export class ProviderCardComponent {
  /** Entry del `PROVIDER_CATALOG` — fuente de icono, nombre, vendor,
   *  capabilities y `keyFormatHint`/`keyPattern`. */
  readonly descriptor = input.required<ProviderDescriptor>();

  /** Config del cliente para este provider. `undefined` solo en el
   *  transitorio de un state sin reconciliar (defensivo). */
  readonly config = input<ConnectorConfig | undefined>();

  /** Key ACTIVA del provider (la que el config referencia). `undefined` ⇒
   *  el provider está "sin key" y la única acción posible es agregarla. */
  readonly activeKey = input<ApiKeyEntry | undefined>();

  /** ¿Es el provider activo de su categoría de generación (D5.4)? */
  readonly isActiveProvider = input<boolean>(false);

  /** Verificación en curso — alimenta el `[loading]` del botón (D5.3). */
  readonly verifying = input<boolean>(false);

  /** Otra mutación de ESTE provider en curso: bloquea acciones para evitar
   *  doble submit sin congelar el resto del catálogo. */
  readonly busy = input<boolean>(false);

  readonly enabledChange = output<boolean>();
  readonly addKeyClick = output<void>();
  readonly verifyClick = output<void>();
  readonly revokeClick = output<void>();
  readonly useAsActiveClick = output<void>();

  protected readonly enabled = computed(() => this.config()?.enabled ?? false);

  /** Solo una key `valid` habilita el provider (RFC-003 D5.3) — la UI es la
   *  primera línea; el service rechaza igual si se saltea. */
  protected readonly hasValidKey = computed(
    () => this.activeKey()?.status === 'valid',
  );

  protected readonly statusLabel = computed<string>(() => {
    const key = this.activeKey();
    return key ? API_KEY_STATUS_LABELS[key.status] : '';
  });

  protected readonly statusSeverity = computed<ApiKeySeverity>(() => {
    const key = this.activeKey();
    return key ? API_KEY_STATUS_SEVERITIES[key.status] : 'secondary';
  });

  /** `analytics-connector` nunca participa de `activeByKind` (RFC-002 D3) y
   *  el activo debe estar habilitado (RFC-003 D5.4). */
  protected readonly canUseAsActive = computed(
    () =>
      this.descriptor().kind !== 'analytics-connector' &&
      this.enabled() &&
      !this.isActiveProvider(),
  );

  /** Tooltip del toggle deshabilitado (RFC-003 D5.1). Vacío cuando el
   *  toggle está operable: `pTooltip=""` no muestra overlay. */
  protected readonly toggleTooltip = computed(() =>
    this.hasValidKey()
      ? ''
      : 'Agregá una API key y verificála como válida para habilitar este proveedor.',
  );

  /** Id del input del toggle — único por provider para que el `<label>`
   *  apunte al control correcto cuando hay varias cards en el grid. */
  protected readonly toggleInputId = computed(
    () => `provider-enabled-${this.descriptor().id}`,
  );

  /**
   * Capabilities como una línea legible ("hasta 8 s · 9:16, 16:9"). El
   * orden es el de lectura natural: qué red/qué cobertura → cuánto dura →
   * en qué formatos → a qué resolución. Derivado 100 % del descriptor: un
   * provider nuevo con otras capabilities describe solo.
   */
  protected readonly capabilitiesLabel = computed<string>(() => {
    const caps = this.descriptor().capabilities;
    const parts: string[] = [];
    if (caps.networks?.length) {
      parts.push(
        caps.networks.map((network) => CHIP_NETWORK_LABELS[network]).join(', '),
      );
    }
    if (caps.supportedMetrics?.length) {
      parts.push(`${caps.supportedMetrics.length} métricas`);
    }
    if (caps.maxVideoSeconds !== undefined) {
      parts.push(`hasta ${caps.maxVideoSeconds} s`);
    }
    if (caps.supportsAvatars) {
      parts.push('avatares presentadores');
    }
    if (caps.captionVariants !== undefined) {
      parts.push(`${caps.captionVariants} variantes de caption`);
    }
    if (caps.aspectRatios?.length) {
      parts.push(caps.aspectRatios.join(', '));
    }
    if (caps.maxResolution) {
      parts.push(caps.maxResolution);
    }
    return parts.join(' · ');
  });
}
