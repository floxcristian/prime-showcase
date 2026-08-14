import { PLATFORM_ID, signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Observable } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../../../core/services/auth/auth.service';
import { buildAccountMock } from '../mocks/accounts-mock';
import { PROVIDER_CATALOG } from '../mocks/provider-catalog';
import { SYNC_FAILURE_REASONS } from '../mocks/social-mock-utils';
import type { OnboardingStep } from '../models/onboarding.interface';
import type { ProviderId } from '../models/provider.interface';
import { SocialSettingsService, TOKEN_TTL_MS } from './social-settings.service';

/**
 * Specs de RFC-003 plan §1 para `SocialSettingsService`: defaults SSR
 * (D6.2), scoping por cliente con re-lectura ante cambio de sesión
 * (D1/D6.4), revocación en cascada completa (D5.5), determinismo de
 * `verifyKey` (D5.3), expiración TTL y sync-error computados EN LECTURA
 * (D4.4 / RFC-002 D6), `connectAccount` idempotente (D4.3) y la garantía
 * de que el plaintext de una key jamás se persiste (D5.2).
 *
 * Timers falsos + reloj fijo: el service captura su `epoch` por instancia
 * con `now()`, así que fijar el system time hace TODO determinista —
 * incluidos los ids de key (epoch+correlativo) y, por lo tanto, los rolls
 * de `verifyKey`. Las latencias (`mockLatency` usa `Math.random`) quedan
 * acotadas y `settle` avanza la ventana completa.
 *
 * Rolls pinneados (Mulberry32, computados con el mismo algoritmo):
 *   'colegios.norte@fjuanxxiii.cl:sync-err:instagram' → 0.3938 (sin error)
 *   'colegios.norte@fjuanxxiii.cl:sync-err:facebook'  → 0.0229 (< 0.2 → error)
 *   'colegios.norte@fjuanxxiii.cl:sync-err:tiktok'    → 0.6558 (sin error)
 */

const EPOCH_MS = Date.UTC(2026, 7, 14, 12, 0, 0);
const DAY_MS = 86_400_000;
const CLIENT = 'colegios.norte@fjuanxxiii.cl';
const OTHER_CLIENT = 'otra.marca@gmail.com';
const BRAND = 'Colegios Norte';

// Plaintexts que matchean los keyPattern congelados del catálogo (D5.2).
const IG_KEY_PLAINTEXT = `EAA${'A'.repeat(40)}`;
const GPT_KEY_PLAINTEXT = `sk-${'a'.repeat(30)}`;
const GEMINI_KEY_PLAINTEXT = `AIza${'b'.repeat(20)}`;

// Keys de storage literales — pinnean el contrato de D6.1 (base::cliente).
const connectionsKey = (client: string): string =>
  `social:connections:v1::${client}`;
const profileKey = (client: string): string => `social:profile:v1::${client}`;
const apiKeysKey = (client: string): string => `social:api-keys:v1::${client}`;

/** Ventana que cubre la latencia máxima de cualquier método (connect: ≤2 s). */
const SETTLE_WINDOW_MS = 3_000;

interface AuthStub {
  readonly email: WritableSignal<string | null>;
}

function setup(
  email: string | null = CLIENT,
  platform: 'browser' | 'server' = 'browser',
): { service: SocialSettingsService; authStub: AuthStub } {
  TestBed.resetTestingModule();
  const authStub: AuthStub = { email: signal<string | null>(email) };
  TestBed.configureTestingModule({
    providers: [
      { provide: AuthService, useValue: authStub },
      ...(platform === 'server'
        ? [{ provide: PLATFORM_ID, useValue: 'server' }]
        : []),
    ],
  });
  return { service: TestBed.inject(SocialSettingsService), authStub };
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

/**
 * Alta + verificación hasta obtener una key `valid`. Cada key nueva re-tira
 * el dado (id nuevo, RFC-002 D5) con P(valid)=0.75 — con reloj fijo la
 * secuencia de ids es determinista, así que el resultado del loop también.
 */
function addValidKey(service: SocialSettingsService, providerId: ProviderId, plaintext: string) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const { entry } = settle(service.addKey(providerId, plaintext));
    const verified = settle(service.verifyKey(entry.id));
    if (verified.status === 'valid') {
      return verified;
    }
    settle(service.revokeKey(entry.id));
  }
  throw new Error('No se obtuvo una key valid en 30 intentos — revisar seeds');
}

function step(
  service: SocialSettingsService,
  id: OnboardingStep['id'],
): OnboardingStep {
  const found = service.onboardingSteps().find((candidate) => candidate.id === id);
  if (!found) {
    throw new Error(`Paso de onboarding '${id}' no encontrado`);
  }
  return found;
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

describe('SocialSettingsService — defaults SSR (D6.2)', () => {
  it('en server ignora el storage y devuelve el default vacío/deshabilitado', () => {
    // Pre-seed que el server NUNCA debe leer (localStorage es browser-only).
    localStorage.setItem(
      connectionsKey(CLIENT),
      JSON.stringify([buildAccountMock(EPOCH_MS, CLIENT, BRAND, 'instagram')]),
    );
    localStorage.setItem(profileKey(CLIENT), JSON.stringify({ brandName: BRAND }));

    const { service } = setup(CLIENT, 'server');

    expect(service.state().configs).toHaveLength(PROVIDER_CATALOG.length);
    expect(service.state().configs.every((config) => !config.enabled)).toBe(true);
    expect(service.state().keys).toEqual([]);
    expect(service.state().accounts).toEqual([]);
    expect(service.state().activeByKind).toEqual({});
    expect(service.accounts()).toEqual([]);
    expect(service.brandName()).toBe('');
    expect(service.checklistDismissed()).toBe(false);
    expect(service.hasConnectedAccounts()).toBe(false);
  });

  it('en server las mutaciones actualizan memoria pero JAMÁS escriben storage', () => {
    const { service } = setup(CLIENT, 'server');
    service.setBrandName('Marca SSR');
    service.dismissChecklist();

    expect(service.brandName()).toBe('Marca SSR');
    expect(localStorage.getItem(profileKey(CLIENT))).toBeNull();
    expect(localStorage.getItem(`social:onboarding:v1::${CLIENT}`)).toBeNull();
  });
});

describe('SocialSettingsService — scoping por cliente (D1/D6.4)', () => {
  it('dos emails → dos scopes aislados; volver al original restaura su configuración', () => {
    const { service, authStub } = setup(CLIENT);
    service.setBrandName(BRAND);
    settle(service.addKey('instagram-graph', IG_KEY_PLAINTEXT));
    const account = settle(service.connectAccount('instagram'));
    service.dismissChecklist();

    // Cambio de sesión → el único effect re-lee las keys del nuevo scope.
    authStub.email.set(OTHER_CLIENT);
    TestBed.flushEffects();
    expect(service.state().keys).toEqual([]);
    expect(service.accounts()).toEqual([]);
    expect(service.brandName()).toBe('');
    expect(service.checklistDismissed()).toBe(false);

    // El cliente B escribe en SU scope, sin pisar el de A.
    service.setBrandName('Otra Marca');

    // Vuelta al cliente original → su configuración persiste intacta.
    authStub.email.set(CLIENT);
    TestBed.flushEffects();
    expect(service.state().keys).toHaveLength(1);
    expect(service.accounts()).toHaveLength(1);
    expect(service.accounts()[0].id).toBe(account.id);
    expect(service.brandName()).toBe(BRAND);
    expect(service.checklistDismissed()).toBe(true);

    // Dos sufijos distintos conviven en localStorage (D6.1).
    expect(localStorage.getItem(profileKey(CLIENT))).toContain(BRAND);
    expect(localStorage.getItem(profileKey(OTHER_CLIENT))).toContain('Otra Marca');
  });

  it('logout (email null) resetea a defaults y no escribe sin sesión', () => {
    const { service, authStub } = setup(CLIENT);
    settle(service.addKey('gpt', GPT_KEY_PLAINTEXT));

    authStub.email.set(null);
    TestBed.flushEffects();
    expect(service.state().keys).toEqual([]);

    // Sin sesión, storageKey es null → la mutación no toca storage.
    const before = localStorage.length;
    service.setBrandName('Anónimo');
    expect(localStorage.length).toBe(before);
  });
});

describe('SocialSettingsService — revocación en cascada (D5.5)', () => {
  it('revocar la key activa de un conector: key fuera, provider disabled, cuentas en error', () => {
    const { service } = setup(CLIENT);
    const key = addValidKey(service, 'instagram-graph', IG_KEY_PLAINTEXT);
    settle(service.setEnabled('instagram-graph', true));
    settle(service.connectAccount('instagram'));

    expect(service.hasReadyProvider('analytics-connector')()).toBe(true);
    expect(service.accounts()[0].status).toBe('connected');

    settle(service.revokeKey(key.id));

    // (1) La key desaparece — sin tabla de auditoría.
    expect(service.state().keys.find((entry) => entry.id === key.id)).toBeUndefined();
    // (2) Config del conector: disabled + sin activeKeyId.
    const config = service.state().configs.find(
      (entry) => entry.providerId === 'instagram-graph',
    );
    expect(config?.enabled).toBe(false);
    expect(config?.activeKeyId).toBeUndefined();
    // (4) La cuenta pasa a error con el failureReason EXACTO de D5.5.4.
    expect(service.accounts()[0].status).toBe('error');
    expect(service.accounts()[0].failureReason).toBe(
      'La credencial del conector fue revocada.',
    );
    // Gating reactivado; la cuenta en error NO cuenta como conectada.
    expect(service.hasReadyProvider('analytics-connector')()).toBe(false);
    expect(service.hasConnectedAccounts()).toBe(false);
  });

  it('activeByKind: auto-activo al habilitar el primero (D5.4) y promoción al revocar (D5.5.3)', () => {
    const { service } = setup(CLIENT);
    const gptKey = addValidKey(service, 'gpt', GPT_KEY_PLAINTEXT);
    settle(service.setEnabled('gpt', true));
    expect(service.state().activeByKind['text-gen']).toBe('gpt');

    addValidKey(service, 'gemini', GEMINI_KEY_PLAINTEXT);
    settle(service.setEnabled('gemini', true));
    // El segundo habilitado NO desplaza al activo.
    expect(service.state().activeByKind['text-gen']).toBe('gpt');

    settle(service.revokeKey(gptKey.id));
    // gpt cae → gemini (único de la categoría que sigue enabled) se promueve.
    expect(service.state().activeByKind['text-gen']).toBe('gemini');
    expect(
      service.state().configs.find((entry) => entry.providerId === 'gpt')?.enabled,
    ).toBe(false);
  });

  it('revocar el único provider habilitado de la categoría limpia la entry sin promover', () => {
    const { service } = setup(CLIENT);
    const key = addValidKey(service, 'gpt', GPT_KEY_PLAINTEXT);
    settle(service.setEnabled('gpt', true));
    settle(service.revokeKey(key.id));
    expect(service.state().activeByKind['text-gen']).toBeUndefined();
  });

  it('revocar una key inexistente emite error', () => {
    const { service } = setup(CLIENT);
    expect(() => settle(service.revokeKey('key-fantasma'))).toThrowError(/no existe/);
  });
});

describe('SocialSettingsService — verifyKey determinista (D5.3)', () => {
  it('fase 1: plaintext que no matchea el keyPattern → invalid, estable', () => {
    const { service } = setup(CLIENT);
    const { entry } = settle(service.addKey('gpt', 'formato-cualquiera'));
    expect(settle(service.verifyKey(entry.id)).status).toBe('invalid');
    expect(settle(service.verifyKey(entry.id)).status).toBe('invalid');
  });

  it('fase 2: re-verificar la MISMA key repite el resultado (seeded por keyId)', () => {
    const { service } = setup(CLIENT);
    const { entry } = settle(service.addKey('gpt', GPT_KEY_PLAINTEXT));
    const first = settle(service.verifyKey(entry.id));
    const second = settle(service.verifyKey(entry.id));

    expect(['valid', 'invalid', 'expired']).toContain(first.status);
    expect(second.status).toBe(first.status);
    // Solo `valid` setea lastVerifiedAt.
    expect(first.lastVerifiedAt !== undefined).toBe(first.status === 'valid');
  });

  it('keys distintas re-tiran el dado — ids distintos por correlativo', () => {
    const { service } = setup(CLIENT);
    const a = settle(service.addKey('gpt', GPT_KEY_PLAINTEXT));
    const b = settle(service.addKey('gpt', GPT_KEY_PLAINTEXT));
    expect(a.entry.id).not.toBe(b.entry.id);
  });

  it('verificar una key inexistente emite error', () => {
    const { service } = setup(CLIENT);
    expect(() => settle(service.verifyKey('key-fantasma'))).toThrowError(/no existe/);
  });
});

describe('SocialSettingsService — status efectivo en lectura (D4.4 / RFC-002 D6)', () => {
  it('cuenta conectada hace 8 días → expired (TTL 7 días); sigue contando como conectada', () => {
    const stored = buildAccountMock(EPOCH_MS - 8 * DAY_MS, CLIENT, BRAND, 'instagram');
    localStorage.setItem(connectionsKey(CLIENT), JSON.stringify([stored]));
    const { service } = setup(CLIENT);

    expect(service.accounts()[0].status).toBe('expired');
    // El snapshot crudo NO almacena el expiry — se computa en lectura.
    expect(service.state().accounts[0].status).toBe('connected');
    // `expired` cuenta como conectada: hay históricos + banner de reconexión.
    expect(service.hasConnectedAccounts()).toBe(true);
  });

  it('cuenta de 6 días sigue connected (borde del TTL)', () => {
    const stored = buildAccountMock(EPOCH_MS - 6 * DAY_MS, CLIENT, BRAND, 'instagram');
    localStorage.setItem(connectionsKey(CLIENT), JSON.stringify([stored]));
    const { service } = setup(CLIENT);
    expect(EPOCH_MS - Date.parse(stored.connectedAt)).toBeLessThan(TOKEN_TTL_MS);
    expect(service.accounts()[0].status).toBe('connected');
  });

  it('sync-error determinista: SOLO la red sorteada (facebook para este seed) cae en error', () => {
    const instagram = buildAccountMock(EPOCH_MS - 2 * DAY_MS, CLIENT, BRAND, 'instagram');
    const facebook = buildAccountMock(EPOCH_MS - 2 * DAY_MS, CLIENT, BRAND, 'facebook');
    localStorage.setItem(connectionsKey(CLIENT), JSON.stringify([instagram, facebook]));
    const { service } = setup(CLIENT);

    const byNetwork = new Map(service.accounts().map((a) => [a.network, a]));
    // Roll instagram 0.3938 ≥ 0.2 → limpia.
    expect(byNetwork.get('instagram')?.status).toBe('connected');
    // Roll facebook 0.0229 < 0.2 → error con reason del pool y lastSyncAt viejo.
    const fb = byNetwork.get('facebook');
    expect(fb?.status).toBe('error');
    expect(SYNC_FAILURE_REASONS).toContain(fb?.failureReason);
    expect(Date.parse(fb?.lastSyncAt ?? '')).toBeLessThan(EPOCH_MS);
  });

  it('una cuenta recién conectada nunca cae en sync-error (ventana de edad)', () => {
    const { service } = setup(CLIENT);
    // facebook ES la red sorteada de este seed — recién conectada se lee limpia.
    settle(service.connectAccount('facebook'));
    expect(service.accounts()[0].status).toBe('connected');
  });

  it('reconnectAccount limpia expiry y error (refresca connectedAt)', () => {
    const stored = buildAccountMock(EPOCH_MS - 8 * DAY_MS, CLIENT, BRAND, 'facebook');
    localStorage.setItem(connectionsKey(CLIENT), JSON.stringify([stored]));
    const { service } = setup(CLIENT);
    expect(service.accounts()[0].status).toBe('expired');

    const reconnected = settle(service.reconnectAccount(stored.id));
    expect(reconnected.id).toBe(stored.id);
    expect(service.accounts()[0].status).toBe('connected');
    expect(service.accounts()[0].failureReason).toBeUndefined();
  });
});

describe('SocialSettingsService — connectAccount idempotente (D4.3)', () => {
  it('conectar dos veces la misma red produce la MISMA cuenta, sin duplicar', () => {
    const { service } = setup(CLIENT);
    const first = settle(service.connectAccount('instagram'));
    const again = settle(service.connectAccount('instagram'));

    expect(again.id).toBe(first.id);
    expect(service.accounts()).toHaveLength(1);
  });

  it('la identidad se deriva del cliente: handle del email, displayName del brandName', () => {
    const { service } = setup(CLIENT);
    service.setBrandName(BRAND);
    const account = settle(service.connectAccount('instagram'));
    expect(account.handle).toBe('@colegiosnorte');
    expect(account.displayName).toBe(BRAND);
  });
});

describe('SocialSettingsService — plaintext solo en el retorno de addKey (D5.2)', () => {
  it('el plaintext no queda ni en storage ni en el signal; solo la máscara', () => {
    const plaintext = `EAA${'Zx9'.repeat(15)}`;
    const { service } = setup(CLIENT);
    const result = settle(service.addKey('instagram-graph', plaintext, 'Producción'));

    // Retorno único con plaintext + entry enmascarada.
    expect(result.plaintext).toBe(plaintext);
    expect(result.entry.maskedKey).toContain('…');
    expect(result.entry.maskedKey).not.toBe(plaintext);
    expect(result.entry.status).toBe('unverified');
    expect(result.entry.label).toBe('Producción');

    // Ningún valor persistido contiene el plaintext completo.
    for (let i = 0; i < localStorage.length; i++) {
      const storageKey = localStorage.key(i);
      const stored = storageKey === null ? '' : (localStorage.getItem(storageKey) ?? '');
      expect(stored).not.toContain(plaintext);
    }
    expect(localStorage.getItem(apiKeysKey(CLIENT))).toContain(result.entry.maskedKey);
    // El signal tampoco lo retiene.
    expect(JSON.stringify(service.state())).not.toContain(plaintext);
  });
});

describe('SocialSettingsService — gating y onboarding (D3)', () => {
  it('cliente nuevo: solo el paso "account" está done; nada listo', () => {
    const { service } = setup(CLIENT);
    expect(step(service, 'account').done).toBe(true);
    expect(step(service, 'connector-key').done).toBe(false);
    expect(step(service, 'connect-network').done).toBe(false);
    expect(step(service, 'gen-provider').done).toBe(false);
    expect(step(service, 'gen-provider').optional).toBe(true);
    expect(service.hasReadyProvider('analytics-connector')()).toBe(false);
  });

  it('key válida + enable + connect completan los pasos no opcionales', () => {
    const { service } = setup(CLIENT);
    addValidKey(service, 'instagram-graph', IG_KEY_PLAINTEXT);
    settle(service.setEnabled('instagram-graph', true));
    settle(service.connectAccount('instagram'));

    expect(step(service, 'connector-key').done).toBe(true);
    expect(step(service, 'connect-network').done).toBe(true);
  });

  it('setEnabled(true) sin key válida emite error accionable (última línea de defensa)', () => {
    const { service } = setup(CLIENT);
    expect(() => settle(service.setEnabled('gpt', true))).toThrowError(/key/);
    expect(
      service.state().configs.find((entry) => entry.providerId === 'gpt')?.enabled,
    ).toBe(false);
  });

  it('hasReadyProvider memoiza: mismo kind → mismo Signal', () => {
    const { service } = setup(CLIENT);
    expect(service.hasReadyProvider('text-gen')).toBe(service.hasReadyProvider('text-gen'));
  });

  it('getState() emite el snapshot crudo actual', () => {
    const { service } = setup(CLIENT);
    settle(service.addKey('gpt', GPT_KEY_PLAINTEXT));
    expect(settle(service.getState())).toEqual(service.state());
  });
});
