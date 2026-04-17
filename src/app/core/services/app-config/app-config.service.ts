import { isPlatformBrowser, isPlatformServer } from '@angular/common';
import {
  DOCUMENT,
  inject,
  Injectable,
  PLATFORM_ID,
  REQUEST,
  Signal,
  signal,
} from '@angular/core';
import {
  parseThemeCookie,
  serializeThemeCookie,
} from './theme-cookie.util';

/**
 * Owns the only user preference the app currently persists: dark-mode.
 *
 * Design principles (ref: ADR-001 §4):
 *   1. **Cookie as single source of truth** — readable from both SSR (via
 *      `REQUEST`) and browser (`document.cookie`), which is what makes
 *      zero-FOUC first paint possible. localStorage was removed because it
 *      is unreadable from the server and every additional store multiplies
 *      the places truth can diverge.
 *   2. **Explicit setter over reactive effect** — `setDarkTheme()` is the
 *      only write path. Earlier revisions wrapped persistence in an `effect`
 *      plus an `isFirstRun` skip-flag; that pattern works but conflates
 *      "state changed" with "user action." Explicit actions is the pattern
 *      used by Redux / Zustand / Jotai / Recoil and is easier to audit.
 *   3. **Counter signal for discrete events** — dark-mode transitions notify
 *      via a monotonically incrementing `themeChanged` signal rather than a
 *      boolean pulse (`set(true)` then `setTimeout(() => set(false))`). The
 *      pulse had a setTimeout race window and a confusing two-state shape;
 *      a counter has no intermediate state and is trivially testable.
 */
@Injectable({ providedIn: 'root' })
export class AppConfigService {
  private document = inject(DOCUMENT);
  private platformId = inject(PLATFORM_ID);
  // Available only during SSR; on the browser this resolves to null.
  private request = inject(REQUEST, { optional: true });

  private readonly _darkTheme = signal<boolean>(this.readInitialTheme());
  private readonly _themeChanged = signal<number>(0);

  /**
   * Read-only view of the dark-mode preference. Consumers subscribe by
   * reading this signal inside a `computed` or `effect`. Mutate via
   * `setDarkTheme()` — direct writes are blocked by the readonly facade.
   */
  readonly darkTheme: Signal<boolean> = this._darkTheme.asReadonly();

  /**
   * Ticks once after every successful dark-mode transition finishes applying
   * to the DOM. Consumers that must rebuild against fresh CSS tokens (e.g.
   * Chart.js, which reads computed styles at init time) subscribe in an
   * `effect` and re-run their init logic on each tick.
   */
  readonly themeChanged: Signal<number> = this._themeChanged.asReadonly();

  constructor() {
    // Apply the initial class synchronously so:
    //  - On SSR, the serialized HTML carries `<html class="p-dark">` when the
    //    user has the theme cookie → zero FOUC on first paint.
    //  - On the browser, even if the inline bootstrap in index.html missed
    //    (e.g. cookie written mid-session), the class is reconciled before
    //    hydration completes.
    // Ref: ADR-001 §4 — theme FOUC prevention.
    this.applyDarkClass(this._darkTheme());
  }

  /**
   * Single write path for the dark-mode preference. Handles:
   *   1. State update (the readonly signal tick).
   *   2. Cookie persistence (browser only — SSR reads, never writes).
   *   3. View Transition animation (with graceful fallback on older browsers).
   *   4. `themeChanged` notification after the DOM class is applied.
   *
   * Idempotent — calling with the current value is a no-op, so UI toggles
   * can fire without guards and SSR replay can't loop.
   */
  setDarkTheme(dark: boolean): void {
    if (dark === this._darkTheme()) return;
    this._darkTheme.set(dark);
    this.persistTheme(dark);
    this.applyThemeTransition(dark);
  }

  /**
   * Authoritative source for dark mode on bootstrap:
   *   1. Cookie (server-readable → SSR parity).
   *   2. The `p-dark` class already applied by the pre-hydration inline
   *      script in index.html (which honors `prefers-color-scheme` when no
   *      cookie is present).
   *
   * `platformId` is always `server` or `browser` in Angular runtime — no
   * third branch needed.
   */
  private readInitialTheme(): boolean {
    if (isPlatformServer(this.platformId)) {
      const cookieHeader = this.request?.headers.get('cookie') ?? null;
      return parseThemeCookie(cookieHeader) === 'dark';
    }

    const fromCookie = parseThemeCookie(this.document.cookie);
    if (fromCookie !== null) return fromCookie === 'dark';
    return this.document.documentElement.classList.contains('p-dark');
  }

  private persistTheme(dark: boolean): void {
    if (!isPlatformBrowser(this.platformId)) return;
    // `location.protocol` is always defined in a browser context, and this
    // method is unreachable from SSR (guarded above). Pass the HTTPS signal
    // to the pure serializer rather than have it sniff globals itself.
    const secure = location.protocol === 'https:';
    this.document.cookie = serializeThemeCookie(
      dark ? 'dark' : 'light',
      { secure },
    );
  }

  private applyThemeTransition(dark: boolean): void {
    if (!isPlatformBrowser(this.platformId)) return;

    if (typeof this.document.startViewTransition !== 'function') {
      // Browsers without the View Transition API (Firefox < 129, older Safari)
      // get an instant class swap. `notifyThemeChanged` is fired synchronously
      // because there is no transition lifecycle to wait on.
      this.applyDarkClass(dark);
      this.notifyThemeChanged();
      return;
    }

    // `transition.ready` fires once the pseudo-elements are set up and the new
    // DOM is painted — the `.p-dark` class is in effect and CSS custom
    // properties have flipped, so it is safe to notify consumers like Chart.js
    // that rebuild against fresh computed styles. `ready` rejects when the
    // browser skips the transition (rapid toggle, reduced-motion); either way
    // the update callback has run, so notifying on both settle paths is safe.
    this.document
      .startViewTransition(() => this.applyDarkClass(dark))
      .ready.then(
        () => this.notifyThemeChanged(),
        () => this.notifyThemeChanged(),
      );
  }

  private applyDarkClass(dark: boolean): void {
    this.document.documentElement.classList.toggle('p-dark', dark);
  }

  private notifyThemeChanged(): void {
    this._themeChanged.update(v => v + 1);
  }
}
