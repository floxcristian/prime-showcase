import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { RouterModule } from '@angular/router';

import { SearchHistoryService } from '../../../core/services/search-history/search-history.service';

/**
 * Contenido reutilizable para el surface de búsqueda — recents (chips) +
 * vistos recientemente (list) + empty state.
 *
 * **Un solo contenido, dos shells:** mobile lo renderiza dentro de un
 * full-screen overlay (con keyboard on-screen, scroll vertical libre),
 * desktop lo renderiza dentro de un popover anclado al input del toolbar.
 * Ambos leen el mismo `SearchHistoryService` — data coherente entre
 * surfaces.
 *
 * **Scope:** sólo el contenido (chips + list + empty state). No trae input
 * de búsqueda ni shell de positioning — cada shell lo provee (overlay
 * sticky header en mobile, input del toolbar en desktop).
 *
 * **Output `itemSelected`:** el parent (shell) necesita saber cuándo el
 * user eligió un item para cerrar el surface. Se emite en:
 *   - click en chip de recent search (re-ejecutar query)
 *   - click en un view (navigate via routerLink + cerrar)
 *
 * Los clicks en "Limpiar" / "Remover" NO emiten — esas son mutaciones
 * sobre la lista sin cerrar el surface (pattern Google, GitHub).
 */
@Component({
  selector: 'app-search-suggestions',
  imports: [RouterModule],
  templateUrl: './search-suggestions.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchSuggestionsComponent {
  protected history = inject(SearchHistoryService);

  readonly itemSelected = output<void>();

  protected onItemSelected(): void {
    this.itemSelected.emit();
  }
}
