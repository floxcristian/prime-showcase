import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  Injector,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

import { BreadcrumbBarComponent } from '../breadcrumb-bar/breadcrumb-bar.component';
import { NavOverlayComponent } from '../nav-overlay/nav-overlay.component';
import { NavStateService } from '../nav/nav-state.service';
import { ToolbarComponent } from '../toolbar/toolbar.component';

const NG_MODULES = [RouterOutlet];
const COMPONENTS = [
  BreadcrumbBarComponent,
  NavOverlayComponent,
  ToolbarComponent,
];

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
export class MainComponent {
  private router = inject(Router);
  private injector = inject(Injector);
  private mainRef = viewChild<ElementRef<HTMLElement>>('mainContent');

  protected nav = inject(NavStateService);

  constructor() {
    // Gestion de foco SPA (patron WCAG): mover foco a <main> en cada navegacion.
    // El siguiente Tab del usuario lo lleva al primer elemento interactivo de la pagina.
    // Ref: W3C WAI Managing Focus in SPA | ADR-001 §7
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        afterNextRender(
          () => {
            this.mainRef()?.nativeElement.focus({ preventScroll: true });
          },
          { injector: this.injector },
        );
      });
  }
}
