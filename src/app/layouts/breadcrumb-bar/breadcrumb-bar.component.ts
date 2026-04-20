import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { NavStateService } from '../nav/nav-state.service';

const NG_MODULES = [NgClass];

/**
 * Secondary toolbar dedicated to page-level context. Sits below the global
 * toolbar and hosts the breadcrumb on the left + a right slot (`<ng-content>`)
 * for per-page primary actions ("Nuevo cliente", "Exportar", etc.).
 *
 * Separation of concerns follows the Google Cloud / Azure Portal / Atlassian
 * convention:
 *   - Global toolbar → identity + cross-page controls (logo, search, account)
 *   - Breadcrumb bar → where you are + what you can do HERE
 *
 * Keeps the global toolbar clean of page-specific noise and gives every page
 * a natural home for its primary CTA without inventing an in-page header.
 */
@Component({
  selector: 'app-breadcrumb-bar',
  imports: [NG_MODULES],
  templateUrl: './breadcrumb-bar.component.html',
  styleUrl: './breadcrumb-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'h-12 shrink-0 border-b border-surface bg-surface-50 dark:bg-surface-900 flex items-center gap-3 px-6 w-full',
  },
})
export class BreadcrumbBarComponent {
  protected nav = inject(NavStateService);
}
