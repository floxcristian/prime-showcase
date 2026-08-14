import { signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Observable } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../../../core/services/auth/auth.service';
import { seededRandom } from '../../../shared/utils/mock-utils';
import type { ApiKeyEntry, ProviderId } from '../models/provider.interface';
import type { GenerationJob, GenerationRequest } from '../models/social.interface';
import {
  GenerationProviderNotReadyError,
  SocialGenerationMockService,
} from './social-generation-mock.service';
import { SocialSettingsService } from './social-settings.service';

/**
 * Specs de RFC-002 D5/D6/D9 para `SocialGenerationMockService` (plan §7):
 * gating de `createJob` contra settings (error tipado), backfill solo con
 * key `valid` de generación, secuencia de `watchJob` determinista y
 * estable por jobId (curva no lineal, terminal seeded, señal de jobs
 * actualizada en cada emisión), clamp de `durationSeconds` y reset por
 * cambio de `clientSeed`.
 *
 * Timers falsos + reloj fijo (patrón del spec de settings): epoch pinneado
 * → ids de job deterministas → rolls de outcome reproducibles.
 */

const EPOCH_MS = Date.UTC(2026, 7, 14, 12, 0, 0);
const CLIENT = 'colegios.norte@fjuanxxiii.cl';
const OTHER_CLIENT = 'otra.marca@gmail.com';

const configKey = (client: string): string =>
  `social:provider-config:v1::${client}`;
const apiKeysKey = (client: string): string => `social:api-keys:v1::${client}`;

/** Ventana de settle para fachadas simples (latencias ≤2 s). */
const SETTLE_WINDOW_MS = 3_000;

/** Ventana para el stream completo de watchJob: hasta 10 ticks × 450 ms. */
const WATCH_WINDOW_MS = 6_000;

interface AuthStub {
  readonly email: WritableSignal<string | null>;
}

function setup(email: string | null = CLIENT): {
  service: SocialGenerationMockService;
  settings: SocialSettingsService;
  authStub: AuthStub;
} {
  TestBed.resetTestingModule();
  const authStub: AuthStub = { email: signal<string | null>(email) };
  TestBed.configureTestingModule({
    providers: [{ provide: AuthService, useValue: authStub }],
  });
  return {
    service: TestBed.inject(SocialGenerationMockService),
    settings: TestBed.inject(SocialSettingsService),
    authStub,
  };
}

/** Suscribe, avanza timers y devuelve la ÚLTIMA emisión (o re-lanza). */
function settle<T>(source: Observable<T>, windowMs = SETTLE_WINDOW_MS): T {
  const values = collect(source, windowMs);
  if (values.length === 0) {
    throw new Error('El Observable no emitió dentro de la ventana simulada');
  }
  return values[values.length - 1];
}

/** Suscribe, avanza timers y devuelve TODAS las emisiones (o re-lanza). */
function collect<T>(source: Observable<T>, windowMs: number): T[] {
  const values: T[] = [];
  let failure: unknown;
  let failed = false;
  source.subscribe({
    next: (emitted) => {
      values.push(emitted);
    },
    error: (err: unknown) => {
      failure = err;
      failed = true;
    },
  });
  vi.advanceTimersByTime(windowMs);
  if (failed) {
    throw failure;
  }
  return values;
}

/** Pre-siembra en storage una key `valid` + config enabled del provider —
 *  el estado que deja el flujo real addKey → verifyKey → setEnabled. */
function seedReadyProvider(client: string, providers: readonly ProviderId[]): void {
  const iso = new Date(EPOCH_MS).toISOString();
  const keys: ApiKeyEntry[] = providers.map((providerId) => ({
    id: `key-${providerId}-seed`,
    providerId,
    maskedKey: 'sk-seed…a4f9',
    status: 'valid',
    lastVerifiedAt: iso,
    createdAt: iso,
  }));
  localStorage.setItem(apiKeysKey(client), JSON.stringify(keys));
  localStorage.setItem(
    configKey(client),
    JSON.stringify({
      configs: providers.map((providerId) => ({
        providerId,
        enabled: true,
        activeKeyId: `key-${providerId}-seed`,
        options: {},
      })),
      activeByKind: {},
    }),
  );
}

const captionRequest: GenerationRequest = {
  kind: 'caption',
  providerId: 'gpt',
  prompt: 'Caption para el lanzamiento de temporada',
  options: { tone: 'cercano', maxLength: 200, language: 'es' },
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(EPOCH_MS);
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

describe('SocialGenerationMockService — gating y backfill (RFC-002 D6/D7/D9)', () => {
  it('sin key valid de generación: historial vacío y createJob emite error tipado', () => {
    const { service } = setup();
    expect(settle(service.getJobs())).toEqual([]);

    let captured: unknown;
    service.createJob(captionRequest).subscribe({
      error: (err: unknown) => {
        captured = err;
      },
    });
    vi.advanceTimersByTime(SETTLE_WINDOW_MS);
    expect(captured).toBeInstanceOf(GenerationProviderNotReadyError);
    expect((captured as GenerationProviderNotReadyError).providerId).toBe('gpt');
    expect((captured as Error).message).toMatch(/API key válida/);
  });

  it('con key valid rehidratada siembra 4-6 jobs históricos terminales', () => {
    seedReadyProvider(CLIENT, ['gpt']);
    const { service } = setup();
    const jobs = settle(service.getJobs());

    expect(jobs.length).toBeGreaterThanOrEqual(4);
    expect(jobs.length).toBeLessThanOrEqual(6);
    expect(
      jobs.every((job) => job.status === 'succeeded' || job.status === 'failed'),
    ).toBe(true);
  });

  it('configurar la primera key valid a mitad de sesión hace aparecer el historial', () => {
    const { service, settings } = setup();
    expect(settle(service.getJobs())).toEqual([]);

    // Flujo real: alta + verificación hasta valid (determinista con reloj
    // fijo — mismo helper que el spec de settings).
    let gotValid = false;
    for (let attempt = 0; attempt < 30 && !gotValid; attempt++) {
      const { entry } = settle(settings.addKey('gpt', `sk-${'a'.repeat(30)}`));
      const verified = settle(settings.verifyKey(entry.id));
      if (verified.status === 'valid') {
        gotValid = true;
      } else {
        settle(settings.revokeKey(entry.id));
      }
    }
    expect(gotValid).toBe(true);

    expect(settle(service.getJobs()).length).toBeGreaterThanOrEqual(4);
  });

  it('kind y provider incompatibles → error (gpt no genera imágenes)', () => {
    seedReadyProvider(CLIENT, ['gpt']);
    const { service } = setup();
    expect(() =>
      settle(service.createJob({ ...captionRequest, kind: 'image' })),
    ).toThrowError(/no genera contenido/);
  });
});

describe('SocialGenerationMockService — watchJob determinista (RFC-002 D9)', () => {
  it('el stream avanza queued → running(0…) → terminal seeded y actualiza el signal', () => {
    seedReadyProvider(CLIENT, ['gpt']);
    const { service } = setup();
    const job = settle(service.createJob(captionRequest));
    expect(job.status).toBe('queued');
    expect(job.costEstimateUsd).toBeGreaterThan(0);
    expect(service.jobs()[0].id).toBe(job.id);

    // Parámetros esperados, computados con el MISMO PRNG del service.
    const expectedTicks = 6 + Math.floor(seededRandom(job.id)() * 5);
    const expectedFailed = seededRandom(`${job.id}:outcome`)() < 0.12;

    const emissions = collect(service.watchJob(job.id), WATCH_WINDOW_MS);
    expect(emissions).toHaveLength(expectedTicks + 1);

    // Tick 0: running con 0 %.
    expect(emissions[0].status).toBe('running');
    expect(emissions[0].progressPct).toBe(0);

    // Curva no decreciente mientras corre.
    const running = emissions.slice(0, -1);
    for (let i = 1; i < running.length; i++) {
      expect(running[i].progressPct ?? 0).toBeGreaterThanOrEqual(
        running[i - 1].progressPct ?? 0,
      );
    }

    // Terminal: seeded por `${jobId}:outcome`, sin progressPct, con
    // completedAt; caption succeeded lleva SIEMPRE 3 variantes.
    const terminal = emissions[emissions.length - 1];
    expect(terminal.status).toBe(expectedFailed ? 'failed' : 'succeeded');
    expect(terminal.progressPct).toBeUndefined();
    expect(terminal.completedAt).toBeDefined();
    if (terminal.status === 'succeeded') {
      expect(terminal.resultVariants).toHaveLength(3);
    }
    if (terminal.status === 'failed') {
      expect(terminal.failureReason).toBeDefined();
    }

    // Cada emisión actualizó el signal: el historial quedó en terminal.
    const inSignal = service
      .jobs()
      .find((candidate) => candidate.id === job.id) as GenerationJob;
    expect(inSignal.status).toBe(terminal.status);

    // Re-watch de un job terminal: re-emite el estado final, una vez.
    const rewatch = collect(service.watchJob(job.id), WATCH_WINDOW_MS);
    expect(rewatch).toHaveLength(1);
    expect(rewatch[0]).toEqual(terminal);
  });

  it('watchJob de un id inexistente emite error', () => {
    seedReadyProvider(CLIENT, ['gpt']);
    const { service } = setup();
    expect(() => settle(service.watchJob('job-fantasma'))).toThrowError(
      /no existe/,
    );
  });

  it('durationSeconds se clampa a capabilities.maxVideoSeconds (veo: 8)', () => {
    seedReadyProvider(CLIENT, ['veo']);
    const { service } = setup();
    const job = settle(
      service.createJob({
        kind: 'video',
        providerId: 'veo',
        prompt: 'Video vertical de producto',
        options: { aspectRatio: '9:16', durationSeconds: 999 },
      }),
    );
    expect(job.request.options.durationSeconds).toBe(8);
  });
});

describe('SocialGenerationMockService — reset por cambio de clientSeed (RFC-002 D6)', () => {
  it('cliente B sin keys → []; la vuelta de A re-deriva SOLO el backfill (jobs vivos descartados)', () => {
    seedReadyProvider(CLIENT, ['gpt']);
    const { service, authStub } = setup();
    const backfill = settle(service.getJobs());
    const live = settle(service.createJob(captionRequest));
    expect(service.jobs()).toHaveLength(backfill.length + 1);

    // B (sin keys de generación) jamás ve los jobs de A.
    authStub.email.set(OTHER_CLIENT);
    TestBed.flushEffects();
    expect(service.jobs()).toEqual([]);
    expect(settle(service.getJobs())).toEqual([]);

    // La vuelta de A re-siembra el historial idéntico; el job vivo (no
    // persistido) se descartó — límite documentado del mock.
    authStub.email.set(CLIENT);
    TestBed.flushEffects();
    expect(service.jobs()).toEqual(backfill);
    expect(service.jobs().some((job) => job.id === live.id)).toBe(false);
  });
});
