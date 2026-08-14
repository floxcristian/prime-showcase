import { describe, expect, it } from 'vitest';

import { SOCIAL_NETWORKS } from '../models/social.interface';
import { buildAudienceMock } from './audience-mock';

/**
 * Specs de RFC-002 plan §5 para `buildAudienceMock`: determinismo (dos
 * invocaciones idénticas → deep-equal), scoping (dos clientSeeds → datos
 * distintos) y los contratos de D2/D7: `activeHours` con 24 valores 0-100,
 * `activeDays` con 7, breakdowns que suman 100, `trafficSources` solo
 * tiktok.
 */

const EPOCH = Date.UTC(2026, 7, 14, 12, 0, 0);
const CLIENT = 'colegios.norte@fjuanxxiii.cl';
const OTHER = 'otra.marca@gmail.com';
const ACC_IG = 'acc-instagram-x1';
const ACC_TT = 'acc-tiktok-x1';

const sumPct = (parts: readonly { readonly pct: number }[]): number =>
  parts.reduce((acc, p) => acc + p.pct, 0);

describe('buildAudienceMock — determinismo y scoping', () => {
  it('dos invocaciones idénticas → deep-equal', () => {
    const a = buildAudienceMock(EPOCH, CLIENT, ACC_IG, 'instagram');
    const b = buildAudienceMock(EPOCH, CLIENT, ACC_IG, 'instagram');
    expect(a).toEqual(b);
  });

  it('dos clientSeeds distintos → snapshots distintos (aislamiento por cliente)', () => {
    const a = buildAudienceMock(EPOCH, CLIENT, ACC_IG, 'instagram');
    const b = buildAudienceMock(EPOCH, OTHER, ACC_IG, 'instagram');
    expect(a).not.toEqual(b);
  });

  it('capturedAt deriva del epoch (cero reloj real)', () => {
    const snapshot = buildAudienceMock(EPOCH, CLIENT, ACC_IG, 'instagram');
    expect(snapshot.capturedAt).toBe(new Date(EPOCH).toISOString());
    expect(snapshot.accountId).toBe(ACC_IG);
  });
});

describe('buildAudienceMock — contratos de shape (D2)', () => {
  it('activeHours: exactamente 24 valores enteros 0-100', () => {
    for (const network of SOCIAL_NETWORKS) {
      const snapshot = buildAudienceMock(EPOCH, CLIENT, `acc-${network}-x1`, network);
      expect(snapshot.activeHours).toHaveLength(24);
      for (const v of snapshot.activeHours) {
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
    }
  });

  it('activeDays: exactamente 7 valores enteros 0-100 (0=lun … 6=dom)', () => {
    const snapshot = buildAudienceMock(EPOCH, CLIENT, ACC_IG, 'instagram');
    expect(snapshot.activeDays).toHaveLength(7);
    for (const v of snapshot.activeDays) {
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it('breakdowns porcentuales suman EXACTAMENTE 100 (redondeo por resto mayor)', () => {
    for (const network of SOCIAL_NETWORKS) {
      const snapshot = buildAudienceMock(EPOCH, CLIENT, `acc-${network}-x1`, network);
      expect(sumPct(snapshot.byAge)).toBe(100);
      expect(sumPct(snapshot.byGender)).toBe(100);
      expect(sumPct(snapshot.byCountry)).toBe(100);
      expect(sumPct(snapshot.byCity)).toBe(100);
    }
  });

  it('audiencia es-CL: Chile domina países y Santiago está entre las ciudades', () => {
    const snapshot = buildAudienceMock(EPOCH, CLIENT, ACC_IG, 'instagram');
    const chile = snapshot.byCountry.find((c) => c.country === 'Chile');
    const maxCountry = Math.max(...snapshot.byCountry.map((c) => c.pct));
    expect(chile?.pct).toBe(maxCountry);
    expect(snapshot.byCity.some((c) => c.city === 'Santiago')).toBe(true);
  });
});

describe('buildAudienceMock — trafficSources solo tiktok (D2/D7)', () => {
  it('instagram y facebook NO exponen trafficSources', () => {
    expect(buildAudienceMock(EPOCH, CLIENT, ACC_IG, 'instagram').trafficSources).toBeUndefined();
    expect(
      buildAudienceMock(EPOCH, CLIENT, 'acc-facebook-x1', 'facebook').trafficSources,
    ).toBeUndefined();
  });

  it('tiktok expone el breakdown FYP: suma 100 y fyp es la fuente dominante', () => {
    const snapshot = buildAudienceMock(EPOCH, CLIENT, ACC_TT, 'tiktok');
    const sources = snapshot.trafficSources ?? [];
    expect(sources.map((s) => s.source)).toEqual(['fyp', 'profile', 'search', 'other']);
    expect(sumPct(sources)).toBe(100);
    const fyp = sources.find((s) => s.source === 'fyp');
    expect(fyp!.pct).toBe(Math.max(...sources.map((s) => s.pct)));
  });
});
