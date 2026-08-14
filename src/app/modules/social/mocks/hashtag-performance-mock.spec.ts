import { describe, expect, it } from 'vitest';

import { SOCIAL_NETWORKS } from '../models/social.interface';
import { buildHashtagPerformanceMock } from './hashtag-performance-mock';
import { HASHTAG_POOL } from './social-mock-utils';

/**
 * Specs de RFC-002 plan §5 para `buildHashtagPerformanceMock`:
 * determinismo, scoping por clientSeed y volúmenes D7 (8-10 filas por red,
 * seed `${clientSeed}:hperf:${network}`), tags en forma canónica sin '#'.
 */

const EPOCH = Date.UTC(2026, 7, 14, 12, 0, 0);
const CLIENT = 'colegios.norte@fjuanxxiii.cl';
const OTHER = 'otra.marca@gmail.com';

describe('buildHashtagPerformanceMock — determinismo y scoping', () => {
  it('dos invocaciones idénticas → filas deep-equal', () => {
    const a = buildHashtagPerformanceMock(EPOCH, CLIENT, 'instagram');
    const b = buildHashtagPerformanceMock(EPOCH, CLIENT, 'instagram');
    expect(a).toEqual(b);
  });

  it('dos clientSeeds distintos → métricas distintas', () => {
    const a = buildHashtagPerformanceMock(EPOCH, CLIENT, 'facebook');
    const b = buildHashtagPerformanceMock(EPOCH, OTHER, 'facebook');
    expect(a.map((h) => h.avgReach)).not.toEqual(b.map((h) => h.avgReach));
  });

  it('la red participa del seed: filas distintas por red', () => {
    const ig = buildHashtagPerformanceMock(EPOCH, CLIENT, 'instagram');
    const tk = buildHashtagPerformanceMock(EPOCH, CLIENT, 'tiktok');
    expect(ig.map((h) => h.avgEngagementRate)).not.toEqual(
      tk.map((h) => h.avgEngagementRate),
    );
  });
});

describe('buildHashtagPerformanceMock — volúmenes e invariantes (D2/D7)', () => {
  it('produce 8-10 filas por red con tags únicos del rubro, sin "#"', () => {
    for (const network of SOCIAL_NETWORKS) {
      const rows = buildHashtagPerformanceMock(EPOCH, CLIENT, network);
      expect(rows.length).toBeGreaterThanOrEqual(8);
      expect(rows.length).toBeLessThanOrEqual(10);
      const tags = rows.map((r) => r.tag);
      expect(new Set(tags).size).toBe(tags.length);
      for (const row of rows) {
        expect(row.tag).not.toContain('#');
        expect(HASHTAG_POOL).toContain(row.tag);
        expect(row.network).toBe(network);
      }
    }
  });

  it('métricas precalculadas en rangos plausibles (usos, reach, ER a 1 decimal)', () => {
    for (const network of SOCIAL_NETWORKS) {
      for (const row of buildHashtagPerformanceMock(EPOCH, CLIENT, network)) {
        expect(Number.isInteger(row.timesUsed)).toBe(true);
        expect(row.timesUsed).toBeGreaterThanOrEqual(2);
        expect(row.timesUsed).toBeLessThanOrEqual(24);
        expect(Number.isInteger(row.avgReach)).toBe(true);
        expect(row.avgReach).toBeGreaterThan(0);
        expect(row.avgEngagementRate).toBe(Math.round(row.avgEngagementRate * 10) / 10);
        expect(row.avgEngagementRate).toBeGreaterThanOrEqual(0.8);
        expect(row.avgEngagementRate).toBeLessThanOrEqual(9.5);
      }
    }
  });

  it('lastUsedAt deriva del epoch: entre 12 h y 28 días antes', () => {
    for (const row of buildHashtagPerformanceMock(EPOCH, CLIENT, 'tiktok')) {
      const t = new Date(row.lastUsedAt).getTime();
      expect(t).toBeLessThanOrEqual(EPOCH - 720 * 60_000);
      expect(t).toBeGreaterThanOrEqual(EPOCH - 28 * 86_400_000 - 720 * 60_000);
    }
  });
});
