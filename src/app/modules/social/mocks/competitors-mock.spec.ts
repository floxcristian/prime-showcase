import { describe, expect, it } from 'vitest';

import { SOCIAL_NETWORKS } from '../models/social.interface';
import { buildAccountMock } from './accounts-mock';
import { buildBenchmarksMock, buildCompetitorsMock } from './competitors-mock';
import { COMPETITOR_POOLS } from './social-mock-utils';

/**
 * Specs de RFC-002 plan §5 para `buildCompetitorsMock` y
 * `buildBenchmarksMock`: determinismo (dos invocaciones idénticas →
 * deep-equal), scoping (dos clientSeeds → datos distintos) y los contratos
 * de D2/D7: 3 competidores por red con identidad del pool es-CL de
 * TERCEROS, `followersSeries` de 90 días, share of voice que suma 100 con
 * la cuenta propia, `topRecentPost` incluido, y benchmarks con
 * `position`/`gapPct` PRECOMPUTADOS.
 */

const EPOCH = Date.UTC(2026, 7, 14, 12, 0, 0);
const CLIENT = 'colegios.norte@fjuanxxiii.cl';
const OTHER = 'otra.marca@gmail.com';
const OWN_FOLLOWERS = 8000;

describe('buildCompetitorsMock — determinismo y scoping', () => {
  it('dos invocaciones idénticas → deep-equal', () => {
    const a = buildCompetitorsMock(EPOCH, CLIENT, 'instagram', OWN_FOLLOWERS);
    const b = buildCompetitorsMock(EPOCH, CLIENT, 'instagram', OWN_FOLLOWERS);
    expect(a).toEqual(b);
  });

  it('dos clientSeeds distintos → números distintos del mismo mercado', () => {
    const a = buildCompetitorsMock(EPOCH, CLIENT, 'instagram', OWN_FOLLOWERS);
    const b = buildCompetitorsMock(EPOCH, OTHER, 'instagram', OWN_FOLLOWERS);
    expect(a.map((c) => c.followers)).not.toEqual(b.map((c) => c.followers));
  });
});

describe('buildCompetitorsMock — identidad y volúmenes (D6/D7)', () => {
  it('3 competidores por red, identidad del pool curado es-CL de TERCEROS', () => {
    for (const network of SOCIAL_NETWORKS) {
      const competitors = buildCompetitorsMock(EPOCH, CLIENT, network, OWN_FOLLOWERS);
      expect(competitors).toHaveLength(3);
      const poolHandles = COMPETITOR_POOLS[network].map((s) => s.handle);
      for (const competitor of competitors) {
        expect(poolHandles).toContain(competitor.handle);
        expect(competitor.network).toBe(network);
        expect(competitor.avatarUrl).toBeDefined();
      }
      expect(new Set(competitors.map((c) => c.id)).size).toBe(3);
    }
  });

  it('el handle de un competidor JAMÁS deriva del email del cliente', () => {
    const competitors = buildCompetitorsMock(EPOCH, CLIENT, 'instagram', OWN_FOLLOWERS);
    for (const competitor of competitors) {
      expect(competitor.handle).not.toContain('colegiosnorte');
    }
  });

  it('followersSeries: 90 buckets diarios anclados al followers actual', () => {
    const competitors = buildCompetitorsMock(EPOCH, CLIENT, 'tiktok', OWN_FOLLOWERS);
    for (const competitor of competitors) {
      expect(competitor.followersSeries).toHaveLength(90);
      const last = competitor.followersSeries[89]!;
      expect(last.t).toBe(new Date(EPOCH).toISOString());
      // El último bucket queda cerca del followers actual (±5 %: ruido 1 % + redondeo).
      expect(Math.abs(last.v - competitor.followers) / competitor.followers).toBeLessThan(0.05);
    }
  });

  it('share of voice: enteros que suman 100 CON la cuenta propia (share propio > 0)', () => {
    for (const network of SOCIAL_NETWORKS) {
      const competitors = buildCompetitorsMock(EPOCH, CLIENT, network, OWN_FOLLOWERS);
      const competitorsSum = competitors.reduce((acc, c) => acc + c.shareOfVoicePct, 0);
      const ownShare = 100 - competitorsSum; // derivación de la UI (RFC-005 D5.2)
      expect(ownShare).toBeGreaterThan(0);
      for (const competitor of competitors) {
        expect(Number.isInteger(competitor.shareOfVoicePct)).toBe(true);
        expect(competitor.shareOfVoicePct).toBeGreaterThan(0);
      }
      expect(competitorsSum + ownShare).toBe(100);
    }
  });

  it('sentiment estático que suma 100', () => {
    const competitors = buildCompetitorsMock(EPOCH, CLIENT, 'facebook', OWN_FOLLOWERS);
    for (const { sentiment } of competitors) {
      expect(sentiment.positivePct + sentiment.neutralPct + sentiment.negativePct).toBe(100);
    }
  });

  it('topRecentPost incluido: caption ≤ 80 chars, últimos 30 días, ER precalculado', () => {
    for (const network of SOCIAL_NETWORKS) {
      const competitors = buildCompetitorsMock(EPOCH, CLIENT, network, OWN_FOLLOWERS);
      for (const { topRecentPost, topFormats } of competitors) {
        expect(topRecentPost.caption.length).toBeLessThanOrEqual(80);
        expect(topRecentPost.engagementRate).toBeGreaterThan(0);
        expect(topFormats).toContain(topRecentPost.format);
        const age = EPOCH - new Date(topRecentPost.publishedAt).getTime();
        expect(age).toBeGreaterThan(0);
        expect(age).toBeLessThanOrEqual(30 * 86_400_000);
      }
    }
  });
});

describe('buildBenchmarksMock — determinismo y contratos (D2/D7)', () => {
  const account = buildAccountMock(EPOCH, CLIENT, 'Colegios Norte', 'instagram');
  const competitors = buildCompetitorsMock(EPOCH, CLIENT, 'instagram', account.followers);
  const competitor = competitors[0]!;

  it('dos invocaciones idénticas → deep-equal', () => {
    const a = buildBenchmarksMock(EPOCH, CLIENT, account, competitor);
    const b = buildBenchmarksMock(EPOCH, CLIENT, account, competitor);
    expect(a).toEqual(b);
  });

  it('dos clientSeeds distintos → benchmarks distintos', () => {
    const otherAccount = buildAccountMock(EPOCH, OTHER, 'Otra Marca', 'instagram');
    const otherCompetitors = buildCompetitorsMock(EPOCH, OTHER, 'instagram', otherAccount.followers);
    const a = buildBenchmarksMock(EPOCH, CLIENT, account, competitor);
    const b = buildBenchmarksMock(EPOCH, OTHER, otherAccount, otherCompetitors[0]!);
    expect(a.map((x) => x.own)).not.toEqual(b.map((x) => x.own));
  });

  it('5-6 métricas por par, alineadas al vocabulario de la red', () => {
    for (const network of SOCIAL_NETWORKS) {
      const acc = buildAccountMock(EPOCH, CLIENT, 'Colegios Norte', network);
      const comp = buildCompetitorsMock(EPOCH, CLIENT, network, acc.followers)[0]!;
      const benchmarks = buildBenchmarksMock(EPOCH, CLIENT, acc, comp);
      expect(benchmarks.length).toBeGreaterThanOrEqual(5);
      expect(benchmarks.length).toBeLessThanOrEqual(6);
      expect(benchmarks.map((b) => b.metric)).toContain('followers');
      expect(benchmarks.map((b) => b.metric)).toContain('engagement-rate');
      for (const benchmark of benchmarks) {
        expect(benchmark.competitorId).toBe(comp.id);
      }
    }
    // Métricas propias de cada API en su red (contrato RFC-004/005).
    const tiktokAcc = buildAccountMock(EPOCH, CLIENT, 'Colegios Norte', 'tiktok');
    const tiktokComp = buildCompetitorsMock(EPOCH, CLIENT, 'tiktok', tiktokAcc.followers)[0]!;
    const tiktokMetrics = buildBenchmarksMock(EPOCH, CLIENT, tiktokAcc, tiktokComp).map(
      (b) => b.metric,
    );
    expect(tiktokMetrics).toContain('completion-rate');
    expect(tiktokMetrics).toContain('watch-time');
  });

  it('coherencia tabla ↔ panel: followers y ER del competidor son los de la entidad', () => {
    const benchmarks = buildBenchmarksMock(EPOCH, CLIENT, account, competitor);
    const followers = benchmarks.find((b) => b.metric === 'followers')!;
    expect(followers.own).toBe(account.followers);
    expect(followers.competitor).toBe(competitor.followers);
    const er = benchmarks.find((b) => b.metric === 'engagement-rate')!;
    expect(er.competitor).toBe(competitor.avgEngagementRate);
    expect(er.unit).toBe('%');
  });

  it('position/gapPct PRECOMPUTADOS y coherentes entre sí (nunca en el template)', () => {
    for (const comp of competitors) {
      for (const benchmark of buildBenchmarksMock(EPOCH, CLIENT, account, comp)) {
        const expectedGap =
          Math.round(((benchmark.own - benchmark.competitor) / benchmark.competitor) * 1000) / 10;
        expect(benchmark.gapPct).toBe(expectedGap);
        if (benchmark.gapPct > 2) {
          expect(benchmark.position).toBe('ahead');
        }
        if (benchmark.gapPct < -2) {
          expect(benchmark.position).toBe('behind');
        }
        if (Math.abs(benchmark.gapPct) <= 2) {
          expect(benchmark.position).toBe('even');
        }
      }
    }
  });

  it('los valores PROPIOS no cambian al cambiar de competidor seleccionado', () => {
    const versusFirst = buildBenchmarksMock(EPOCH, CLIENT, account, competitors[0]!);
    const versusSecond = buildBenchmarksMock(EPOCH, CLIENT, account, competitors[1]!);
    expect(versusFirst.map((b) => b.own)).toEqual(versusSecond.map((b) => b.own));
    // Y los del competidor sí (seed por par).
    expect(versusFirst.map((b) => b.competitor)).not.toEqual(
      versusSecond.map((b) => b.competitor),
    );
  });
});
