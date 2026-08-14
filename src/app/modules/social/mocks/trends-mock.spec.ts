import { describe, expect, it } from 'vitest';

import { SOCIAL_NETWORKS } from '../models/social.interface';
import { buildHashtagSuggestionsMock, buildTrendsMock } from './trends-mock';

/**
 * Specs de RFC-002 plan §5 para las dos factories de `trends-mock.ts`:
 * determinismo, scoping por clientSeed, volúmenes D7 (trends 6-8 por red;
 * suggestions 9-12 por topic NORMALIZADO) y los invariantes de D2
 * (volumeSeries de 30 buckets anclada al epoch, tags sin '#').
 */

const EPOCH = Date.UTC(2026, 7, 14, 12, 0, 0);
const CLIENT = 'colegios.norte@fjuanxxiii.cl';
const OTHER = 'otra.marca@gmail.com';

describe('buildTrendsMock — determinismo y scoping', () => {
  it('dos invocaciones idénticas → trends deep-equal', () => {
    const a = buildTrendsMock(EPOCH, CLIENT, 'instagram');
    const b = buildTrendsMock(EPOCH, CLIENT, 'instagram');
    expect(a).toEqual(b);
  });

  it('dos clientSeeds distintos → series de volumen distintas (mismo contenido curado)', () => {
    const a = buildTrendsMock(EPOCH, CLIENT, 'tiktok');
    const b = buildTrendsMock(EPOCH, OTHER, 'tiktok');
    expect(a.map((t) => t.volumeSeries)).not.toEqual(b.map((t) => t.volumeSeries));
  });

  it('redes distintas → seeds distintos (contenido y series propias)', () => {
    const ig = buildTrendsMock(EPOCH, CLIENT, 'instagram');
    const fb = buildTrendsMock(EPOCH, CLIENT, 'facebook');
    expect(ig.map((t) => t.title)).not.toEqual(fb.map((t) => t.title));
  });
});

describe('buildTrendsMock — volúmenes e invariantes (D2/D7)', () => {
  it('produce 6-8 tendencias por red, con network e ids coherentes', () => {
    for (const network of SOCIAL_NETWORKS) {
      const trends = buildTrendsMock(EPOCH, CLIENT, network);
      expect(trends.length).toBeGreaterThanOrEqual(6);
      expect(trends.length).toBeLessThanOrEqual(8);
      for (const [i, trend] of trends.entries()) {
        expect(trend.network).toBe(network);
        expect(trend.id).toBe(`trend-${network}-${i + 1}`);
      }
    }
  });

  it('volumeSeries: SIEMPRE 30 buckets diarios, ordenados y anclados al epoch', () => {
    for (const network of SOCIAL_NETWORKS) {
      for (const trend of buildTrendsMock(EPOCH, CLIENT, network)) {
        expect(trend.volumeSeries).toHaveLength(30);
        const times = trend.volumeSeries.map((p) => new Date(p.t).getTime());
        expect(times[times.length - 1]).toBe(EPOCH);
        for (let i = 1; i < times.length; i++) {
          expect(times[i] - times[i - 1]).toBe(86_400_000);
        }
      }
    }
  });

  it('el momentum rota por round-robin seeded: los tres valores aparecen', () => {
    for (const network of SOCIAL_NETWORKS) {
      const momenta = new Set(buildTrendsMock(EPOCH, CLIENT, network).map((t) => t.momentum));
      expect(momenta.size).toBe(3);
    }
  });

  it('la serie cuenta la historia del badge: rising sube, declining baja', () => {
    const mean = (vs: readonly number[]): number =>
      vs.reduce((acc, v) => acc + v, 0) / vs.length;
    for (const network of SOCIAL_NETWORKS) {
      for (const trend of buildTrendsMock(EPOCH, CLIENT, network)) {
        const values = trend.volumeSeries.map((p) => p.v);
        const head = mean(values.slice(0, 10));
        const tail = mean(values.slice(-10));
        if (trend.momentum === 'rising') {
          expect(tail).toBeGreaterThan(head);
        }
        if (trend.momentum === 'declining') {
          expect(tail).toBeLessThan(head);
        }
      }
    }
  });

  it('TikTok arranca con sonidos: los primeros trends son kind audio (RFC-005 D6)', () => {
    const trends = buildTrendsMock(EPOCH, CLIENT, 'tiktok');
    expect(trends[0].kind).toBe('audio');
    expect(trends[1].kind).toBe('audio');
    expect(trends[2].kind).toBe('audio');
  });

  it('windowDays en rango 7-28 y volúmenes positivos', () => {
    for (const trend of buildTrendsMock(EPOCH, CLIENT, 'facebook')) {
      expect(trend.windowDays).toBeGreaterThanOrEqual(7);
      expect(trend.windowDays).toBeLessThanOrEqual(28);
      for (const p of trend.volumeSeries) {
        expect(p.v).toBeGreaterThan(0);
      }
    }
  });
});

describe('buildHashtagSuggestionsMock — determinismo y normalización (D7)', () => {
  it('dos invocaciones idénticas → sugerencias deep-equal', () => {
    const a = buildHashtagSuggestionsMock(CLIENT, 'ferretería', 'instagram');
    const b = buildHashtagSuggestionsMock(CLIENT, 'ferretería', 'instagram');
    expect(a).toEqual(b);
  });

  it('topic NORMALIZADO trim().toLowerCase(): mismo topic, mismas chips', () => {
    const canonical = buildHashtagSuggestionsMock(CLIENT, 'ferretería', 'instagram');
    for (const variant of ['  Ferretería ', 'FERRETERÍA', 'ferretería  ']) {
      expect(buildHashtagSuggestionsMock(CLIENT, variant, 'instagram')).toEqual(canonical);
    }
  });

  it('dos clientSeeds distintos → volúmenes/scores distintos', () => {
    const a = buildHashtagSuggestionsMock(CLIENT, 'despacho', 'tiktok');
    const b = buildHashtagSuggestionsMock(OTHER, 'despacho', 'tiktok');
    expect(a.map((s) => s.volume)).not.toEqual(b.map((s) => s.volume));
  });

  it('la red participa del seed: sugerencias distintas por red', () => {
    const ig = buildHashtagSuggestionsMock(CLIENT, 'despacho', 'instagram');
    const fb = buildHashtagSuggestionsMock(CLIENT, 'despacho', 'facebook');
    expect(ig.map((s) => s.volume)).not.toEqual(fb.map((s) => s.volume));
  });
});

describe('buildHashtagSuggestionsMock — volúmenes e invariantes (D2/D7)', () => {
  const suggestions = buildHashtagSuggestionsMock(CLIENT, 'ferretería', 'instagram');

  it('produce 9-12 sugerencias por topic', () => {
    expect(suggestions.length).toBeGreaterThanOrEqual(9);
    expect(suggestions.length).toBeLessThanOrEqual(12);
  });

  it('tags únicos, SIN "#", saneados a [a-z0-9] (forma canónica D2)', () => {
    const tags = suggestions.map((s) => s.tag);
    expect(new Set(tags).size).toBe(tags.length);
    for (const tag of tags) {
      expect(tag).toMatch(/^[a-z0-9]+$/);
    }
  });

  it('incluye el tag derivado del topic (sin tildes) con relevancia alta', () => {
    const own = suggestions.find((s) => s.tag === 'ferreteria');
    expect(own).toBeDefined();
    expect(own!.relevanceScore).toBeGreaterThanOrEqual(70);
  });

  it('las tres difficulties aparecen y el volumen es coherente con cada una', () => {
    const ranges = {
      high: [50_000, 180_000],
      medium: [8_000, 48_000],
      low: [500, 7_500],
    } as const;
    expect(new Set(suggestions.map((s) => s.difficulty)).size).toBe(3);
    for (const s of suggestions) {
      const [min, max] = ranges[s.difficulty];
      expect(s.volume).toBeGreaterThanOrEqual(min);
      expect(s.volume).toBeLessThanOrEqual(max);
    }
  });

  it('relevanceScore 0-100, trendDelta acotado, 3 relatedTags sin incluirse a sí mismo', () => {
    for (const s of suggestions) {
      expect(s.relevanceScore).toBeGreaterThanOrEqual(0);
      expect(s.relevanceScore).toBeLessThanOrEqual(100);
      expect(s.trendDelta).toBeGreaterThanOrEqual(-25);
      expect(s.trendDelta).toBeLessThanOrEqual(60);
      expect(s.relatedTags).toHaveLength(3);
      expect(s.relatedTags).not.toContain(s.tag);
      expect(s.network).toBe('instagram');
    }
  });
});
