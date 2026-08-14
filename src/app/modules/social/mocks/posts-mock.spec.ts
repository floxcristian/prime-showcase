import { describe, expect, it } from 'vitest';

import { DEMO_ASSETS_BASE } from '../../../shared/constants/demo-assets';
import { SOCIAL_NETWORKS } from '../models/social.interface';
import { buildPostsMock } from './posts-mock';

/**
 * Specs de RFC-002 plan §5 para `buildPostsMock`: determinismo (dos
 * invocaciones idénticas → deep-equal), scoping (dos clientSeeds → datos
 * distintos) y los contratos de D2/D7: 12-18 posts, `engagementRate`
 * precalculado, campos de video solo en video/reel, `reactions` solo en
 * facebook, timestamps derivados únicamente de `epoch`.
 */

const EPOCH = Date.UTC(2026, 7, 14, 12, 0, 0);
const CLIENT = 'colegios.norte@fjuanxxiii.cl';
const OTHER = 'otra.marca@gmail.com';
const ACC_IG = 'acc-instagram-x1';
const ACC_FB = 'acc-facebook-x1';
const ACC_TT = 'acc-tiktok-x1';

describe('buildPostsMock — determinismo y scoping', () => {
  it('dos invocaciones idénticas → deep-equal', () => {
    const a = buildPostsMock(EPOCH, CLIENT, ACC_IG, 'instagram');
    const b = buildPostsMock(EPOCH, CLIENT, ACC_IG, 'instagram');
    expect(a).toEqual(b);
  });

  it('dos clientSeeds distintos → posts distintos (aislamiento por cliente)', () => {
    const a = buildPostsMock(EPOCH, CLIENT, ACC_IG, 'instagram');
    const b = buildPostsMock(EPOCH, OTHER, ACC_IG, 'instagram');
    expect(a).not.toEqual(b);
  });

  it('cuentas distintas del mismo cliente → posts distintos (seed incluye accountId)', () => {
    const a = buildPostsMock(EPOCH, CLIENT, ACC_IG, 'instagram');
    const b = buildPostsMock(EPOCH, CLIENT, 'acc-instagram-otro', 'instagram');
    expect(a.map((p) => p.metrics.reach)).not.toEqual(b.map((p) => p.metrics.reach));
  });

  it('mover el epoch desplaza los timestamps pero NO cambia métricas ni contenido', () => {
    const a = buildPostsMock(EPOCH, CLIENT, ACC_FB, 'facebook');
    const b = buildPostsMock(EPOCH + 3_600_000, CLIENT, ACC_FB, 'facebook');
    expect(b.map((p) => p.id)).toEqual(a.map((p) => p.id));
    expect(b.map((p) => p.metrics)).toEqual(a.map((p) => p.metrics));
    expect(b.map((p) => p.caption)).toEqual(a.map((p) => p.caption));
    for (let i = 0; i < a.length; i++) {
      expect(
        new Date(b[i]!.publishedAt).getTime() - new Date(a[i]!.publishedAt).getTime(),
      ).toBe(3_600_000);
    }
  });
});

describe('buildPostsMock — volúmenes y shape (D7)', () => {
  it('genera 12-18 posts por cuenta, con id prefijado por accountId', () => {
    for (const [accountId, network] of [
      [ACC_IG, 'instagram'],
      [ACC_FB, 'facebook'],
      [ACC_TT, 'tiktok'],
    ] as const) {
      const posts = buildPostsMock(EPOCH, CLIENT, accountId, network);
      expect(posts.length).toBeGreaterThanOrEqual(12);
      expect(posts.length).toBeLessThanOrEqual(18);
      for (const post of posts) {
        expect(post.id.startsWith(`${accountId}-post-`)).toBe(true);
        expect(post.accountId).toBe(accountId);
        expect(post.network).toBe(network);
        expect(post.permalink).toBe('#');
      }
      // Ids únicos dentro de la cuenta.
      expect(new Set(posts.map((p) => p.id)).size).toBe(posts.length);
    }
  });

  it('publishedAt: estrictamente descendente (más nuevo primero) y nunca futuro', () => {
    for (const network of SOCIAL_NETWORKS) {
      const posts = buildPostsMock(EPOCH, CLIENT, `acc-${network}-x1`, network);
      const times = posts.map((p) => new Date(p.publishedAt).getTime());
      for (let i = 1; i < times.length; i++) {
        expect(times[i]!).toBeLessThan(times[i - 1]!);
      }
      expect(Math.max(...times)).toBeLessThanOrEqual(EPOCH);
    }
  });

  it('hashtags: 2-4 por post, siempre con "#" antepuesto al materializar', () => {
    const posts = buildPostsMock(EPOCH, CLIENT, ACC_IG, 'instagram');
    for (const post of posts) {
      expect(post.hashtags.length).toBeGreaterThanOrEqual(2);
      expect(post.hashtags.length).toBeLessThanOrEqual(4);
      for (const tag of post.hashtags) {
        expect(tag).toMatch(/^#[a-z0-9]+$/);
      }
    }
  });

  it('thumbnails vía demoAsset(...) — presentes salvo en format text', () => {
    for (const network of SOCIAL_NETWORKS) {
      const posts = buildPostsMock(EPOCH, CLIENT, `acc-${network}-x1`, network);
      for (const post of posts) {
        if (post.format === 'text') {
          expect(post.thumbnailUrl).toBeUndefined();
        } else {
          expect(post.thumbnailUrl?.startsWith(DEMO_ASSETS_BASE)).toBe(true);
        }
      }
    }
  });

  it('tiktok publica exclusivamente video', () => {
    const posts = buildPostsMock(EPOCH, CLIENT, ACC_TT, 'tiktok');
    for (const post of posts) {
      expect(post.format).toBe('video');
    }
  });
});

describe('buildPostsMock — métricas precalculadas (D2)', () => {
  it('engagementRate PRECALCULADO = (likes+comments+shares+saves)/reach × 100', () => {
    for (const network of SOCIAL_NETWORKS) {
      const posts = buildPostsMock(EPOCH, CLIENT, `acc-${network}-x1`, network);
      for (const { metrics } of posts) {
        const expected =
          Math.round(
            ((metrics.likes + metrics.comments + metrics.shares + metrics.saves) /
              metrics.reach) *
              1000,
          ) / 10;
        expect(metrics.engagementRate).toBe(expected);
        expect(metrics.reach).toBeLessThanOrEqual(metrics.impressions);
      }
    }
  });

  it('campos de video SOLO en formats video/reel — undefined en el resto', () => {
    for (const network of SOCIAL_NETWORKS) {
      const posts = buildPostsMock(EPOCH, CLIENT, `acc-${network}-x1`, network);
      for (const post of posts) {
        const isVideo = post.format === 'video' || post.format === 'reel';
        if (isVideo) {
          expect(post.metrics.videoViews).toBeGreaterThan(0);
          expect(post.metrics.avgWatchTimeSec).toBeGreaterThan(0);
          expect(post.metrics.completionRatePct).toBeGreaterThan(0);
          expect(post.metrics.completionRatePct).toBeLessThanOrEqual(100);
        } else {
          expect(post.metrics.videoViews).toBeUndefined();
          expect(post.metrics.avgWatchTimeSec).toBeUndefined();
          expect(post.metrics.completionRatePct).toBeUndefined();
        }
      }
    }
    // El branch de video no es dead code: tiktok es 100 % video.
    const tiktok = buildPostsMock(EPOCH, CLIENT, ACC_TT, 'tiktok');
    expect(tiktok.every((p) => p.metrics.videoViews !== undefined)).toBe(true);
  });

  it('reactions SOLO en network facebook — los 6 tipos Graph en orden fijo (RFC-004 D6)', () => {
    const facebook = buildPostsMock(EPOCH, CLIENT, ACC_FB, 'facebook');
    for (const post of facebook) {
      expect(post.metrics.reactions?.map((r) => r.type)).toEqual([
        'like',
        'love',
        'haha',
        'wow',
        'sad',
        'angry',
      ]);
      for (const reaction of post.metrics.reactions ?? []) {
        expect(reaction.count).toBeGreaterThanOrEqual(0);
      }
    }

    for (const network of ['instagram', 'tiktok'] as const) {
      const posts = buildPostsMock(EPOCH, CLIENT, `acc-${network}-x1`, network);
      for (const post of posts) {
        expect(post.metrics.reactions).toBeUndefined();
      }
    }
  });
});
