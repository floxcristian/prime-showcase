import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { DrawerModule } from 'primeng/drawer';
import { ButtonModule } from 'primeng/button';
import { SideMenuComponent } from '../side-menu/side-menu.component';

const NG_MODULES = [CommonModule, RouterOutlet];
const PRIME_MODULES = [DrawerModule, ButtonModule];
const COMPONENTS = [SideMenuComponent];

@Component({
  selector: 'app-main',
  imports: [...NG_MODULES, ...PRIME_MODULES, ...COMPONENTS],
  templateUrl: './main.component.html',
  styleUrl: './main.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'flex-1 h-full overflow-y-auto pb-0.5',
  },
})
export class MainComponent {
  mobileMenuVisible = signal(false);

  toggleMobileMenu() {
    this.mobileMenuVisible.update(visible => !visible);
  }

  closeMobileMenu() {
    this.mobileMenuVisible.set(false);
  }
}