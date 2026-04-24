import { NgClass } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  Injector,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { MenuModule } from 'primeng/menu';
import { Popover } from 'primeng/popover';
import { TooltipModule } from 'primeng/tooltip';

import { AppConfigService } from '../../core/services/app-config/app-config.service';
import { AuthService } from '../../core/services/auth/auth.service';
import { NotificationsService } from '../../modules/notifications/services/notifications.service';
import { BackButtonComponent } from '../../shared/back-button/back-button.component';
import { NavStateService } from '../nav/nav-state.service';
import { SettingsDrawerComponent } from '../side-menu/settings-drawer/settings-drawer.component';

const NG_MODULES = [NgClass, RouterModule];
const PRIME_MODULES = [
  AvatarModule,
  ButtonModule,
  IconField,
  InputIcon,
  InputTextModule,
  MenuModule,
  Popover,
  TooltipModule,
];
const LOCAL_COMPONENTS = [BackButtonComponent, SettingsDrawerComponent];

@Component({
  selector: 'app-toolbar',
  imports: [NG_MODULES, PRIME_MODULES, LOCAL_COMPONENTS],
  templateUrl: './toolbar.component.html',
  styleUrl: './toolbar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'toolbar-brand-bg relative z-20 h-16 shrink-0 flex items-center gap-2 px-2 lg:gap-3 lg:pl-4 lg:pr-0 w-full transition-shadow duration-200',
    '[class.toolbar-elevated]': 'elevated()',
    '(window:resize)': 'measureTrigger()',
  },
})
export class ToolbarComponent {
  private injector = inject(Injector);
  private auth = inject(AuthService);
  private router = inject(Router);
  private config = inject(AppConfigService);
  protected nav = inject(NavStateService);
  protected notifications = inject(NotificationsService);

  protected readonly darkTheme = this.config.darkTheme;
  /** Estado visual del bell: true mientras el popover de notificaciones está
   * abierto. Bindeado a los eventos onShow/onHide del popover para que el
   * bell quede "pressed" como feedback consistente con el Menú button. */
  protected readonly notifOpen = signal(false);
  private navTriggerRef = viewChild<ElementRef<HTMLButtonElement>>('navTrigger');

  /**
   * Eleva el toolbar con un box-shadow sutil cuando el breadcrumb bar está
   * colapsado (hide-on-scroll-down). Sin el ancla del breadcrumb debajo, el
   * toolbar necesita separación visual del canvas — el shadow ocupa ese rol.
   */
  readonly elevated = input<boolean>(false);

  /**
   * Design tokens para el notif popover. PrimeNG Aura default setea padding
   * en `.p-popover-content` (~1rem) pensado para popovers genéricos tipo
   * card. Acá el contenido trae su propio chrome (header con border-b, list
   * scrollable, footer con border-t) — el padding externo crea dos capas de
   * espacio redundante arriba y abajo, rompiendo el ajuste flush del border
   * del header/footer contra el borde del popover.
   *
   * Ref de tokens: @primeuix/themes/dist/aura/popover/index.mjs expone
   * `content: { padding }`. Zero-outing acá preserva el resto del styling
   * (bg, border, shadow, arrow) que sí queremos.
   */
  protected readonly notifPopoverTokens = {
    content: { padding: '0' },
  };

  constructor() {
    afterNextRender(
      () => {
        this.measureTrigger();
      },
      { injector: this.injector },
    );
  }

  measureTrigger(): void {
    const el = this.navTriggerRef()?.nativeElement;
    if (!el) return;
    this.nav.triggerLeft.set(el.getBoundingClientRect().left);
  }
  protected readonly userMenu: MenuItem[] = [
    {
      label: 'Mi cuenta',
      icon: 'fa-sharp fa-regular fa-user',
      command: () => this.nav.openAccount(),
    },
    { separator: true },
    {
      label: 'Cerrar sesión',
      icon: 'fa-sharp fa-regular fa-arrow-right-from-bracket',
      command: () => this.logout(),
    },
  ];

  private settingsTriggerRef =
    viewChild<ElementRef<HTMLButtonElement>>('settingsTrigger');

  toggleTheme(): void {
    this.config.setDarkTheme(!this.darkTheme());
  }

  restoreSettingsTriggerFocus(): void {
    afterNextRender(
      () => {
        this.settingsTriggerRef()?.nativeElement.focus();
      },
      { injector: this.injector },
    );
  }

  logout(): void {
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }
}
