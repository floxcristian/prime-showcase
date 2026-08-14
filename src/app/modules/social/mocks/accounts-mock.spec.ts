import { describe, expect, it } from 'vitest';

import { SOCIAL_NETWORKS } from '../models/social.interface';
import { buildAccountMock } from './accounts-mock';
import { clientHash } from './social-mock-utils';

/**
 * Specs de RFC-002 plan §5 para `buildAccountMock`: determinismo (dos
 * invocaciones idénticas → deep-equal), scoping (dos clientSeeds →
 * handles distintos) y la regla de identidad D6: el handle SIEMPRE se
 * deriva del email — cero literales, cero pools para cuentas propias.
 */

const EPOCH = Date.UTC(2026, 7, 14, 12, 0, 0);
const CLIENT = 'colegios.norte@fjuanxxiii.cl';
const BRAND = 'Colegios Norte';

/** Derivación de referencia del handle, computada EN el spec — si la
 *  factory usara un literal o un pool, esta igualdad se rompería. */
const expectedHandle = (email: string): string =>
  '@' + (email.trim().toLowerCase().split('@')[0] ?? '').replace(/[^a-z0-9]/g, '');

describe('buildAccountMock — determinismo', () => {
  it('dos invocaciones idénticas → cuentas deep-equal', () => {
    const a = buildAccountMock(EPOCH, CLIENT, BRAND, 'instagram');
    const b = buildAccountMock(EPOCH, CLIENT, BRAND, 'instagram');
    expect(a).toEqual(b);
  });

  it('reconectar (epoch nuevo) reproduce la MISMA cuenta: id, handle y números estables', () => {
    const first = buildAccountMock(EPOCH, CLIENT, BRAND, 'tiktok');
    const reconnected = buildAccountMock(EPOCH + 86_400_000, CLIENT, BRAND, 'tiktok');
    expect(reconnected.id).toBe(first.id);
    expect(reconnected.handle).toBe(first.handle);
    expect(reconnected.followers).toBe(first.followers);
    expect(reconnected.following).toBe(first.following);
    expect(reconnected.postsCount).toBe(first.postsCount);
    // Solo los timestamps se refrescan con el nuevo epoch.
    expect(reconnected.connectedAt).not.toBe(first.connectedAt);
  });

  it('redes distintas del mismo cliente → ids distintos y seeds distintos', () => {
    const accounts = SOCIAL_NETWORKS.map((n) => buildAccountMock(EPOCH, CLIENT, BRAND, n));
    const ids = accounts.map((a) => a.id);
    expect(new Set(ids).size).toBe(SOCIAL_NETWORKS.length);
    // El seed `${clientSeed}:acct:${network}` varía por red → los números
    // también (determinista: este resultado quedó fijado al escribir el spec).
    const followers = accounts.map((a) => a.followers);
    expect(new Set(followers).size).toBe(SOCIAL_NETWORKS.length);
  });
});

describe('buildAccountMock — identidad derivada del cliente (D6)', () => {
  it('handle = @ + localPart saneado del email (caso RFC: colegios.norte → @colegiosnorte)', () => {
    const account = buildAccountMock(EPOCH, CLIENT, BRAND, 'instagram');
    expect(account.handle).toBe('@colegiosnorte');
  });

  it('el handle se deriva SIEMPRE del email — cero literales ni pools', () => {
    const emails = [
      'colegios.norte@fjuanxxiii.cl',
      'maria_jose+ventas@empresa.cl',
      'demo@showcase',
      'FERRETERIA.SUR@Gmail.com',
    ];
    for (const email of emails) {
      const account = buildAccountMock(EPOCH, email, '', 'facebook');
      expect(account.handle).toBe(expectedHandle(email));
    }
  });

  it('dos clientSeeds distintos → handles e ids distintos (aislamiento por cliente)', () => {
    const a = buildAccountMock(EPOCH, 'colegios.norte@fjuanxxiii.cl', BRAND, 'instagram');
    const b = buildAccountMock(EPOCH, 'otra.marca@gmail.com', 'Otra Marca', 'instagram');
    expect(a.handle).not.toBe(b.handle);
    expect(a.id).not.toBe(b.id);
  });

  it('id = acc-<network>-<clientHash(clientSeed)> (shape del contrato D2)', () => {
    const account = buildAccountMock(EPOCH, CLIENT, BRAND, 'instagram');
    expect(account.id).toBe(`acc-instagram-${clientHash(CLIENT)}`);
  });

  it('displayName = brandName del signup; fallback = localPart capitalizado', () => {
    const withBrand = buildAccountMock(EPOCH, CLIENT, BRAND, 'instagram');
    expect(withBrand.displayName).toBe('Colegios Norte');

    const withoutBrand = buildAccountMock(EPOCH, CLIENT, '   ', 'instagram');
    expect(withoutBrand.displayName).toBe('Colegiosnorte');
  });
});

describe('buildAccountMock — shape y timestamps', () => {
  it('connectorId mapeado red → AnalyticsConnectorId del catálogo', () => {
    expect(buildAccountMock(EPOCH, CLIENT, BRAND, 'instagram').connectorId).toBe(
      'instagram-graph',
    );
    expect(buildAccountMock(EPOCH, CLIENT, BRAND, 'facebook').connectorId).toBe(
      'facebook-graph',
    );
    expect(buildAccountMock(EPOCH, CLIENT, BRAND, 'tiktok').connectorId).toBe('tiktok-api');
  });

  it('timestamps derivados del epoch: connectedAt = lastSyncAt = epoch ISO', () => {
    const account = buildAccountMock(EPOCH, CLIENT, BRAND, 'tiktok');
    expect(account.connectedAt).toBe(new Date(EPOCH).toISOString());
    expect(account.lastSyncAt).toBe(account.connectedAt);
  });

  it('nace connected y limpia — el status efectivo (expired/error) se computa en lectura', () => {
    const account = buildAccountMock(EPOCH, CLIENT, BRAND, 'facebook');
    expect(account.status).toBe('connected');
    expect(account.failureReason).toBeUndefined();
  });

  it('followers/following/postsCount son enteros positivos en rangos plausibles por red', () => {
    for (const network of SOCIAL_NETWORKS) {
      const account = buildAccountMock(EPOCH, CLIENT, BRAND, network);
      for (const value of [account.followers, account.following, account.postsCount]) {
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThan(0);
      }
      // Una pyme sigue a menos cuentas de las que la siguen — coherencia
      // narrativa de los rangos por red.
      expect(account.followers).toBeGreaterThan(account.following);
    }
  });
});
