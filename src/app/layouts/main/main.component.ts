import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SideMenuComponent } from '../side-menu/side-menu.component';

const NG_MODULES = [RouterOutlet];
const COMPONENTS = [SideMenuComponent];

@Component({
  selector: 'app-main',
  imports: [NG_MODULES, COMPONENTS],
  templateUrl: './main.component.html',
  styleUrl: './main.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'flex-1 h-full overflow-hidden',
  },
})
export class MainComponent {}
