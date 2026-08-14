import { signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../../../core/services/auth/auth.service';
import { RecommendationDismissalsStore } from './recommendation-dismissals.store';

/**
 * Specs de RFC-002 D5/D6 para `RecommendationDismissalsStore` (plan §7):
 * clon del patrón `acknowledgements.store` (set inmutable read-only,
 * mutaciones idempotentes) + el reset por cambio de `clientSeed` — el
 * cliente B jamás ve descartes de A, y lo NO persistido se descarta al
 * logout (límite documentado).
 */

const EPOCH_MS = Date.UTC(2026, 7, 14, 12, 0, 0);
const CLIENT = 'colegios.norte@fjuanxxiii.cl';
const OTHER_CLIENT = 'otra.marca@gmail.com';

interface AuthStub {
  readonly email: WritableSignal<string | null>;
}

function setup(email: string | null = CLIENT): {
  store: RecommendationDismissalsStore;
  authStub: AuthStub;
} {
  TestBed.resetTestingModule();
  const authStub: AuthStub = { email: signal<string | null>(email) };
  TestBed.configureTestingModule({
    providers: [{ provide: AuthService, useValue: authStub }],
  });
  return { store: TestBed.inject(RecommendationDismissalsStore), authStub };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(EPOCH_MS);
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

describe('RecommendationDismissalsStore — API del set (patrón acknowledgements)', () => {
  it('dismiss/isDismissed/count: idempotente y expuesto read-only', () => {
    const { store } = setup();
    expect(store.isDismissed('reco-1')).toBe(false);
    expect(store.count()).toBe(0);

    store.dismiss('reco-1');
    store.dismiss('reco-1'); // idempotente
    store.dismiss('reco-2');

    expect(store.isDismissed('reco-1')).toBe(true);
    expect(store.count()).toBe(2);
    expect(store.dismissed().has('reco-2')).toBe(true);
  });

  it('undismiss deshace un descarte; clear vacía todo', () => {
    const { store } = setup();
    store.dismiss('reco-1');
    store.dismiss('reco-2');

    store.undismiss('reco-1');
    expect(store.isDismissed('reco-1')).toBe(false);
    expect(store.count()).toBe(1);

    store.clear();
    expect(store.count()).toBe(0);
  });

  it('el set expuesto es inmutable por referencia: cada mutación produce un Set nuevo', () => {
    const { store } = setup();
    const before = store.dismissed();
    store.dismiss('reco-1');
    expect(store.dismissed()).not.toBe(before);
    expect(before.has('reco-1')).toBe(false);
  });
});

describe('RecommendationDismissalsStore — reset por cambio de clientSeed (RFC-002 D6)', () => {
  it('cambio de cliente → set vacío; el contenido de A es invisible para B', () => {
    const { store, authStub } = setup();
    store.dismiss('reco-a-1');
    expect(store.count()).toBe(1);

    authStub.email.set(OTHER_CLIENT);
    TestBed.flushEffects();

    expect(store.count()).toBe(0);
    expect(store.isDismissed('reco-a-1')).toBe(false);
  });

  it('volver al cliente original NO restaura (lo no persistido se descarta)', () => {
    const { store, authStub } = setup();
    store.dismiss('reco-a-1');

    authStub.email.set(OTHER_CLIENT);
    TestBed.flushEffects();
    authStub.email.set(CLIENT);
    TestBed.flushEffects();

    expect(store.isDismissed('reco-a-1')).toBe(false);
    expect(store.count()).toBe(0);
  });

  it('logout (email null) también resetea', () => {
    const { store, authStub } = setup();
    store.dismiss('reco-a-1');

    authStub.email.set(null);
    TestBed.flushEffects();

    expect(store.count()).toBe(0);
  });
});
