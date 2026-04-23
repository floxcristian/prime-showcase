import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  computed,
  DestroyRef,
  effect,
  inject,
  Injectable,
  PLATFORM_ID,
  Renderer2,
  RendererFactory2,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

import { NAV_MODULES } from './constants/nav-modules';
import { NavModule } from './models/nav-module.interface';

/**
 * Tipo de overlay/drawer — fuente de verdad para el mutex. Cualquier surface
 * full-viewport (mobile) o full-screen-blocking (desktop mega-menu, drawer)
 * debe ser mutuamente exclusiva con las demás para evitar stacking visual.
 */
export type OverlayKind = 'nav' | 'account' | 'search' | 'more';

/**
 * Clase toggled en <html> cuando hay cualquier overlay abierto — permite al
 * CSS lockear el scroll del canvas de fondo. Nombre semántico (no Tailwind
 * utility) porque la regla convive con las de PrimeNG en styles.scss y el
 * escaneo visual es mejor con una clase descriptiva.
 */
const OVERLAY_OPEN_CLASS = 'overlay-open';

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
  private platformId = inject(PLATFORM_ID);
  private document = inject(DOCUMENT);
  private renderer: Renderer2 = inject(RendererFactory2).createRenderer(
    null,
    null,
  );

  readonly modules: readonly NavModule[] = NAV_MODULES;

  readonly activeModuleId = signal<string>('crm');
  readonly sidebarOpen = signal<boolean>(false);
  /** Drawer "Mi cuenta" — datos personales del usuario (registros, preferencias, stats, oportunidades). */
  readonly accountDrawerOpen = signal<boolean>(false);
  /** Full-screen search overlay mobile — búsquedas recientes + vistos recientemente. */
  readonly searchOverlayOpen = signal<boolean>(false);
  /** Full-screen "Más" overlay mobile — links secundarios (ayuda, legal, logout). */
  readonly moreOverlayOpen = signal<boolean>(false);

  /**
   * True si CUALQUIERA de los 4 overlays/drawers globales está abierto. Usado
   * para: (1) scroll lock del canvas de fondo, (2) el active-state del bottom
   * tab bar mobile — si un action overlay toma el control, los tabs de
   * routerLink no deben seguir pintados como activos aunque la URL coincida.
   */
  readonly anyOverlayOpen = computed(
    () =>
      this.sidebarOpen() ||
      this.accountDrawerOpen() ||
      this.searchOverlayOpen() ||
      this.moreOverlayOpen(),
  );

  /**
   * URL visitada antes de `currentUrl`. Rellenada en cada NavigationEnd
   * ANTES de pisar `currentUrl` — así `goBack()` puede ejecutar una
   * navegación Angular-native hacia ella, sin tocar `history.back()`.
   *
   * Por qué NO usar `Location.back()` / `history.back()`:
   *   Chrome Android dispara su gesto de back nativo (preview de la página
   *   anterior, scroll-restoration) al detectar el pop del history stack. Si
   *   la app es SPA-routed, eso entra en carrera con el swap del
   *   `router-outlet` + el re-eval del @if del toolbar → un frame de
   *   contenido inconsistente que se percibe como lag/flash. Navegar vía
   *   `router.navigateByUrl(previousUrl)` mantiene la transición 100%
   *   controlada por Angular (mismo frame de CD que el route commit) y
   *   elimina el efecto visual.
   *
   * Tradeoff: el history stack crece en lugar de ir back-forward. Para un
   * ERP es aceptable — los usuarios no usan el history del browser como
   * mecanismo primario de navegación.
   */
  private readonly previousUrl = signal<string | null>(null);

  /**
   * True cuando hay URL previa dentro de la SPA a la que volver. Falso en
   * deep-link inicial (único estado) — el back cae al fallback `/`.
   */
  readonly canGoBack = computed(() => this.previousUrl() !== null);
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
        // Actualiza previousUrl ANTES de pisar currentUrl — así goBack()
        // conoce el target. Se ignora si la nueva URL es idéntica a la
        // actual (same-URL navigation, ej. click en el mismo tab del
        // footer) para evitar que el back redirija a sí mismo.
        const prev = this.currentUrl();
        if (prev && prev !== url) {
          this.previousUrl.set(prev);
        }
        this.currentUrl.set(url);
        this.syncActiveModuleFromUrl(url);
        this.clearHoverImmediate();
        // Cerrar overlays al navegar — en mobile el bottom tab bar se
        // comporta como page navigation: tap "Inicio" debería cerrar el
        // drawer/overlay y mostrar home.
        this.closeAllOverlays();
      });

    // Scroll lock: togglea `.overlay-open` en <html> cuando cualquier overlay
    // está abierto. Un effect reactivo garantiza que el lock se aplique
    // sincrónicamente con el cambio de estado y se libere al cerrar (o al
    // navegar, porque NavigationEnd dispara closeAllOverlays). Platform guard
    // porque RendererFactory funciona en SSR pero documentElement no existe
    // en todos los runners server-side. Ref: ADR-001 §Scroll lock + overlays.
    if (isPlatformBrowser(this.platformId)) {
      effect(() => {
        const locked = this.anyOverlayOpen();
        const html = this.document.documentElement;
        if (locked) {
          this.renderer.addClass(html, OVERLAY_OPEN_CLASS);
        } else {
          this.renderer.removeClass(html, OVERLAY_OPEN_CLASS);
        }
      });
    }

    this.destroyRef.onDestroy(() => this.cancelHoverTimer());
  }

  // ─── Overlay mutex API ───────────────────────────────────────────────────
  //
  // Los overlays globales (nav, account, search, more) son mutuamente
  // exclusivos. Abrir uno implica cerrar los otros tres. Centralizamos la
  // lógica aquí (single source of truth) en vez de replicar el mutex en cada
  // consumer — patrón Linear / Stripe Dashboard donde un UIStateService
  // coordina los surfaces globales. Los consumers solo expresan la intención
  // (`nav.openSearch()`), el service decide qué más cerrar.

  openOverlay(kind: OverlayKind): void {
    if (kind !== 'nav') this.sidebarOpen.set(false);
    if (kind !== 'account') this.accountDrawerOpen.set(false);
    if (kind !== 'search') this.searchOverlayOpen.set(false);
    if (kind !== 'more') this.moreOverlayOpen.set(false);

    switch (kind) {
      case 'nav':
        this.sidebarOpen.set(true);
        break;
      case 'account':
        this.accountDrawerOpen.set(true);
        break;
      case 'search':
        this.searchOverlayOpen.set(true);
        break;
      case 'more':
        this.moreOverlayOpen.set(true);
        break;
    }
  }

  openNav(): void {
    this.openOverlay('nav');
  }

  openAccount(): void {
    this.openOverlay('account');
  }

  openSearch(): void {
    this.openOverlay('search');
  }

  openMore(): void {
    this.openOverlay('more');
  }

  closeAllOverlays(): void {
    this.sidebarOpen.set(false);
    this.accountDrawerOpen.set(false);
    this.searchOverlayOpen.set(false);
    this.moreOverlayOpen.set(false);
  }

  /**
   * Back navigation Angular-native. Navega hacia `previousUrl` vía
   * `router.navigateByUrl()` en lugar de `history.back()`, para eliminar el
   * efecto visual de back-gesture nativo del browser (Chrome Android
   * animation + scroll-restoration) que entra en carrera con el swap del
   * `router-outlet` y produce flash/lag percibido. Fallback a `/` si no hay
   * URL previa (deep-link inicial).
   *
   * Patrón iOS/Android nativo + Gmail/Linear/Salesforce mobile: toda ruta
   * no-root tiene back, y back siempre aterriza dentro de la app sin
   * animaciones que compitan con la transición del framework.
   */
  goBack(): void {
    const prev = this.previousUrl();
    this.router.navigateByUrl(prev ?? '/');
  }

  setActiveModule(id: string): void {
    if (this.activeModuleId() !== id) {
      this.activeModuleId.set(id);
      this.ensureFirstSectionExpanded(id);
    }
    this.clearHoverImmediate();
  }

  toggleSidebar(): void {
    if (this.sidebarOpen()) {
      this.sidebarOpen.set(false);
    } else {
      this.openNav();
    }
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
