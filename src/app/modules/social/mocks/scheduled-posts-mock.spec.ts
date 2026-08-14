import { describe, expect, it } from 'vitest';

import { DEMO_ASSETS_BASE } from '../../../shared/constants/demo-assets';
import { SOCIAL_NETWORKS } from '../models/social.interface';
import { buildAccountMock } from './accounts-mock';
import { buildScheduledPostsMock } from './scheduled-posts-mock';

/**
 * Specs de RFC-002 plan §5 para `buildScheduledPostsMock`: determinismo,
 * scoping por clientSeed y los invariantes D2/D7/D10: backfill 10-12
 * cubriendo los 4 estados, ≥1 `failed` con `failureReason` accionable,
 * `scheduledFor` requerido (y futuro) si `scheduled`, sin cuentas → [].
 */

const EPOCH = Date.UTC(2026, 7, 14, 12, 0, 0);
const CLIENT = 'colegios.norte@fjuanxxiii.cl';
const OTHER = 'otra.marca@gmail.com';
const BRAND = 'Colegios Norte';

const accountsFor = (clientSeed: string) =>
  SOCIAL_NETWORKS.map((n) => buildAccountMock(EPOCH, clientSeed, BRAND, n));

describe('buildScheduledPostsMock — determinismo y scoping', () => {
  it('dos invocaciones idénticas → backfill deep-equal', () => {
    const accounts = accountsFor(CLIENT);
    const a = buildScheduledPostsMock(EPOCH, CLIENT, accounts);
    const b = buildScheduledPostsMock(EPOCH, CLIENT, accounts);
    expect(a).toEqual(b);
  });

  it('dos clientSeeds distintos → ids y contenidos distintos', () => {
    const a = buildScheduledPostsMock(EPOCH, CLIENT, accountsFor(CLIENT));
    const b = buildScheduledPostsMock(EPOCH, OTHER, accountsFor(OTHER));
    expect(a.map((p) => p.id)).not.toEqual(b.map((p) => p.id));
    expect(a.map((p) => p.updatedAt)).not.toEqual(b.map((p) => p.updatedAt));
  });

  it('sin cuentas conectadas → backfill vacío (D6: no hay dónde publicar)', () => {
    expect(buildScheduledPostsMock(EPOCH, CLIENT, [])).toEqual([]);
  });
});

describe('buildScheduledPostsMock — volúmenes y estados (D7/D10)', () => {
  const accounts = accountsFor(CLIENT);
  const posts = buildScheduledPostsMock(EPOCH, CLIENT, accounts);

  it('produce 10-12 posts cubriendo los CUATRO estados', () => {
    expect(posts.length).toBeGreaterThanOrEqual(10);
    expect(posts.length).toBeLessThanOrEqual(12);
    expect(new Set(posts.map((p) => p.status)).size).toBe(4);
  });

  it('≥1 failed con failureReason accionable (dice qué hacer, es-CL)', () => {
    const failed = posts.filter((p) => p.status === 'failed');
    expect(failed.length).toBeGreaterThanOrEqual(1);
    for (const post of failed) {
      expect(post.failureReason).toBeDefined();
      expect(post.failureReason).toMatch(/reintentá|reconectá/);
      expect(post.publishedAt).toBeUndefined();
    }
  });

  it('scheduled → scheduledFor requerido y FUTURO respecto del epoch', () => {
    const scheduled = posts.filter((p) => p.status === 'scheduled');
    expect(scheduled.length).toBeGreaterThanOrEqual(1);
    for (const post of scheduled) {
      expect(post.scheduledFor).toBeDefined();
      expect(new Date(post.scheduledFor!).getTime()).toBeGreaterThan(EPOCH);
      expect(post.publishedAt).toBeUndefined();
      expect(post.failureReason).toBeUndefined();
    }
  });

  it('published → publishedAt pasado y updatedAt = publishedAt', () => {
    const published = posts.filter((p) => p.status === 'published');
    expect(published.length).toBeGreaterThanOrEqual(1);
    for (const post of published) {
      expect(post.publishedAt).toBeDefined();
      expect(new Date(post.publishedAt!).getTime()).toBeLessThan(EPOCH);
      expect(post.updatedAt).toBe(post.publishedAt);
      expect(post.failureReason).toBeUndefined();
    }
  });

  it('draft → sin scheduledFor, sin publishedAt, sin failureReason', () => {
    const drafts = posts.filter((p) => p.status === 'draft');
    expect(drafts.length).toBeGreaterThanOrEqual(1);
    for (const post of drafts) {
      expect(post.scheduledFor).toBeUndefined();
      expect(post.publishedAt).toBeUndefined();
      expect(post.failureReason).toBeUndefined();
    }
  });
});

describe('buildScheduledPostsMock — shape del contrato (D2)', () => {
  const accounts = accountsFor(CLIENT);
  const posts = buildScheduledPostsMock(EPOCH, CLIENT, accounts);
  const accountIds = new Set(accounts.map((a) => a.id));

  it('accountIds apuntan SOLO a cuentas conectadas reales (1 o 2 por post)', () => {
    for (const post of posts) {
      expect(post.accountIds.length).toBeGreaterThanOrEqual(1);
      expect(post.accountIds.length).toBeLessThanOrEqual(2);
      for (const id of post.accountIds) {
        expect(accountIds.has(id)).toBe(true);
      }
    }
  });

  it('hashtags materializados CON "#" y caption es-CL no vacía', () => {
    for (const post of posts) {
      expect(post.caption.length).toBeGreaterThan(0);
      expect(post.hashtags.length).toBeGreaterThanOrEqual(2);
      for (const tag of post.hashtags) {
        expect(tag.startsWith('#')).toBe(true);
      }
    }
  });

  it('mediaUrls vía demoAsset: text sin media, carousel con 2, resto con 1', () => {
    for (const post of posts) {
      if (post.format === 'text') {
        expect(post.mediaUrls).toHaveLength(0);
        continue;
      }
      expect(post.mediaUrls.length).toBe(post.format === 'carousel' ? 2 : 1);
      for (const url of post.mediaUrls) {
        expect(url.startsWith(DEMO_ASSETS_BASE)).toBe(true);
      }
    }
  });

  it('timestamps derivados del epoch y coherentes: createdAt ≤ updatedAt, ambos pasados', () => {
    for (const post of posts) {
      const created = new Date(post.createdAt).getTime();
      const updated = new Date(post.updatedAt).getTime();
      expect(created).toBeLessThanOrEqual(updated);
      expect(updated).toBeLessThan(EPOCH);
      expect(created).toBeGreaterThan(EPOCH - 40 * 86_400_000);
    }
  });

  it('el backfill no trae sourceJobId (la trazabilidad nace de "Usar en planner")', () => {
    for (const post of posts) {
      expect(post.sourceJobId).toBeUndefined();
    }
  });
});
