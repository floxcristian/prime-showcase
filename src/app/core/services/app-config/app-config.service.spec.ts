import { DOCUMENT, PLATFORM_ID, REQUEST } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppConfigService } from './app-config.service';

/**
 * Build a minimal Request-like token value carrying only the cookie header
 * — that's all the service reads from REQUEST. Kept as a plain `Headers`
 * instance so the contract with the real `Request.headers.get('cookie')`
 * surface stays honest.
 */
function makeServerRequest(cookie: string | null): { headers: Headers } {
  const headers = new Headers();
  if (cookie !== null) headers.set('cookie', cookie);
  return { headers };
}

/**
 * Reset DOM + cookie jar between tests. jsdom persists both across `it()`
 * blocks, so without this, ordering changes the observable behavior.
 */
function resetBrowserEnvironment(): void {
  document.documentElement.classList.remove('p-dark');
  // jsdom's cookie jar expires on Max-Age=0.
  document.cookie = 'theme=; Path=/; Max-Age=0';
}

describe('AppConfigService — browser platform', () => {
  beforeEach(() => {
    resetBrowserEnvironment();
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    resetBrowserEnvironment();
  });

  it('defaults to light mode when no cookie and no class are present', () => {
    const service = TestBed.inject(AppConfigService);
    expect(service.darkTheme()).toBe(false);
    expect(document.documentElement.classList.contains('p-dark')).toBe(false);
  });

  it('hydrates dark mode from the theme cookie on bootstrap', () => {
    document.cookie = 'theme=dark; Path=/';
    const service = TestBed.inject(AppConfigService);
    expect(service.darkTheme()).toBe(true);
    // Constructor must apply the class synchronously so SSR → CSR sees the
    // same DOM shape (no hydration mismatch).
    expect(document.documentElement.classList.contains('p-dark')).toBe(true);
  });

  it('hydrates light mode explicitly from the theme cookie', () => {
    document.documentElement.classList.add('p-dark'); // stale class from prior session
    document.cookie = 'theme=light; Path=/';
    const service = TestBed.inject(AppConfigService);
    expect(service.darkTheme()).toBe(false);
    // The cookie wins over the stale class — that's the whole reason the
    // cookie exists. Without this the class would resurrect zombie state.
    expect(document.documentElement.classList.contains('p-dark')).toBe(false);
  });

  it('falls back to the pre-hydration class when no cookie is set', () => {
    // Simulates the inline bootstrap script in index.html having already
    // applied `p-dark` based on `prefers-color-scheme`.
    document.documentElement.classList.add('p-dark');
    const service = TestBed.inject(AppConfigService);
    expect(service.darkTheme()).toBe(true);
  });

});

describe('AppConfigService — setDarkTheme', () => {
  beforeEach(() => {
    resetBrowserEnvironment();
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    resetBrowserEnvironment();
  });

  it('toggles state, class, and cookie on change', () => {
    const service = TestBed.inject(AppConfigService);
    expect(service.darkTheme()).toBe(false);

    service.setDarkTheme(true);

    expect(service.darkTheme()).toBe(true);
    expect(document.documentElement.classList.contains('p-dark')).toBe(true);
    expect(document.cookie).toContain('theme=dark');
  });

  it('is idempotent when called with the current value', () => {
    const service = TestBed.inject(AppConfigService);
    const baseline = service.themeChanged();

    service.setDarkTheme(false); // already false

    // No-op path: counter must not tick, otherwise consumers re-render for
    // nothing and UI toggles spam downstream effects.
    expect(service.themeChanged()).toBe(baseline);
  });

  it('increments themeChanged once per real change', () => {
    const service = TestBed.inject(AppConfigService);
    const baseline = service.themeChanged();

    service.setDarkTheme(true);
    const afterFirst = service.themeChanged();
    expect(afterFirst).toBe(baseline + 1);

    service.setDarkTheme(false);
    expect(service.themeChanged()).toBe(afterFirst + 1);
  });

  it('flips back to light and clears the p-dark class', () => {
    document.cookie = 'theme=dark; Path=/';
    const service = TestBed.inject(AppConfigService);
    expect(service.darkTheme()).toBe(true);

    service.setDarkTheme(false);

    expect(service.darkTheme()).toBe(false);
    expect(document.documentElement.classList.contains('p-dark')).toBe(false);
    expect(document.cookie).toContain('theme=light');
  });
});

describe('AppConfigService — server platform (SSR)', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('reads dark mode from the forwarded Cookie header', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: REQUEST, useValue: makeServerRequest('theme=dark') },
      ],
    });
    const service = TestBed.inject(AppConfigService);
    expect(service.darkTheme()).toBe(true);
  });

  it('reads light mode from the forwarded Cookie header', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: REQUEST, useValue: makeServerRequest('theme=light') },
      ],
    });
    const service = TestBed.inject(AppConfigService);
    expect(service.darkTheme()).toBe(false);
  });

  it('defaults to light when no cookie header is present', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: REQUEST, useValue: makeServerRequest(null) },
      ],
    });
    const service = TestBed.inject(AppConfigService);
    expect(service.darkTheme()).toBe(false);
  });

  it('defaults to light when REQUEST is not provided (defensive: should never happen in real SSR)', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
    });
    const service = TestBed.inject(AppConfigService);
    expect(service.darkTheme()).toBe(false);
  });

  it('does not write a cookie on the server', () => {
    // Substitute a DOCUMENT whose `cookie` setter we observe — the service
    // must short-circuit on the platform guard before touching it.
    const cookieSetter = vi.fn();
    const documentStub = {
      documentElement: { classList: { toggle: () => {} } },
    };
    Object.defineProperty(documentStub, 'cookie', {
      get: () => '',
      set: cookieSetter,
      configurable: true,
    });

    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: REQUEST, useValue: makeServerRequest('theme=light') },
        { provide: DOCUMENT, useValue: documentStub },
      ],
    });
    TestBed.inject(AppConfigService).setDarkTheme(true);
    expect(cookieSetter).not.toHaveBeenCalled();
  });
});

describe('AppConfigService — applyThemeTransition (View Transition branch)', () => {
  beforeEach(() => {
    resetBrowserEnvironment();
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    resetBrowserEnvironment();
    // Clean up any startViewTransition stub we installed.
    delete (document as unknown as { startViewTransition?: unknown })
      .startViewTransition;
  });

  it('ticks themeChanged after transition.ready resolves', async () => {
    // Minimal ViewTransition stub: `ready` resolves immediately and the
    // callback runs synchronously so the test can assert the DOM reflects
    // the new theme by the time `ready` settles and consumers are notified.
    const readyPromise = Promise.resolve();
    const stub = vi.fn((callback: () => void) => {
      callback();
      return { ready: readyPromise };
    });
    (document as unknown as { startViewTransition: typeof stub })
      .startViewTransition = stub;

    const service = TestBed.inject(AppConfigService);
    const baseline = service.themeChanged();
    service.setDarkTheme(true);

    expect(stub).toHaveBeenCalledTimes(1);
    await readyPromise;

    expect(service.themeChanged()).toBe(baseline + 1);
    expect(document.documentElement.classList.contains('p-dark')).toBe(true);
  });
});
