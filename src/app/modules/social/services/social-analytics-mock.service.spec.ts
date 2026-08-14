import { signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Observable } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../../../core/services/auth/auth.service';
import { buildAccountMock } from '../mocks/accounts-mock';
import type { SocialAccount } from '../models/social.interface';
import { RecommendationDismissalsStore } from './recommendation-dismissals.store';
import { SocialAnalyticsMockService } from './social-analytics-mock.service';
import { SocialSettingsService } from './social-settings.service';

/**
 * Specs de RFC-002 D5/D6/D7 para `SocialAnalyticsMockService` (plan §7):
 * gating por cuentas conectadas (sin cuentas → colecciones vacías, D6),
 * backfill on-connect lazy memoizado en caches de instancia, series de 90
 * buckets con `delta` precalculado, delegación de `accountsSnapshot` en
 * settings y de `dismissRecommendation` en el store.
 */

const EPOCH_MS = Date.UTC(2026, 7, 14, 12, 0, 0);
const DAY_MS = 86_400_000;
const CLIENT = 'colegios.norte@fjuanxxiii.cl';
const BRAND = 'Colegios Norte';

const connectionsKey = (client: string): string =>
  `social:connections:v1::${client}`;

/** Ventana que cubre la latencia máxima del default (≤1.8 s). */
const SETTLE_WINDOW_MS = 3_000;

interface AuthStub {
  readonly email: WritableSignal<string | null>;
}

function setup(email: string | null = CLIENT): {
  service: SocialAnalyticsMockService;
  settings: SocialSettingsService;
  dismissals: RecommendationDismissalsStore;
  authStub: AuthStub;
} {
  TestBed.resetTestingModule();
  const authStub: AuthStub = { email: signal<string | null>(email) };
  TestBed.configureTestingModule({
    providers: [{ provide: AuthService, useValue: authStub }],
  });
  return {
    service: TestBed.inject(SocialAnalyticsMockService),
    settings: TestBed.inject(SocialSettingsService),
    dismissals: TestBed.inject(RecommendationDismissalsStore),
    authStub,
  };
}

/** Suscribe, avanza los timers falsos y devuelve la emisión (o re-lanza el error). */
function settle<T>(source: Observable<T>): T {
  let value: T | undefined;
  let failure: unknown;
  let failed = false;
  let completed = false;
  source.subscribe({
    next: (emitted) => {
      value = emitted;
    },
    error: (err: unknown) => {
      failure = err;
      failed = true;
    },
    complete: () => {
      completed = true;
    },
  });
  vi.advanceTimersByTime(SETTLE_WINDOW_MS);
  if (failed) {
    throw failure;
  }
  if (!completed) {
    throw new Error('El Observable no completó dentro de la ventana simulada');
  }
  return value as T;
}

/** Pre-siembra cuentas conectadas (2 días — dentro del TTL) del cliente. */
function seedAccounts(
  networks: readonly ('instagram' | 'facebook' | 'tiktok')[],
): readonly SocialAccount[] {
  const accounts = networks.map((network) =>
    buildAccountMock(EPOCH_MS - 2 * DAY_MS, CLIENT, BRAND, network),
  );
  localStorage.setItem(connectionsKey(CLIENT), JSON.stringify(accounts));
  return accounts;
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

describe('SocialAnalyticsMockService — gating sin cuentas (RFC-002 D6)', () => {
  it('todos los puertos devuelven colecciones vacías para un cliente sin cuentas', () => {
    const { service } = setup();
    expect(settle(service.getAccounts())).toEqual([]);
    expect(settle(service.getRecommendations())).toEqual([]);
    expect(settle(service.getCompetitors('instagram'))).toEqual([]);
    expect(settle(service.getTrends('instagram'))).toEqual([]);
    expect(settle(service.getBrandMentions())).toEqual([]);
    expect(settle(service.getHashtagPerformance('instagram'))).toEqual([]);
    expect(
      settle(service.getHashtagSuggestions('ferretería', 'instagram')),
    ).toEqual([]);
    expect(settle(service.getTopPosts('acc-cualquiera'))).toEqual([]);
    expect(settle(service.getBenchmarks('acc-cualquiera', 'comp-x'))).toEqual([]);
  });

  it('los métodos escalares emiten error ante una cuenta desconocida', () => {
    const { service } = setup();
    expect(() =>
      settle(service.getMetricSeries('acc-fantasma', 'reach')),
    ).toThrowError(/no está conectada/);
    expect(() => settle(service.getAudience('acc-fantasma'))).toThrowError(
      /no está conectada/,
    );
  });
});

describe('SocialAnalyticsMockService — backfill on-connect (RFC-002 D6/D7)', () => {
  it('accountsSnapshot delega en settings.accounts() (status efectivo incluido)', () => {
    seedAccounts(['instagram', 'facebook']);
    const { service, settings } = setup();
    expect(service.accountsSnapshot).toEqual(settings.accounts());
    expect(settle(service.getAccounts())).toEqual(settings.accounts());
  });

  it('getMetricSeries: 90 buckets, metadata correcta y delta precalculado; memoizada', () => {
    const [account] = seedAccounts(['instagram']);
    const { service } = setup();

    const series = settle(service.getMetricSeries(account.id, 'reach'));
    expect(series.points).toHaveLength(90);
    expect(series.kind).toBe('reach');
    expect(series.network).toBe('instagram');
    expect(series.accountId).toBe(account.id);
    expect(series.unit).toBe('');
    expect(Number.isFinite(series.delta)).toBe(true);

    // Unidades por kind ('%' / 'min').
    expect(
      settle(service.getMetricSeries(account.id, 'engagement-rate')).unit,
    ).toBe('%');
    expect(settle(service.getMetricSeries(account.id, 'watch-time')).unit).toBe(
      'min',
    );

    // Cache de instancia: navegar away+back sirve EL MISMO objeto.
    expect(settle(service.getMetricSeries(account.id, 'reach'))).toBe(series);
  });

  it('getTopPosts: 12-18 posts de la cuenta, memoizados', () => {
    const [account] = seedAccounts(['instagram']);
    const { service } = setup();

    const posts = settle(service.getTopPosts(account.id));
    expect(posts.length).toBeGreaterThanOrEqual(12);
    expect(posts.length).toBeLessThanOrEqual(18);
    expect(posts.every((post) => post.accountId === account.id)).toBe(true);
    expect(settle(service.getTopPosts(account.id))).toBe(posts);
  });

  it('getAudience: snapshot de la cuenta, memoizado', () => {
    const [account] = seedAccounts(['tiktok']);
    const { service } = setup();
    const audience = settle(service.getAudience(account.id));
    expect(audience.accountId).toBe(account.id);
    expect(settle(service.getAudience(account.id))).toBe(audience);
  });

  it('getCompetitors: 3 terceros por red conectada; getBenchmarks del par', () => {
    const [account] = seedAccounts(['instagram']);
    const { service } = setup();

    const competitors = settle(service.getCompetitors('instagram'));
    expect(competitors).toHaveLength(3);
    expect(competitors.every((c) => c.network === 'instagram')).toBe(true);

    const benchmarks = settle(
      service.getBenchmarks(account.id, competitors[0].id),
    );
    expect(benchmarks.length).toBeGreaterThanOrEqual(5);
    expect(
      benchmarks.every((b) => b.competitorId === competitors[0].id),
    ).toBe(true);

    // Competidor desconocido → colección vacía (regla de degradación).
    expect(settle(service.getBenchmarks(account.id, 'comp-fantasma'))).toEqual(
      [],
    );
  });

  it('insights por red conectada: trends, hashtags y menciones no vacíos', () => {
    seedAccounts(['instagram', 'tiktok']);
    const { service } = setup();

    expect(settle(service.getTrends('instagram')).length).toBeGreaterThan(0);
    expect(
      settle(service.getHashtagPerformance('tiktok')).length,
    ).toBeGreaterThan(0);
    expect(
      settle(service.getHashtagSuggestions('Ferretería ', 'instagram')).length,
    ).toBeGreaterThan(0);
    expect(settle(service.getBrandMentions()).length).toBeGreaterThan(0);

    // Red NO conectada → vacío aunque otras estén conectadas.
    expect(settle(service.getTrends('facebook'))).toEqual([]);
  });
});

describe('SocialAnalyticsMockService — recomendaciones y dismissals (RFC-002 D5)', () => {
  it('getRecommendations: 3-4 por cuenta conectada, entidades inmutables', () => {
    seedAccounts(['instagram', 'facebook']);
    const { service } = setup();
    const recommendations = settle(service.getRecommendations());

    expect(recommendations.length).toBeGreaterThanOrEqual(6);
    expect(recommendations.length).toBeLessThanOrEqual(8);
    const ids = new Set(recommendations.map((reco) => reco.id));
    expect(ids.size).toBe(recommendations.length);
  });

  it('dismissRecommendation delega en el store; el feed NO filtra (lo hace el consumer)', () => {
    seedAccounts(['instagram']);
    const { service, dismissals } = setup();
    const [first] = settle(service.getRecommendations());

    settle(service.dismissRecommendation(first.id));
    expect(dismissals.isDismissed(first.id)).toBe(true);
    // La entidad sigue en el feed — el filtrado es un computed del feed.
    expect(
      settle(service.getRecommendations()).some((reco) => reco.id === first.id),
    ).toBe(true);
  });
});
