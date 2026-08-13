import { DOCUMENT, PLATFORM_ID, REQUEST } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from './auth.service';
import { AUTH_COOKIE_NAME } from './auth-cookie.util';

/**
 * AuthService is the session boundary: it hydrates the auth signal from the
 * cookie (browser `document.cookie` / SSR `REQUEST` header) and persists
 * login/logout back to the cookie. Specs pin:
 *
 *   - Browser hydration: no cookie → anonymous; cookie → authed with the
 *     decoded email; malformed cookie → anonymous (no throw).
 *   - login()/logout(): signal + cookie stay in sync; logout expires the
 *     cookie so a page reload stays logged out.
 *   - SSR: state comes from the forwarded Cookie header; the service NEVER
 *     writes cookies server-side (platform guard).
 *
 * Pattern mirrors app-config.service.spec.ts (same cookie-per-platform
 * architecture, ADR-001 §4).
 */

function makeServerRequest(cookie: string | null): { headers: Headers } {
  const headers = new Headers();
  if (cookie !== null) headers.set('cookie', cookie);
  return { headers };
}

/**
 * jsdom persists the cookie jar across `it()` blocks — expire the auth
 * cookie between tests so ordering can't change observable behavior.
 */
function resetAuthCookie(): void {
  document.cookie = `${AUTH_COOKIE_NAME}=; Path=/; Max-Age=0`;
}

describe('AuthService — browser platform', () => {
  beforeEach(() => {
    resetAuthCookie();
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    resetAuthCookie();
  });

  it('starts anonymous when no auth cookie is present', () => {
    const service = TestBed.inject(AuthService);
    expect(service.isAuthenticated()).toBe(false);
    expect(service.email()).toBeNull();
  });

  it('hydrates the session from an existing cookie (URL-decoded email)', () => {
    document.cookie = `${AUTH_COOKIE_NAME}=${encodeURIComponent('ana@example.com')}; Path=/`;
    const service = TestBed.inject(AuthService);
    expect(service.isAuthenticated()).toBe(true);
    expect(service.email()).toBe('ana@example.com');
  });

  it('treats an empty cookie value as anonymous', () => {
    document.cookie = `${AUTH_COOKIE_NAME}=; Path=/`;
    const service = TestBed.inject(AuthService);
    expect(service.isAuthenticated()).toBe(false);
    expect(service.email()).toBeNull();
  });

  it('login() flips the signal and persists the cookie', () => {
    const service = TestBed.inject(AuthService);
    service.login('ana@example.com');

    expect(service.isAuthenticated()).toBe(true);
    expect(service.email()).toBe('ana@example.com');
    expect(document.cookie).toContain(
      `${AUTH_COOKIE_NAME}=${encodeURIComponent('ana@example.com')}`,
    );
  });

  it('a second service instance sees the persisted session (reload survival)', () => {
    TestBed.inject(AuthService).login('ana@example.com');

    TestBed.resetTestingModule();
    const rehydrated = TestBed.inject(AuthService);
    expect(rehydrated.isAuthenticated()).toBe(true);
    expect(rehydrated.email()).toBe('ana@example.com');
  });

  it('logout() clears the signal and expires the cookie', () => {
    const service = TestBed.inject(AuthService);
    service.login('ana@example.com');
    service.logout();

    expect(service.isAuthenticated()).toBe(false);
    expect(service.email()).toBeNull();
    // Max-Age=0 removes the cookie from the jar — a reload stays logged out.
    expect(document.cookie).not.toContain(`${AUTH_COOKIE_NAME}=`);
  });
});

describe('AuthService — server platform (SSR)', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('reads the session from the forwarded Cookie header', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'server' },
        {
          provide: REQUEST,
          useValue: makeServerRequest(
            `${AUTH_COOKIE_NAME}=${encodeURIComponent('ana@example.com')}`,
          ),
        },
      ],
    });
    const service = TestBed.inject(AuthService);
    expect(service.isAuthenticated()).toBe(true);
    expect(service.email()).toBe('ana@example.com');
  });

  it('is anonymous when the request carries no cookie header', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: REQUEST, useValue: makeServerRequest(null) },
      ],
    });
    const service = TestBed.inject(AuthService);
    expect(service.isAuthenticated()).toBe(false);
  });

  it('is anonymous when REQUEST is not provided (defensive)', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
    });
    const service = TestBed.inject(AuthService);
    expect(service.isAuthenticated()).toBe(false);
  });

  it('never writes a cookie server-side (platform guard on persist)', () => {
    const cookieSetter = vi.fn();
    const documentStub = {};
    Object.defineProperty(documentStub, 'cookie', {
      get: () => '',
      set: cookieSetter,
      configurable: true,
    });

    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: REQUEST, useValue: makeServerRequest(null) },
        { provide: DOCUMENT, useValue: documentStub },
      ],
    });
    const service = TestBed.inject(AuthService);
    service.login('ana@example.com');

    // Signal still updates (SSR in-memory state)…
    expect(service.isAuthenticated()).toBe(true);
    // …but the cookie write is skipped: the browser (or a real backend's
    // Set-Cookie) owns persistence, never the server render.
    expect(cookieSetter).not.toHaveBeenCalled();
  });
});
