import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  signal,
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
  private destroyRef = inject(DestroyRef);
  private mainRef = viewChild<ElementRef<HTMLElement>>('mainContent');

  protected nav = inject(NavStateService);

  /**
   * True cuando main tiene scrollTop > 0. Usado para elevar el toolbar con
   * un box-shadow cuando hay contenido "detrás" — patrón bigtech (Medium,
   * Linear, Gmail, Stripe Dashboard). El breadcrumb vive DENTRO del scroll
   * de main y se desplaza naturalmente con el contenido, sin requerir
   * lógica de hide/show.
   */
  protected readonly isScrolled = signal(false);

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
            const el = this.mainRef()?.nativeElement;
            el?.focus({ preventScroll: true });
            // Reset scroll al top en cada ruta nueva (mantener breadcrumb y
            // contenido en la posición inicial esperada).
            if (el) el.scrollTop = 0;
            this.isScrolled.set(false);
          },
          { injector: this.injector },
        );
      });

    // Scroll listener simple: true cuando hay scroll > 0. Dispara el shadow
    // del toolbar cuando el usuario pasa contenido por debajo del toolbar.
    afterNextRender(
      () => {
        const el = this.mainRef()?.nativeElement;
        if (!el) return;

        const onScroll = () => {
          const scrolled = el.scrollTop > 0;
          if (scrolled !== this.isScrolled()) {
            this.isScrolled.set(scrolled);
          }
        };

        el.addEventListener('scroll', onScroll, { passive: true });
        this.destroyRef.onDestroy(() => {
          el.removeEventListener('scroll', onScroll);
        });
      },
      { injector: this.injector },
    );
  }
}
