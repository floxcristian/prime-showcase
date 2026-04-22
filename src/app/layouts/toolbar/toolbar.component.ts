import { NgClass } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
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
import { TooltipModule } from 'primeng/tooltip';

import { AppConfigService } from '../../core/services/app-config/app-config.service';
import { AuthService } from '../../core/services/auth/auth.service';
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
  TooltipModule,
];
const LOCAL_COMPONENTS = [SettingsDrawerComponent];

@Component({
  selector: 'app-toolbar',
  imports: [NG_MODULES, PRIME_MODULES, LOCAL_COMPONENTS],
  templateUrl: './toolbar.component.html',
  styleUrl: './toolbar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'toolbar-brand-bg relative z-20 h-16 shrink-0 flex items-center gap-2 px-2 md:gap-3 md:px-4 w-full transition-shadow duration-200',
    '[class.toolbar-elevated]': 'elevated()',
    '(window:resize)': 'measureTrigger()',
  },
})
export class ToolbarComponent {
  private injector = inject(Injector);
  private destroyRef = inject(DestroyRef);
  private auth = inject(AuthService);
  private router = inject(Router);
  private config = inject(AppConfigService);
  protected nav = inject(NavStateService);

  protected readonly darkTheme = this.config.darkTheme;
  /** True cuando viewport es <md (768px). Usado para placeholder corto del
   * input de búsqueda. Se hidrata en afterNextRender para evitar acceder a
   * window durante SSR. */
  protected readonly isMobile = signal(false);
  private navTriggerRef = viewChild<ElementRef<HTMLButtonElement>>('navTrigger');

  /**
   * Eleva el toolbar con un box-shadow sutil cuando el breadcrumb bar está
   * colapsado (hide-on-scroll-down). Sin el ancla del breadcrumb debajo, el
   * toolbar necesita separación visual del canvas — el shadow ocupa ese rol.
   */
  readonly elevated = input<boolean>(false);

  constructor() {
    afterNextRender(
      () => {
        this.measureTrigger();
        this.initMobileListener();
      },
      { injector: this.injector },
    );
  }

  private initMobileListener(): void {
    const mql = window.matchMedia('(max-width: 767.98px)');
    const update = () => this.isMobile.set(mql.matches);
    mql.addEventListener('change', update);
    this.destroyRef.onDestroy(() => mql.removeEventListener('change', update));
    update();
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
      command: () => this.nav.accountDrawerOpen.set(true),
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
