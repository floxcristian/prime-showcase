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
import {
  ActivatedRouteSnapshot,
  NavigationEnd,
  Router,
} from '@angular/router';
import { filter } from 'rxjs';

import { NAV_MODULES } from './constants/nav-modules';
import { NavModule } from './models/nav-module.interface';

/**
 * Tipo de overlay/drawer — fuente de verdad para el mutex. Cualquier surface
 * full-viewport (mobile) o full-screen-blocking (desktop mega-menu, drawer)
 * debe ser mutuamente exclusiva con las demás para evitar stacking visual.
 */
export type OverlayKind =
  | 'nav'
  | 'account'
  | 'search'
  | 'more'
  | 'notifications';

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
 * Global navigation state: módulo activo committeado, URL actual, overlay
 * mutex, triggerLeft del botón hamburger. Lo que NO vive aquí es el estado
 * transient del preview hover en el mega-menu — ese lo maneja
 * NavOverlayComponent local porque su lifetime coincide con el del overlay,
 * no con el de la app.
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

  /**
   * Single source of truth para el overlay abierto (si hay). El mutex queda
   * enforced by design: sólo UN kind puede estar en el signal a la vez, así
   * que es imposible que dos overlays coexistan aunque un consumer intente
   * hacer bypass. Los 5 flags individuales (`sidebarOpen`, etc.) son
   * `computed` derivados read-only — exponerlos como writables invitaría a
   * saltarse `open()`/`close()` y romper el mutex. Pattern Linear/Stripe
   * Dashboard UIStateService: single intent signal, derived boolean views.
   */
  private readonly _currentOverlay = signal<OverlayKind | null>(null);

  readonly sidebarOpen = computed(() => this._currentOverlay() === 'nav');
  /** Drawer "Mi cuenta" — datos personales del usuario. */
  readonly accountDrawerOpen = computed(
    () => this._currentOverlay() === 'account',
  );
  /** Full-screen search overlay mobile. */
  readonly searchOverlayOpen = computed(
    () => this._currentOverlay() === 'search',
  );
  /** Full-screen "Más" overlay mobile. */
  readonly moreOverlayOpen = computed(
    () => this._currentOverlay() === 'more',
  );
  /**
   * Full-screen notifications overlay mobile. En desktop las notificaciones
   * se ven vía popover + la ruta /notifications; en mobile este overlay
   * reemplaza a la ruta para evitar que el route swap desmonte la view de
   * fondo (p.ej. Overview) y re-dispare su ciclo de animación de charts.
   * La ruta /notifications sigue existiendo como deep-link fallback.
   */
  readonly notificationsOverlayOpen = computed(
    () => this._currentOverlay() === 'notifications',
  );

  /**
   * True si CUALQUIERA de los 5 overlays/drawers globales está abierto. Usado
   * para: (1) scroll lock del canvas de fondo, (2) el active-state del bottom
   * tab bar mobile — si un action overlay toma el control, los tabs de
   * routerLink no deben seguir pintados como activos aunque la URL coincida.
   */
  readonly anyOverlayOpen = computed(() => this._currentOverlay() !== null);

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

  readonly currentUrl = signal<string>(this.normalizeUrl(this.router.url));

  /**
   * Left viewport-pixel del botón hamburger del toolbar. Lo setea el toolbar
   * vía ResizeObserver + click handler. Lo consume el nav-overlay para
   * anchorear el panel desktop. Vive en el singleton porque los dos
   * componentes (toolbar, nav-overlay) no son ancestor/descendant y
   * comunicar via signal compartido es más claro que un service
   * intermediario o query selector cross-component.
   */
  readonly triggerLeft = signal<number>(0);

  readonly activeModule = computed<NavModule | undefined>(() =>
    this.modules.find((m) => m.id === this.activeModuleId()),
  );

  /**
   * Breadcrumb declarado vía `data: { breadcrumb: BreadcrumbCrumb[] }` en
   * `app.routes.ts`. Set en cada NavigationEnd, leído por la `breadcrumb`
   * computed con prioridad sobre la heurística nav-tree-derivada.
   *
   * `null` significa "ruta sin override" → fallback a la lógica legacy
   * (nav-tree match). Esto preserva backward-compat para rutas que aún no
   * declaran su breadcrumb.
   */
  private readonly routeBreadcrumb = signal<BreadcrumbCrumb[] | null>(null);

  readonly breadcrumb = computed<BreadcrumbCrumb[]>(() => {
    // Prioridad #1: route.data.breadcrumb (declarativo, explícito).
    // Source of truth cuando la ruta lo provee — evita ambigüedad de
    // múltiples leaves del nav-tree compartiendo URL.
    const fromRoute = this.routeBreadcrumb();
    if (fromRoute) return fromRoute;

    const url = this.currentUrl();

    // Home (`/`) es el dashboard general — NO deriva del árbol de módulos.
    // Múltiples leaves del nav-tree apuntan a '/' (ej: NPS, Metas & KPIs,
    // Campañas activas, Logs de acceso en distintos módulos), así que la
    // heurística de "primer match" devolvía arbitrariamente uno de ellos.
    // El contenido real de home es un dashboard cross-módulo, no una de
    // esas leaves. Patrón Linear/Notion/Gmail: home siempre es "Inicio"
    // irrespective of nav history.
    if (url === '/') {
      return [{ title: 'Inicio', icon: 'fa-sharp fa-regular fa-house' }];
    }

    // Fallback legacy: derivar del nav-tree para rutas sin route.data.
    // Cubre el caso de rutas agregadas en el futuro sin migrar — devuelve
    // un breadcrumb "best-effort" en vez de `[]`.
    const mod = this.activeModule();
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

  constructor() {
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
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
        // Lee `data.breadcrumb` del leaf snapshot. Si la ruta lo declara,
        // override; si no, `null` y el computed cae al legacy nav-tree.
        this.routeBreadcrumb.set(this.readRouteBreadcrumb());
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

      // Cleanup defensivo: si el service se destruye (SSR teardown, test
      // harness), remover la clase para no dejar el DOM con scroll lock
      // residual. En runtime normal es no-op porque el singleton vive hasta
      // que el app root muere.
      this.destroyRef.onDestroy(() => {
        this.renderer.removeClass(
          this.document.documentElement,
          OVERLAY_OPEN_CLASS,
        );
      });
    }
  }

  // ─── Overlay mutex API ───────────────────────────────────────────────────
  //
  // Los overlays globales (nav, account, search, more, notifications) son
  // mutuamente exclusivos. Abrir uno implica cerrar los otros. El mutex está
  // enforced by design: `_currentOverlay` sólo puede valer una key a la vez.
  // Consumers expresan intención (`openNav()`, `close('account')`) sin tocar
  // estado — patrón Linear/Stripe Dashboard UIStateService.

  /** Abre el overlay indicado; cierra implícitamente el que estuviera abierto. */
  openOverlay(kind: OverlayKind): void {
    this._currentOverlay.set(kind);
  }

  /**
   * Cierra el overlay `kind` si es el actual. No-op si ya está cerrado o si
   * es otro el abierto — evita que un componente cierre un overlay ajeno
   * (ej. el settings-drawer emitiendo visibleChange=false mientras el user
   * ya abrió search vía el footer mutex).
   */
  close(kind: OverlayKind): void {
    if (this._currentOverlay() === kind) {
      this._currentOverlay.set(null);
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

  openNotifications(): void {
    this.openOverlay('notifications');
  }

  closeAllOverlays(): void {
    this._currentOverlay.set(null);
  }

  /**
   * Back navigation Angular-native. Navega hacia `previousUrl` vía
   * `router.navigateByUrl()` en lugar de `history.back()`, para eliminar el
   * efecto visual de back-gesture nativo del browser (Chrome Android
   * animation + scroll-restoration) que entra en carrera con el swap del
   * `router-outlet` y produce flash/lag percibido. Fallback a `/` si no hay
   * URL previa (deep-link inicial).
   */
  goBack(): void {
    const prev = this.previousUrl();
    this.router.navigateByUrl(prev ?? '/');
  }

  setActiveModule(id: string): void {
    if (this.activeModuleId() !== id) {
      this.activeModuleId.set(id);
    }
  }

  toggleSidebar(): void {
    if (this.sidebarOpen()) {
      this.close('nav');
    } else {
      this.openNav();
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

  /**
   * Lee `data.breadcrumb` del snapshot del router. Walk al deepest child
   * porque las rutas anidadas (parent + child con loadComponent) emitirían
   * el data del PARENT si leyéramos del root. El leaf siempre tiene el
   * data más específico.
   *
   * @returns el array de crumbs si la ruta declara `data.breadcrumb`,
   *          o `null` si no — el caller (`breadcrumb` computed) usa null
   *          como señal de "fallback al legacy nav-tree".
   */
  private readRouteBreadcrumb(): BreadcrumbCrumb[] | null {
    let snapshot: ActivatedRouteSnapshot | null =
      this.router.routerState.snapshot.root;
    while (snapshot?.firstChild) snapshot = snapshot.firstChild;
    const data = snapshot?.data?.['breadcrumb'];
    // Validación defensiva: data es `Record<string, any>` (Angular type).
    // Si alguien pone `data.breadcrumb: 'algo no array'` por error, no
    // queremos crashear el computed — fallback gracefully a null.
    if (!Array.isArray(data) || data.length === 0) return null;
    return data as BreadcrumbCrumb[];
  }
}
