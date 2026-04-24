import { A11yModule } from '@angular/cdk/a11y';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';

import { AppConfigService } from '../../core/services/app-config/app-config.service';
import { AuthService } from '../../core/services/auth/auth.service';
import { BackButtonComponent } from '../../shared/back-button/back-button.component';
import { NavStateService } from '../nav/nav-state.service';
import { PrimaryTitleToolbarComponent } from '../primary-title-toolbar/primary-title-toolbar.component';

interface MoreItem {
  id: string;
  label: string;
  icon: string;
  /** Si está definido → routerLink. */
  url?: string;
  /** Si está definido → button con handler custom (toggle tema, logout, etc.). */
  action?: () => void;
  /** Hint textual a la derecha (ej. estado del tema "Oscuro"). */
  valueLabel?: () => string;
}

const NG_MODULES = [A11yModule, RouterModule];
const LOCAL_COMPONENTS = [BackButtonComponent, PrimaryTitleToolbarComponent];

/**
 * Full-screen "Más" overlay mobile. Triggereado por el botón "Más" del
 * mobile-footer. Consolida acciones secundarias que no caben en el bottom
 * tab bar (ayuda, legal, feedback, theme toggle, logout) — patrón Paris /
 * Falabella / Easy mobile.
 *
 * Estructura:
 *   1. Header: back button + "Más" title + spacer (balance simétrico)
 *   2. Lista principal con `divide-y`, cada row 56px, icon + label + chevron
 *   3. Logout visualmente separado al final (destructive action)
 *   4. Version string en el footer centrada
 *
 * Los items vienen de un array tipado — fácil agregar/ordenar. URL items usan
 * routerLink + cierre automático del overlay vía NavigationEnd listener del
 * NavStateService. Action items ejecutan handler inline.
 */
@Component({
  selector: 'app-mobile-more-overlay',
  imports: [NG_MODULES, LOCAL_COMPONENTS],
  templateUrl: './mobile-more-overlay.component.html',
  styleUrl: './mobile-more-overlay.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(window:keydown.escape)': 'onEscape()',
  },
})
export class MobileMoreOverlayComponent {
  protected nav = inject(NavStateService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private config = inject(AppConfigService);

  protected readonly darkTheme = this.config.darkTheme;

  /** Versión de la app. En un showcase es estática — en producción vendría de env/package.json. */
  protected readonly appVersion = '1.0.0';

  protected readonly items: MoreItem[] = [
    {
      id: 'notifications',
      label: 'Notificaciones',
      icon: 'fa-sharp fa-regular fa-bell',
      url: '/notifications',
    },
    {
      id: 'theme',
      label: 'Tema',
      icon: 'fa-sharp fa-regular fa-moon',
      action: () => this.toggleTheme(),
      valueLabel: () => (this.darkTheme() ? 'Oscuro' : 'Claro'),
    },
    {
      id: 'help',
      label: 'Centro de ayuda',
      icon: 'fa-sharp fa-regular fa-circle-question',
      action: () => {
        /* placeholder — abre un help center real en producción */
      },
    },
    {
      id: 'feedback',
      label: 'Tu opinión sobre la app',
      icon: 'fa-sharp fa-regular fa-star',
      action: () => {
        /* placeholder — link a formulario/survey */
      },
    },
    {
      id: 'legal',
      label: 'Informaciones legales',
      icon: 'fa-sharp fa-regular fa-circle-info',
      action: () => {
        /* placeholder — página de términos y condiciones */
      },
    },
  ];

  close(): void {
    this.nav.close('more');
  }

  onEscape(): void {
    if (this.nav.moreOverlayOpen()) this.close();
  }

  onItemClicked(item: MoreItem): void {
    if (item.action) item.action();
    // Si es routerLink → el NavigationEnd listener del service cierra solo.
    // Si es action → cerramos nosotros (excepto theme toggle que deja el
    // overlay abierto para que el usuario vea el cambio).
    if (item.action && item.id !== 'theme') this.close();
  }

  toggleTheme(): void {
    this.config.setDarkTheme(!this.darkTheme());
  }

  logout(): void {
    this.close();
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }
}
