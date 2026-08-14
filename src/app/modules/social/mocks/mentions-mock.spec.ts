import { describe, expect, it } from 'vitest';

import { SOCIAL_NETWORKS } from '../models/social.interface';
import { buildBrandMentionsMock } from './mentions-mock';
import { MENTION_AUTHOR_HANDLES, MENTION_EXCERPTS } from './social-mock-utils';

/**
 * Specs de RFC-002 plan §5 para `buildBrandMentionsMock`: determinismo
 * (dos invocaciones idénticas → deep-equal), scoping (dos clientSeeds →
 * datos distintos) y los contratos de D7: 4-5 menciones por red conectada,
 * máx. 15 total, mix de sentiments garantizado por round-robin,
 * `permalink: '#'` e identidad de TERCEROS desde los pools es-CL.
 */

const EPOCH = Date.UTC(2026, 7, 14, 12, 0, 0);
const CLIENT = 'colegios.norte@fjuanxxiii.cl';
const OTHER = 'otra.marca@gmail.com';

describe('buildBrandMentionsMock — determinismo y scoping', () => {
  it('dos invocaciones idénticas → deep-equal', () => {
    const a = buildBrandMentionsMock(EPOCH, CLIENT, SOCIAL_NETWORKS);
    const b = buildBrandMentionsMock(EPOCH, CLIENT, SOCIAL_NETWORKS);
    expect(a).toEqual(b);
  });

  it('dos clientSeeds distintos → menciones distintas (aislamiento por cliente)', () => {
    const a = buildBrandMentionsMock(EPOCH, CLIENT, SOCIAL_NETWORKS);
    const b = buildBrandMentionsMock(EPOCH, OTHER, SOCIAL_NETWORKS);
    expect(a).not.toEqual(b);
  });

  it('el orden del array de redes NO afecta el resultado (set normalizado)', () => {
    const canonical = buildBrandMentionsMock(EPOCH, CLIENT, ['instagram', 'facebook', 'tiktok']);
    const shuffled = buildBrandMentionsMock(EPOCH, CLIENT, ['tiktok', 'instagram', 'facebook']);
    expect(shuffled).toEqual(canonical);
  });

  it('sin redes conectadas → lista vacía (empty state con CTA, gating RFC-001)', () => {
    expect(buildBrandMentionsMock(EPOCH, CLIENT, [])).toEqual([]);
  });
});

describe('buildBrandMentionsMock — volúmenes (D7)', () => {
  it('4-5 menciones por red conectada, máx. 15 total', () => {
    const all = buildBrandMentionsMock(EPOCH, CLIENT, SOCIAL_NETWORKS);
    expect(all.length).toBeLessThanOrEqual(15);
    for (const network of SOCIAL_NETWORKS) {
      const count = all.filter((m) => m.network === network).length;
      expect(count).toBeGreaterThanOrEqual(4);
      expect(count).toBeLessThanOrEqual(5);
    }
    expect(new Set(all.map((m) => m.id)).size).toBe(all.length);
  });

  it('con una sola red conectada, solo hay menciones de esa red', () => {
    const only = buildBrandMentionsMock(EPOCH, CLIENT, ['instagram']);
    expect(only.length).toBeGreaterThanOrEqual(4);
    expect(only.length).toBeLessThanOrEqual(5);
    for (const mention of only) {
      expect(mention.network).toBe('instagram');
    }
  });

  it('mentionedAt: relativo a epoch, estrictamente descendente y nunca futuro', () => {
    const all = buildBrandMentionsMock(EPOCH, CLIENT, SOCIAL_NETWORKS);
    const times = all.map((m) => new Date(m.mentionedAt).getTime());
    for (let i = 1; i < times.length; i++) {
      expect(times[i]!).toBeLessThan(times[i - 1]!);
    }
    expect(Math.max(...times)).toBeLessThan(EPOCH);
  });
});

describe('buildBrandMentionsMock — sentiments e identidad (D6/D7)', () => {
  it('mix de sentiments garantizado por round-robin: ciclo positive → neutral → negative', () => {
    const all = buildBrandMentionsMock(EPOCH, CLIENT, SOCIAL_NETWORKS);
    const cycle = ['positive', 'neutral', 'negative'] as const;
    all.forEach((mention, i) => {
      expect(mention.sentiment).toBe(cycle[i % 3]);
    });
    // Con ≥3 menciones, los tres sentiments están presentes.
    expect(new Set(all.map((m) => m.sentiment)).size).toBe(3);
  });

  it('autores y excerpts salen de los pools es-CL de TERCEROS', () => {
    const all = buildBrandMentionsMock(EPOCH, CLIENT, SOCIAL_NETWORKS);
    for (const mention of all) {
      expect(MENTION_AUTHOR_HANDLES).toContain(mention.authorHandle);
      expect(MENTION_EXCERPTS).toContain(mention.excerpt);
    }
  });

  it('permalink es "#" — mock, sin listening real detrás', () => {
    const all = buildBrandMentionsMock(EPOCH, CLIENT, SOCIAL_NETWORKS);
    for (const mention of all) {
      expect(mention.permalink).toBe('#');
    }
  });
});
