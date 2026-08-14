import { signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Observable } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../../../core/services/auth/auth.service';
import { seededRandom } from '../../../shared/utils/mock-utils';
import { buildAccountMock } from '../mocks/accounts-mock';
import type { ScheduledPost } from '../models/social.interface';
import { SocialPublishingMockService } from './social-publishing-mock.service';
import { SocialSettingsService } from './social-settings.service';

/**
 * Specs de RFC-002 D5/D6/D10 para `SocialPublishingMockService` (plan §7):
 * backfill solo con cuentas conectadas, `publishNow` con fallo SEGURO
 * ante cuenta expired que pasa tras `reconnectAccount` (flujo demo
 * error → fix → ok), fallo ocasional determinista por seed, validación de
 * `savePost` y reset por cambio de `clientSeed`.
 *
 * Timers falsos + reloj fijo (patrón del spec de settings): el epoch por
 * instancia queda pinneado, así el backfill, los timestamps de mutación y
 * los rolls de publicación son 100 % deterministas.
 */

const EPOCH_MS = Date.UTC(2026, 7, 14, 12, 0, 0);
const DAY_MS = 86_400_000;
const CLIENT = 'colegios.norte@fjuanxxiii.cl';
const OTHER_CLIENT = 'otra.marca@gmail.com';
const BRAND = 'Colegios Norte';

const connectionsKey = (client: string): string =>
  `social:connections:v1::${client}`;

/** Ventana que cubre la latencia máxima (reconnect: ≤2 s). */
const SETTLE_WINDOW_MS = 3_000;

interface AuthStub {
  readonly email: WritableSignal<string | null>;
}

function setup(email: string | null = CLIENT): {
  service: SocialPublishingMockService;
  settings: SocialSettingsService;
  authStub: AuthStub;
} {
  TestBed.resetTestingModule();
  const authStub: AuthStub = { email: signal<string | null>(email) };
  TestBed.configureTestingModule({
    providers: [{ provide: AuthService, useValue: authStub }],
  });
  return {
    service: TestBed.inject(SocialPublishingMockService),
    settings: TestBed.inject(SocialSettingsService),
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

/** Pre-siembra una cuenta conectada del cliente en su storage scoped. */
function seedAccount(
  client: string,
  network: 'instagram' | 'facebook' | 'tiktok',
  ageDays: number,
): void {
  const account = buildAccountMock(
    EPOCH_MS - ageDays * DAY_MS,
    client,
    BRAND,
    network,
  );
  localStorage.setItem(connectionsKey(client), JSON.stringify([account]));
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

describe('SocialPublishingMockService — backfill (RFC-002 D6/D7)', () => {
  it('sin cuentas conectadas el backfill es vacío', () => {
    const { service } = setup();
    expect(settle(service.getScheduledPosts())).toEqual([]);
  });

  it('con una cuenta conectada siembra 10-12 posts cubriendo los 4 estados', () => {
    seedAccount(CLIENT, 'instagram', 2);
    const { service } = setup();
    const posts = settle(service.getScheduledPosts());

    expect(posts.length).toBeGreaterThanOrEqual(10);
    expect(posts.length).toBeLessThanOrEqual(12);
    const statuses = new Set(posts.map((post) => post.status));
    expect(statuses).toEqual(
      new Set(['draft', 'scheduled', 'published', 'failed']),
    );
    // Todos los posts apuntan a la única cuenta conectada.
    const accountId = JSON.parse(
      localStorage.getItem(connectionsKey(CLIENT)) ?? '[]',
    )[0].id as string;
    expect(posts.every((post) => post.accountIds.includes(accountId))).toBe(true);
  });

  it('conectar la primera cuenta a mitad de sesión hace aparecer el backfill', () => {
    const { service, settings } = setup();
    expect(settle(service.getScheduledPosts())).toEqual([]);

    settle(settings.connectAccount('instagram'));
    expect(settle(service.getScheduledPosts()).length).toBeGreaterThanOrEqual(10);
  });
});

describe('SocialPublishingMockService — publishNow (RFC-002 D10)', () => {
  it('cuenta expired: fallo SEGURO con reason accionable; pasa tras reconnect', () => {
    // Cuenta de 8 días → expired (TTL 7 días, computado en lectura).
    seedAccount(CLIENT, 'instagram', 8);
    const { service, settings } = setup();
    expect(settings.accounts()[0].status).toBe('expired');

    const posts = settle(service.getScheduledPosts());
    // Post publicable cuyo roll del intento 3 (el retry post-fix) pasa —
    // elegido determinísticamente con el mismo PRNG del service.
    const post = posts.find(
      (candidate) =>
        candidate.status !== 'published' &&
        seededRandom(`${CLIENT}:publish:${candidate.id}:retry:3`)() >= 0.15,
    );
    expect(post).toBeDefined();
    const id = (post as ScheduledPost).id;

    // Intento 1: fallo seguro correlacionado con el estado de settings.
    const first = settle(service.publishNow(id));
    expect(first.status).toBe('failed');
    expect(first.failureReason).toBe(
      'Token de Instagram expirado — reconectá la cuenta en Configuración',
    );

    // Intento 2 sin arreglar la causa: falla igual (determinista).
    const second = settle(service.publishNow(id));
    expect(second.status).toBe('failed');
    expect(second.failureReason).toBe(first.failureReason);

    // Fix: reconectar limpia el estado en settings → el retry pasa.
    settle(settings.reconnectAccount(settings.accounts()[0].id));
    expect(settings.accounts()[0].status).toBe('connected');

    const third = settle(service.publishNow(id));
    expect(third.status).toBe('published');
    expect(third.publishedAt).toBeDefined();
    expect(third.failureReason).toBeUndefined();
    // La transición quedó reflejada en el signal.
    expect(
      service.posts().find((candidate) => candidate.id === id)?.status,
    ).toBe('published');
  });

  it('sin causa real: el resultado es el del roll determinista por seed', () => {
    seedAccount(CLIENT, 'instagram', 2);
    const { service } = setup();
    const posts = settle(service.getScheduledPosts());
    const post = posts.find((candidate) => candidate.status !== 'published');
    expect(post).toBeDefined();
    const id = (post as ScheduledPost).id;

    const shouldFail = seededRandom(`${CLIENT}:publish:${id}`)() < 0.15;
    const result = settle(service.publishNow(id));
    expect(result.status).toBe(shouldFail ? 'failed' : 'published');
    if (shouldFail) {
      expect(result.failureReason).toBeDefined();
    }
  });

  it('post inexistente o ya publicado → error', () => {
    seedAccount(CLIENT, 'instagram', 2);
    const { service } = setup();
    const posts = settle(service.getScheduledPosts());
    const published = posts.find((candidate) => candidate.status === 'published');

    expect(() => settle(service.publishNow('sched-fantasma'))).toThrowError(
      /no existe/,
    );
    expect(() =>
      settle(service.publishNow((published as ScheduledPost).id)),
    ).toThrowError(/ya fue publicado/);
  });
});

describe('SocialPublishingMockService — savePost/deletePost (RFC-002 D4/D5)', () => {
  it('upsert válido: inserta el draft nuevo y refresca updatedAt', () => {
    seedAccount(CLIENT, 'instagram', 2);
    const { service, settings } = setup();
    settle(service.getScheduledPosts());
    const accountId = settings.accounts()[0].id;

    const draft: ScheduledPost = {
      id: 'sched-nuevo-1',
      accountIds: [accountId],
      format: 'image',
      caption: 'Borrador de prueba',
      hashtags: ['#pymechile'],
      mediaUrls: [],
      status: 'draft',
      createdAt: new Date(EPOCH_MS).toISOString(),
      updatedAt: new Date(EPOCH_MS - DAY_MS).toISOString(),
    };
    const saved = settle(service.savePost(draft));
    expect(saved.updatedAt).toBe(new Date(EPOCH_MS).toISOString());
    expect(service.posts().some((post) => post.id === draft.id)).toBe(true);

    // Upsert del mismo id reemplaza sin duplicar.
    settle(service.savePost({ ...draft, caption: 'Editado' }));
    const matches = service.posts().filter((post) => post.id === draft.id);
    expect(matches).toHaveLength(1);
    expect(matches[0].caption).toBe('Editado');
  });

  it('accountId no conectado → error accionable; status published → error', () => {
    seedAccount(CLIENT, 'instagram', 2);
    const { service, settings } = setup();
    const accountId = settings.accounts()[0].id;
    const base: ScheduledPost = {
      id: 'sched-nuevo-2',
      accountIds: ['acc-desconocida'],
      format: 'image',
      caption: 'x',
      hashtags: [],
      mediaUrls: [],
      status: 'draft',
      createdAt: new Date(EPOCH_MS).toISOString(),
      updatedAt: new Date(EPOCH_MS).toISOString(),
    };
    expect(() => settle(service.savePost(base))).toThrowError(/no está conectada/);
    expect(() =>
      settle(
        service.savePost({
          ...base,
          accountIds: [accountId],
          status: 'published',
        }),
      ),
    ).toThrowError(/draft o scheduled/);
  });

  it('deletePost elimina; id inexistente → error', () => {
    seedAccount(CLIENT, 'instagram', 2);
    const { service } = setup();
    const posts = settle(service.getScheduledPosts());
    const id = posts[0].id;

    settle(service.deletePost(id));
    expect(service.posts().some((post) => post.id === id)).toBe(false);
    expect(() => settle(service.deletePost(id))).toThrowError(/no existe/);
  });
});

describe('SocialPublishingMockService — reset por cambio de clientSeed (RFC-002 D6)', () => {
  it('cliente B sin cuentas → []; la vuelta de A re-deriva su backfill idéntico', () => {
    seedAccount(CLIENT, 'instagram', 2);
    const { service, authStub } = setup();
    const original = settle(service.getScheduledPosts());
    expect(original.length).toBeGreaterThan(0);

    // B (sin storage) jamás ve los posts de A.
    authStub.email.set(OTHER_CLIENT);
    TestBed.flushEffects();
    expect(service.posts()).toEqual([]);
    expect(settle(service.getScheduledPosts())).toEqual([]);

    // La vuelta de A re-siembra el MISMO backfill (seed + epoch estables).
    authStub.email.set(CLIENT);
    TestBed.flushEffects();
    expect(service.posts()).toEqual(original);
  });
});
