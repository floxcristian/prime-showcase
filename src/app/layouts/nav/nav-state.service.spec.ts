import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { NavStateService } from './nav-state.service';

/**
 * Limpia el class toggled por el effect de scroll-lock entre tests; jsdom
 * persiste el DOM across `it()` blocks y dejar residuo altera casos siguientes.
 */
function resetRootEnvironment(): void {
  document.documentElement.classList.remove('overlay-open');
}

describe('NavStateService — overlay mutex (browser)', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    resetRootEnvironment();
    TestBed.configureTestingModule({
      providers: [provideRouter([])],
    });
  });

  afterEach(() => {
    resetRootEnvironment();
  });

  it('starts with every overlay closed and anyOverlayOpen false', () => {
    const nav = TestBed.inject(NavStateService);
    expect(nav.sidebarOpen()).toBe(false);
    expect(nav.accountDrawerOpen()).toBe(false);
    expect(nav.searchOverlayOpen()).toBe(false);
    expect(nav.moreOverlayOpen()).toBe(false);
    expect(nav.notificationsOverlayOpen()).toBe(false);
    expect(nav.anyOverlayOpen()).toBe(false);
  });

  it('openX() opens the target overlay and keeps anyOverlayOpen() true', () => {
    const nav = TestBed.inject(NavStateService);
    nav.openNav();
    expect(nav.sidebarOpen()).toBe(true);
    expect(nav.anyOverlayOpen()).toBe(true);
  });

  it('opening a second overlay auto-closes the first (single-source-of-truth mutex)', () => {
    const nav = TestBed.inject(NavStateService);
    nav.openNav();
    nav.openSearch();
    // El mutex vive en `_currentOverlay`; imposible que dos computeds sean true
    // simultáneamente. Este invariant es el core de todo el sistema.
    expect(nav.sidebarOpen()).toBe(false);
    expect(nav.searchOverlayOpen()).toBe(true);
    expect(nav.anyOverlayOpen()).toBe(true);
  });

  it('opens each of the 5 kinds exclusively via the openX convenience methods', () => {
    const nav = TestBed.inject(NavStateService);
    const openers: [() => void, () => boolean][] = [
      [() => nav.openNav(), () => nav.sidebarOpen()],
      [() => nav.openAccount(), () => nav.accountDrawerOpen()],
      [() => nav.openSearch(), () => nav.searchOverlayOpen()],
      [() => nav.openMore(), () => nav.moreOverlayOpen()],
      [
        () => nav.openNotifications(),
        () => nav.notificationsOverlayOpen(),
      ],
    ];

    for (const [open, isOpen] of openers) {
      open();
      expect(isOpen()).toBe(true);
      // Todos los demás deben estar cerrados.
      const others = openers.filter(([, checker]) => checker !== isOpen);
      for (const [, otherChecker] of others) {
        expect(otherChecker()).toBe(false);
      }
    }
  });

  it('close(kind) is a guarded no-op when `kind` is not the currently open overlay', () => {
    const nav = TestBed.inject(NavStateService);
    nav.openNav();
    // Intentar cerrar un overlay que NO está abierto debe ser no-op —
    // evita que un callback tardío (ej. (visibleChange) de p-drawer) cierre
    // por error el overlay que acaba de abrirse vía mutex.
    nav.close('account');
    expect(nav.sidebarOpen()).toBe(true);
  });

  it('close(kind) closes when kind matches the currently open overlay', () => {
    const nav = TestBed.inject(NavStateService);
    nav.openSearch();
    nav.close('search');
    expect(nav.searchOverlayOpen()).toBe(false);
    expect(nav.anyOverlayOpen()).toBe(false);
  });

  it('closeAllOverlays() closes any open overlay', () => {
    const nav = TestBed.inject(NavStateService);
    nav.openMore();
    nav.closeAllOverlays();
    expect(nav.anyOverlayOpen()).toBe(false);
  });

  it('closeAllOverlays() is safe when nothing is open', () => {
    const nav = TestBed.inject(NavStateService);
    expect(() => nav.closeAllOverlays()).not.toThrow();
    expect(nav.anyOverlayOpen()).toBe(false);
  });

  it('toggleSidebar() opens via mutex (closing any other open overlay)', () => {
    const nav = TestBed.inject(NavStateService);
    nav.openAccount();
    nav.toggleSidebar();
    expect(nav.accountDrawerOpen()).toBe(false);
    expect(nav.sidebarOpen()).toBe(true);
  });

  it('toggleSidebar() closes the sidebar when it is the open overlay', () => {
    const nav = TestBed.inject(NavStateService);
    nav.openNav();
    nav.toggleSidebar();
    expect(nav.sidebarOpen()).toBe(false);
  });
});

describe('NavStateService — scroll lock effect (browser)', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    resetRootEnvironment();
    TestBed.configureTestingModule({
      providers: [provideRouter([])],
    });
  });

  afterEach(() => {
    resetRootEnvironment();
  });

  it('adds `overlay-open` class to <html> when any overlay opens', () => {
    const nav = TestBed.inject(NavStateService);
    nav.openNav();
    TestBed.flushEffects();
    expect(
      document.documentElement.classList.contains('overlay-open'),
    ).toBe(true);
  });

  it('removes the class when all overlays close', () => {
    const nav = TestBed.inject(NavStateService);
    nav.openNav();
    TestBed.flushEffects();
    nav.closeAllOverlays();
    TestBed.flushEffects();
    expect(
      document.documentElement.classList.contains('overlay-open'),
    ).toBe(false);
  });

  it('keeps the class when switching from one overlay to another (no flicker)', () => {
    const nav = TestBed.inject(NavStateService);
    nav.openNav();
    TestBed.flushEffects();
    nav.openSearch();
    TestBed.flushEffects();
    // Invariant clave: durante el switch el mutex pasa nav→search en un
    // solo tick; `anyOverlayOpen` nunca es false, el class permanece.
    expect(
      document.documentElement.classList.contains('overlay-open'),
    ).toBe(true);
  });
});

describe('NavStateService — scroll lock effect (SSR)', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    resetRootEnvironment();
  });

  it('does NOT touch <html> on the server platform', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: PLATFORM_ID, useValue: 'server' },
      ],
    });
    const nav = TestBed.inject(NavStateService);
    nav.openNav();
    TestBed.flushEffects();
    // El effect lleva platform guard — en SSR nunca debe mutar el DOM raíz.
    expect(
      document.documentElement.classList.contains('overlay-open'),
    ).toBe(false);
  });
});

describe('NavStateService — goBack fallback', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    resetRootEnvironment();
    TestBed.configureTestingModule({
      providers: [provideRouter([])],
    });
  });

  afterEach(() => {
    resetRootEnvironment();
  });

  it('navigates to `/` when no previousUrl has been recorded (deep-link entry)', () => {
    const nav = TestBed.inject(NavStateService);
    const router = TestBed.inject(Router);
    const spy = vi.spyOn(router, 'navigateByUrl');
    nav.goBack();
    expect(spy).toHaveBeenCalledWith('/');
  });

  it('canGoBack() is false before any in-app navigation', () => {
    const nav = TestBed.inject(NavStateService);
    expect(nav.canGoBack()).toBe(false);
  });
});
