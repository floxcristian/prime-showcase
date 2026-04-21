import { NgClass } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { RouterModule } from '@angular/router';

import { NavStateService } from '../nav/nav-state.service';

type MobileFooterAction = 'nav' | 'account';

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
    { label: 'Notificaciones', icon: 'fa-bell', routerLink: '/inbox' },
    { label: 'Menú', icon: 'fa-bars-staggered', action: 'nav' },
  ];

  /**
   * True si cualquier action overlay está abierto (nav-overlay o account drawer).
   * Usado para desactivar el active state de los routerLink tabs cuando un
   * action tab toma el control visual — evita el bug de 2 tabs marcados
   * activos simultáneamente.
   */
  protected readonly anyActionOpen = computed(
    () => this.nav.sidebarOpen() || this.nav.accountDrawerOpen(),
  );

  handleAction(action: MobileFooterAction): void {
    if (action === 'nav') this.nav.sidebarOpen.set(true);
    else if (action === 'account') this.nav.accountDrawerOpen.set(true);
  }

  /**
   * Cierra cualquier overlay abierto al tocar un routerLink tab. Necesario
   * porque Angular Router NO dispara `NavigationEnd` cuando el URL destino
   * es el mismo que el actual (same-URL navigation), y el listener en
   * NavStateService que cierra overlays depende de ese evento.
   *
   * Ej: user en `/`, abre "Mi cuenta", toca "Inicio" → no hay nav, el
   * drawer se quedaría abierto. Este handler lo resuelve.
   */
  closeOverlays(): void {
    this.nav.accountDrawerOpen.set(false);
    this.nav.sidebarOpen.set(false);
  }

  isActionActive(action: MobileFooterAction): boolean {
    if (action === 'nav') return this.nav.sidebarOpen();
    if (action === 'account') return this.nav.accountDrawerOpen();
    return false;
  }
}
