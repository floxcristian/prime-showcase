import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { AuthService } from '../services/auth/auth.service';
import { authGuard, guestGuard } from './auth.guard';

/**
 * The guards are the ONLY authorization boundary of the app — every
 * protected route funnels through them. These specs pin the contract:
 *
 *   - authGuard: authed → pass; anonymous → UrlTree to /login carrying the
 *     original destination as `returnUrl` (deep-link preservation), except
 *     for `/` which redirects to bare /login (no pointless returnUrl).
 *   - guestGuard: anonymous → pass; authed → UrlTree to `/` (an authed user
 *     never sees the login screen again via back-navigation).
 *
 * AuthService is substituted with a signal-backed stub — the guards only
 * read `isAuthenticated()`, and stubbing keeps these tests independent from
 * the cookie-parsing concerns covered in auth.service.spec.ts.
 */

/** Signal-backed AuthService stub — the only surface the guards touch. */
function setupGuardTest(authenticated: boolean) {
  const authStub = { isAuthenticated: signal(authenticated) };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: authStub },
    ],
  });
  return { router: TestBed.inject(Router) };
}

/** Runs a CanActivateFn inside the TestBed injection context. */
function runGuard(
  guard: typeof authGuard,
  url: string,
): boolean | UrlTree {
  const route = {} as ActivatedRouteSnapshot;
  const state = { url } as RouterStateSnapshot;
  return TestBed.runInInjectionContext(() => guard(route, state)) as
    | boolean
    | UrlTree;
}

describe('authGuard', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('passes when the user is authenticated', () => {
    setupGuardTest(true);
    expect(runGuard(authGuard, '/customers')).toBe(true);
  });

  it('redirects anonymous users to /login preserving the destination as returnUrl', () => {
    const { router } = setupGuardTest(false);
    const result = runGuard(authGuard, '/customers');

    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result as UrlTree)).toBe(
      '/login?returnUrl=%2Fcustomers',
    );
  });

  it('URL-encodes complex deep links (query params survive the round-trip)', () => {
    const { router } = setupGuardTest(false);
    const result = runGuard(authGuard, '/observability/alerts/alert-000?tab=history');

    expect(result).toBeInstanceOf(UrlTree);
    const serialized = router.serializeUrl(result as UrlTree);
    expect(serialized.startsWith('/login?returnUrl=')).toBe(true);
    // The original URL must be recoverable exactly by the login component.
    const returnUrl = new URLSearchParams(serialized.split('?')[1]).get('returnUrl');
    expect(returnUrl).toBe('/observability/alerts/alert-000?tab=history');
  });

  it('redirects to bare /login (no returnUrl) when the destination is home', () => {
    const { router } = setupGuardTest(false);
    const result = runGuard(authGuard, '/');

    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result as UrlTree)).toBe('/login');
  });
});

describe('guestGuard', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('passes when the user is anonymous (login screen reachable)', () => {
    setupGuardTest(false);
    expect(runGuard(guestGuard, '/login')).toBe(true);
  });

  it('redirects authenticated users to home (no login screen via back-nav)', () => {
    const { router } = setupGuardTest(true);
    const result = runGuard(guestGuard, '/login');

    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result as UrlTree)).toBe('/');
  });
});
