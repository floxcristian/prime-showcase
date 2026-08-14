import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import {
  CHIP_NETWORK_ICONS,
  CHIP_NETWORK_LABELS,
  type ChipNetwork,
} from './network-chip.tokens';

/**
 * Chip icono+label de red social (RFC-001 D8): logo `fa-brands` real +
 * nombre canónico de la red. Identificador NEUTRAL — sin severidad
 * semántica — por eso NO wrappea `<p-tag>` (mismo criterio documentado en
 * `<app-pill>`: p-tag queda para chips con significado success/warn/etc.)
 * y comparte la anatomía visual de la familia pill (text-xs, rounded-lg).
 *
 * El consumer pasa la red del dominio (`SocialNetwork`, estructuralmente
 * idéntico al union local `ChipNetwork` — ver `network-chip.tokens.ts`);
 * label e icono derivan del vocabulario compartido en el tokens file.
 * El icono es decorativo (el label ya nombra la red) → `aria-hidden`.
 */
@Component({
  selector: 'app-network-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <i [class]="icon()" aria-hidden="true"></i>
    <span>{{ label() }}</span>
  `,
  host: {
    class:
      'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-lg leading-none bg-surface-100 dark:bg-surface-800 text-color',
  },
})
export class NetworkChipComponent {
  readonly network = input.required<ChipNetwork>();

  protected readonly label = computed<string>(
    () => CHIP_NETWORK_LABELS[this.network()],
  );

  protected readonly icon = computed<string>(
    () => CHIP_NETWORK_ICONS[this.network()],
  );
}
