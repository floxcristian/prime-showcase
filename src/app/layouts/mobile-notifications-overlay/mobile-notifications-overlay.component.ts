import { A11yModule } from '@angular/cdk/a11y';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { NotificationsComponent } from '../../modules/notifications/notifications.component';
import { BackButtonComponent } from '../../shared/back-button/back-button.component';
import { NavStateService } from '../nav/nav-state.service';
import { PrimaryTitleToolbarComponent } from '../primary-title-toolbar/primary-title-toolbar.component';

const NG_MODULES = [A11yModule];
const LOCAL_COMPONENTS = [
  BackButtonComponent,
  NotificationsComponent,
  PrimaryTitleToolbarComponent,
];

/**
 * Full-screen mobile overlay para notificaciones — gemelo visual de
 * `mobile-more-overlay` y `settings-drawer` mobile. Reemplaza al `<main>` via
 * fixed + z-30, mantiene el bottom-16 para no tapar el footer.
 *
 * **Por qué un overlay y NO seguir siendo ruta en mobile:**
 *   El bell mobile antes hacía `routerLink="/notifications"`, lo que desmontaba
 *   la view previa (p.ej. Overview con sus charts Chart.js). Al volver, el
 *   `router-outlet` re-montaba la view → `ngOnInit`/`afterNextRender` se re-
 *   ejecutaban → charts re-animaban desde 0 → efecto visual lento + feo en
 *   Android. Convirtiéndolo en overlay la view de fondo sigue montada; el
 *   cierre es un signal flip — mismo ciclo que los otros 3 overlays del app.
 *   La ruta /notifications sigue viva para deep-links y el "Ver todas" del
 *   popover desktop.
 *
 * El scroll container interno es `<div class="flex-1 overflow-y-auto">` para
 * que los sticky date headers del `<app-notifications>` se anclen al top de
 * esta área (debajo del primary-title-toolbar), no al viewport.
 */
@Component({
  selector: 'app-mobile-notifications-overlay',
  imports: [NG_MODULES, LOCAL_COMPONENTS],
  templateUrl: './mobile-notifications-overlay.component.html',
  styleUrl: './mobile-notifications-overlay.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Escape explícito — CDK `cdkTrapFocus` atrapa el tab loop pero NO
  // intercepta Escape; los otros overlays mobile (more, search) tienen el
  // mismo host binding para consistencia UX (teclado físico + screen readers
  // que mapean un gesto a Escape).
  host: { '(window:keydown.escape)': 'onEscape()' },
})
export class MobileNotificationsOverlayComponent {
  protected nav = inject(NavStateService);

  close(): void {
    this.nav.close('notifications');
  }

  onEscape(): void {
    if (this.nav.notificationsOverlayOpen()) this.close();
  }
}
