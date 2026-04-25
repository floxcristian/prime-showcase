import { A11yModule } from '@angular/cdk/a11y';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';

import { NavStateService } from '../nav/nav-state.service';
import { SearchSuggestionsComponent } from '../../shared/components/search-suggestions/search-suggestions.component';

const NG_MODULES = [A11yModule];
const PRIME_MODULES = [IconField, InputIcon, InputTextModule];

/**
 * Full-screen search overlay para mobile. Triggereado por el search icon del
 * toolbar mobile (`nav.searchOverlayOpen()`). Patrón Google app / Gmail mobile /
 * Notion: overlay full-viewport con input sticky arriba y contenido debajo.
 *
 * **Scope del shell:** chrome del overlay (full-screen positioning, header
 * sticky con input + back button, focus trap via CDK). El **contenido**
 * (recent searches + recent views + empty state) lo provee
 * `<app-search-suggestions>`, compartido con el dropdown desktop del toolbar.
 * Data coherente entre ambos surfaces via `SearchHistoryService`.
 *
 * Out-of-scope (showcase): búsqueda real funcional. El input es solo
 * placeholder con autofocus — la submit action y el fetch quedan como
 * extension point.
 */
@Component({
  selector: 'app-mobile-search-overlay',
  imports: [NG_MODULES, PRIME_MODULES, SearchSuggestionsComponent],
  templateUrl: './mobile-search-overlay.component.html',
  styleUrl: './mobile-search-overlay.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(window:keydown.escape)': 'onEscape()',
  },
})
export class MobileSearchOverlayComponent {
  protected nav = inject(NavStateService);

  // Focus management delegado a CDK:
  //   - `cdkTrapFocus` en el root del dialog instala el trap.
  //   - `[cdkTrapFocusAutoCapture]="true"` captura el activeElement previo al
  //     abrir y lo restaura al cerrar (patrón WAI-ARIA APG dialog).
  //   - `cdkFocusInitial` en el <input> indica al trap cuál elemento enfocar
  //     al capturar — evita la race vs un `afterNextRender` manual y garantiza
  //     que el keyboard mobile aparezca inmediatamente (patrón Google app).

  close(): void {
    this.nav.close('search');
  }

  onEscape(): void {
    if (this.nav.searchOverlayOpen()) this.close();
  }
}
