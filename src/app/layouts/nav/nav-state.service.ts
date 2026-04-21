import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

import { NAV_MODULES } from './constants/nav-modules';
import { NavModule } from './models/nav-module.interface';

export interface BreadcrumbCrumb {
  title: string;
  icon?: string;
  url?: string;
}

/**
 * Owns the three-tier navigation state: which module is committed (visible in
 * the fixed sidebar), which module the user is peeking at via hover/focus (the
 * flyout), and which sections are expanded in the accordion.
 *
 * Hover intent uses two asymmetric delays modeled on the Microsoft 365 / Azure
 * Portal pattern:
 *   - **Open delay (150ms)**: transient mouse passes over a rail item while
 *     aiming at something else don't open the flyout. Only a deliberate pause
 *     does.
 *   - **Switch delay (0ms)**: once the flyout is already open, moving to
 *     another rail item switches instantly — the user is actively browsing.
 *   - **Close delay (200ms)**: gives the user time to cross the dead zone
 *     between rail and flyout without losing the panel.
 *
 * A single timer handle is reused across all these transitions: any new call
 * to `setHoverModule*` cancels the pending one. This guarantees we never have
 * two competing timers racing to set `hoveredModuleId`.
 */
@Injectable({ providedIn: 'root' })
export class NavStateService {
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  readonly modules: readonly NavModule[] = NAV_MODULES;

  readonly activeModuleId = signal<string>('crm');
  readonly sidebarOpen = signal<boolean>(false);
  /** Drawer "Mi cuenta" — datos personales del usuario (registros, preferencias, stats, oportunidades). */
  readonly accountDrawerOpen = signal<boolean>(false);
  readonly expandedSectionIds = signal<ReadonlySet<string>>(
    new Set(['crm.adm-clientes']),
  );
  readonly currentUrl = signal<string>(this.normalizeUrl(this.router.url));
  readonly hoveredModuleId = signal<string | null>(null);
  /** x-position of the overlay trigger button (hamburger) in viewport pixels. */
  readonly triggerLeft = signal<number>(0);

  readonly activeModule = computed<NavModule | undefined>(() =>
    this.modules.find((m) => m.id === this.activeModuleId()),
  );

  /**
   * The module to render in the flyout. Null when there's no hover, or when
   * the hovered module equals the committed one (hovering the "you are here"
   * rail item is a no-op — the sidebar already shows that content).
   */
  readonly flyoutModule = computed<NavModule | null>(() => {
    const hoveredId = this.hoveredModuleId();
    if (!hoveredId || hoveredId === this.activeModuleId()) return null;
    return this.modules.find((m) => m.id === hoveredId) ?? null;
  });

  readonly breadcrumb = computed<BreadcrumbCrumb[]>(() => {
    const mod = this.activeModule();
    const url = this.currentUrl();
    if (!mod) return [];
    for (const section of mod.sections) {
      const leaf = section.children.find((c) => c.url === url);
      if (leaf) {
        return [
          { title: mod.title, icon: mod.icon },
          { title: section.title },
          { title: leaf.title, url: leaf.url },
        ];
      }
    }
    return [{ title: mod.title, icon: mod.icon }];
  });

  private hoverTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((e) => {
        const url = this.normalizeUrl(e.urlAfterRedirects);
        this.currentUrl.set(url);
        this.syncActiveModuleFromUrl(url);
        this.clearHoverImmediate();
        // Cerrar overlays al navegar — en mobile el bottom tab bar se
        // comporta como page navigation: tap "Inicio" debería cerrar el
        // drawer/overlay y mostrar home.
        this.accountDrawerOpen.set(false);
        this.sidebarOpen.set(false);
      });

    this.destroyRef.onDestroy(() => this.cancelHoverTimer());
  }

  setActiveModule(id: string): void {
    if (this.activeModuleId() !== id) {
      this.activeModuleId.set(id);
      this.ensureFirstSectionExpanded(id);
    }
    this.clearHoverImmediate();
  }

  toggleSidebar(): void {
    this.sidebarOpen.update((v) => !v);
  }

  toggleSection(id: string): void {
    this.expandedSectionIds.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  isSectionExpanded(id: string): boolean {
    return this.expandedSectionIds().has(id);
  }

  /**
   * Called when the user's pointer (or keyboard focus) enters a rail item.
   * Switches the flyout module with a short delay from idle, or instantly if
   * the flyout is already open — mirroring the Windows/macOS menu behavior
   * where "first open" costs a pause and "browsing" is immediate.
   */
  openHoverModule(id: string): void {
    const delayMs = this.hoveredModuleId() === null ? 150 : 0;
    this.scheduleHover(id, delayMs);
    // Keep the hovered module readable even on first visit. Only seeds when
    // the module has zero sections expanded — preserves user's manual
    // collapse choices from a prior visit.
    this.ensureFirstSectionExpanded(id);
  }

  /** Called on mouseleave from the rail or flyout. */
  closeHoverModule(): void {
    this.scheduleHover(null, 200);
  }

  /**
   * Keeps the flyout open while the pointer hovers the flyout panel itself.
   * Cancels any pending close scheduled by the rail's mouseleave.
   */
  cancelHoverClose(): void {
    this.cancelHoverTimer();
  }

  /** Synchronously clears hover state — used on commit or route change. */
  clearHoverImmediate(): void {
    this.cancelHoverTimer();
    if (this.hoveredModuleId() !== null) this.hoveredModuleId.set(null);
  }

  ensureFirstSectionExpanded(moduleId: string): void {
    const mod = this.modules.find((m) => m.id === moduleId);
    if (!mod || mod.sections.length === 0) return;
    const expanded = this.expandedSectionIds();
    const hasAny = mod.sections.some((s) => expanded.has(s.id));
    if (!hasAny) {
      this.expandedSectionIds.update(
        (set) => new Set([...set, mod.sections[0].id]),
      );
    }
  }

  private scheduleHover(id: string | null, delayMs: number): void {
    this.cancelHoverTimer();
    if (delayMs <= 0) {
      this.hoveredModuleId.set(id);
      return;
    }
    this.hoverTimer = setTimeout(() => {
      this.hoveredModuleId.set(id);
      this.hoverTimer = null;
    }, delayMs);
  }

  private cancelHoverTimer(): void {
    if (this.hoverTimer !== null) {
      clearTimeout(this.hoverTimer);
      this.hoverTimer = null;
    }
  }

  private syncActiveModuleFromUrl(url: string): void {
    const current = this.activeModule();
    const currentHasUrl = current?.sections.some((s) =>
      s.children.some((c) => c.url === url),
    );
    if (currentHasUrl) return;
    const match = this.modules.find((m) =>
      m.sections.some((s) => s.children.some((c) => c.url === url)),
    );
    if (match && match.id !== this.activeModuleId()) {
      this.activeModuleId.set(match.id);
    }
  }

  private normalizeUrl(url: string): string {
    const clean = url.split('?')[0].split('#')[0];
    return clean === '' ? '/' : clean;
  }
}
