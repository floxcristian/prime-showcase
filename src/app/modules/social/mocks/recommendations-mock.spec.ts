import { describe, expect, it } from 'vitest';

import { SOCIAL_NETWORKS } from '../models/social.interface';
import { buildAccountMock } from './accounts-mock';
import { buildRecommendationsMock } from './recommendations-mock';

/**
 * Specs de RFC-002 plan §5 para `buildRecommendationsMock`: determinismo
 * (dos invocaciones idénticas → deep-equal), scoping por clientSeed y los
 * invariantes de D2/D7: 3-4 por cuenta, mix de types/severities por
 * round-robin, sparkline de 14 puntos, actionRoute sancionado.
 */

const EPOCH = Date.UTC(2026, 7, 14, 12, 0, 0);
const CLIENT = 'colegios.norte@fjuanxxiii.cl';
const OTHER = 'otra.marca@gmail.com';
const BRAND = 'Colegios Norte';

const account = (clientSeed = CLIENT, network = SOCIAL_NETWORKS[0]) =>
  buildAccountMock(EPOCH, clientSeed, BRAND, network);

describe('buildRecommendationsMock — determinismo y scoping', () => {
  it('dos invocaciones idénticas → feeds deep-equal', () => {
    const acc = account();
    const a = buildRecommendationsMock(EPOCH, CLIENT, acc);
    const b = buildRecommendationsMock(EPOCH, CLIENT, acc);
    expect(a).toEqual(b);
  });

  it('dos clientSeeds distintos → evidencia y timestamps distintos', () => {
    const a = buildRecommendationsMock(EPOCH, CLIENT, account(CLIENT));
    const b = buildRecommendationsMock(EPOCH, OTHER, account(OTHER));
    // Los ids ya difieren por accountId; la señal fuerte de scoping es que
    // los NÚMEROS seeded también difieren.
    expect(a.map((r) => r.evidence.observedValue)).not.toEqual(
      b.map((r) => r.evidence.observedValue),
    );
    expect(a.map((r) => r.detectedAt)).not.toEqual(b.map((r) => r.detectedAt));
  });

  it('cuentas distintas del mismo cliente → seeds distintos por accountId', () => {
    const ig = buildRecommendationsMock(EPOCH, CLIENT, account(CLIENT, 'instagram'));
    const tk = buildRecommendationsMock(EPOCH, CLIENT, account(CLIENT, 'tiktok'));
    expect(ig.map((r) => r.evidence.sparkline)).not.toEqual(
      tk.map((r) => r.evidence.sparkline),
    );
  });
});

describe('buildRecommendationsMock — volúmenes y mix (D7)', () => {
  it('produce 3-4 recomendaciones por cuenta', () => {
    for (const network of SOCIAL_NETWORKS) {
      const recos = buildRecommendationsMock(EPOCH, CLIENT, account(CLIENT, network));
      expect(recos.length).toBeGreaterThanOrEqual(3);
      expect(recos.length).toBeLessThanOrEqual(4);
    }
  });

  it('round-robin garantiza el mix: los 3 types y las 3 severities aparecen', () => {
    for (const network of SOCIAL_NETWORKS) {
      const recos = buildRecommendationsMock(EPOCH, CLIENT, account(CLIENT, network));
      expect(new Set(recos.map((r) => r.type)).size).toBe(3);
      expect(new Set(recos.map((r) => r.severity)).size).toBe(3);
    }
  });
});

describe('buildRecommendationsMock — shape del contrato (D2)', () => {
  const acc = account();
  const recos = buildRecommendationsMock(EPOCH, CLIENT, acc);

  it('referencia la cuenta real: accountId, network e ids derivados', () => {
    for (const [i, reco] of recos.entries()) {
      expect(reco.accountId).toBe(acc.id);
      expect(reco.network).toBe(acc.network);
      expect(reco.id).toBe(`reco-${acc.id}-${i + 1}`);
    }
  });

  it('evidence.sparkline tiene SIEMPRE 14 puntos (sparklineFrom(rand, 14))', () => {
    for (const reco of recos) {
      expect(reco.evidence.sparkline).toHaveLength(14);
      for (const v of reco.evidence.sparkline) {
        expect(Number.isFinite(v)).toBe(true);
      }
    }
  });

  it('actionRoute solo toma las tres rutas sancionadas por D2', () => {
    const allowed = ['/social/planner', '/social/analytics', '/social/connections'];
    for (const reco of recos) {
      expect(allowed).toContain(reco.actionRoute);
    }
  });

  it('suggestedAction es-CL accionable (no vacío) y detail presente', () => {
    for (const reco of recos) {
      expect(reco.suggestedAction.length).toBeGreaterThan(10);
      expect(reco.detail.length).toBeGreaterThan(10);
      expect(reco.title.length).toBeGreaterThan(0);
    }
  });

  it('detectedAt deriva del epoch: entre 1 h y 3 días antes', () => {
    for (const reco of recos) {
      const t = new Date(reco.detectedAt).getTime();
      expect(t).toBeLessThanOrEqual(EPOCH - 60 * 60_000);
      expect(t).toBeGreaterThanOrEqual(EPOCH - 3 * 86_400_000 - 60 * 60_000);
    }
  });

  it('observed/expected son valores con 1 decimal (precalculados en factory)', () => {
    for (const reco of recos) {
      for (const v of [reco.evidence.observedValue, reco.evidence.expectedValue]) {
        expect(v).toBe(Math.round(v * 10) / 10);
        expect(v).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
