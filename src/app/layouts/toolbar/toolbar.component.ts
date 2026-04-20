import { NgClass } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  Injector,
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
      'toolbar-brand-bg h-16 shrink-0 border-b border-surface flex items-center gap-3 px-4 w-full',
    '(window:resize)': 'measureTrigger()',
  },
})
export class ToolbarComponent {
  private injector = inject(Injector);
  private auth = inject(AuthService);
  private router = inject(Router);
  private config = inject(AppConfigService);
  protected nav = inject(NavStateService);

  protected readonly darkTheme = this.config.darkTheme;
  protected readonly settingsVisible = signal(false);
  private navTriggerRef = viewChild<ElementRef<HTMLButtonElement>>('navTrigger');

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
      label: 'Mi perfil',
      icon: 'fa-sharp fa-regular fa-user',
    },
    {
      label: 'Preferencias',
      icon: 'fa-sharp fa-regular fa-sliders',
      command: () => this.settingsVisible.set(true),
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
