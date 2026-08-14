// Angular
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  model,
} from '@angular/core';
// PrimeNG
import { Dialog } from 'primeng/dialog';
// Local
import { CustomersKeyboardService } from '../../services/customers-keyboard.service';

const PRIME_MODULES = [Dialog];

/**
 * `?` keyboard shortcuts help overlay — dialog con TODOS los shortcuts
 * registrados, agrupados por section. Surface canónico bigtech (Linear,
 * Notion, Slack, GitHub, Stripe).
 *
 * **API de un solo miembro** (`visible`): todo lo demás deriva de
 * `CustomersKeyboardService.registered()` — service root-scoped, misma
 * instancia que usa el container para registrar los atajos. El
 * agrupado por section (`groupedShortcuts`) y el formateo cross-OS
 * (`formatCombo`, cmd→⌘/Ctrl) viven acá porque sólo este overlay los
 * consume; el container no necesita re-exponerlos.
 *
 * El estado `helpVisible` + `openHelp`/`closeHelp` quedan en el
 * container: los toca el atajo `?` y la cascada de `escape`.
 */
@Component({
  selector: 'app-customers-shortcuts-help',
  imports: [PRIME_MODULES],
  templateUrl: './customers-shortcuts-help.component.html',
  styleUrl: './customers-shortcuts-help.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomersShortcutsHelpComponent {
  /** Protected (no private): el template llama `formatCombo` directo. */
  protected readonly keyboardService = inject(CustomersKeyboardService);

  /** Two-way con el container — `?` abre, `escape`/mask cierran. */
  readonly visible = model<boolean>(false);

  /**
   * Snapshot del set de shortcuts registrados, agrupados por section
   * para el ? help overlay. Computed para que el dialog liste los
   * shortcuts activos en tiempo real.
   */
  protected readonly groupedShortcuts = computed(() => {
    const all = this.keyboardService.registered();
    const sections = new Map<string, (typeof all)[number][]>();
    for (const s of all) {
      const arr = sections.get(s.section) ?? [];
      arr.push(s);
      sections.set(s.section, arr);
    }
    return [...sections.entries()].map(([section, shortcuts]) => ({
      section,
      shortcuts,
    }));
  });
}
