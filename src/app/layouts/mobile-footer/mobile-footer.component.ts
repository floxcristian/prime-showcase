import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';

import { NavStateService, OverlayKind } from '../nav/nav-state.service';

type MobileFooterAction = Extract<OverlayKind, 'nav' | 'account' | 'more'>;

interface MobileFooterItem {
  label: string;
  icon: string;
  /** Si está definido → link navegable. */
  routerLink?: string;
  /** Si está definido → button que dispara acción global (overlay nav o drawer). */
  action?: MobileFooterAction;
}

const NG_MODULES = [NgClass, RouterModule];

/**
 * Bottom tab bar estilo native mobile app — visible solo <md. Patrón iOS /
 * Android tabs, Mercado Libre / Lider / Santa Isabel mobile. Icono + label
 * corto, active state con `fa-solid` + `text-primary`, inactive con
 * `fa-regular` + `text-muted-color`.
 *
 * "Menú" abre el mismo nav-overlay que el botón "Categorías" del toolbar.
 */
@Component({
  selector: 'app-mobile-footer',
  imports: [NG_MODULES],
  templateUrl: './mobile-footer.component.html',
  styleUrl: './mobile-footer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'relative z-[1200] h-16 shrink-0 md:hidden w-full border-t border-surface bg-surface-0 dark:bg-surface-950',
  },
})
export class MobileFooterComponent {
  protected nav = inject(NavStateService);

  readonly items: MobileFooterItem[] = [
    { label: 'Inicio', icon: 'fa-house', routerLink: '/' },
    { label: 'Mi cuenta', icon: 'fa-user', action: 'account' },
    { label: 'Menú', icon: 'fa-bars-staggered', action: 'nav' },
    { label: 'Más', icon: 'fa-ellipsis', action: 'more' },
  ];

  /**
   * Toggle semantics — tap en el mismo tab cierra el overlay abierto. Abrir
   * un overlay nuevo delega el mutex a `nav.openOverlay()` (cerrar los otros
   * tres está garantizado ahí). El search overlay también entra en el mutex
   * vía `anyOverlayOpen` / `closeAllOverlays`, aunque no tiene tab propio:
   * evita que el usuario deje search abierto detrás de un nuevo tap "Menú".
   */
  handleAction(action: MobileFooterAction): void {
    if (this.isActionActive(action)) {
      this.nav.closeAllOverlays();
    } else {
      this.nav.openOverlay(action);
    }
  }

  /**
   * Cierra cualquier overlay al tocar un routerLink tab. Necesario porque
   * Angular Router NO dispara `NavigationEnd` cuando el URL destino es el
   * mismo que el actual (same-URL navigation), y el listener en
   * NavStateService que cierra overlays depende de ese evento.
   *
   * Ej: user en `/`, abre "Mi cuenta", toca "Inicio" → no hay nav, el
   * drawer se quedaría abierto. Este handler lo resuelve.
   */
  closeOverlays(): void {
    this.nav.closeAllOverlays();
  }

  isActionActive(action: MobileFooterAction): boolean {
    switch (action) {
      case 'nav':
        return this.nav.sidebarOpen();
      case 'account':
        return this.nav.accountDrawerOpen();
      case 'more':
        return this.nav.moreOverlayOpen();
    }
  }
}
