import { describe, expect, it } from 'vitest';

import { DEMO_ASSETS_BASE } from '../../../shared/constants/demo-assets';
import { buildGenerationJobsMock } from './generation-jobs-mock';

/**
 * Specs de RFC-002 plan §5 para `buildGenerationJobsMock`: determinismo,
 * scoping por clientSeed y los invariantes D2/D7/D9: 4-6 jobs históricos
 * (solo estados terminales), caption succeeded con SIEMPRE 3
 * `resultVariants`, assets vía `demoAsset(...)`, costo estimado presente.
 */

const EPOCH = Date.UTC(2026, 7, 14, 12, 0, 0);
const CLIENT = 'colegios.norte@fjuanxxiii.cl';
const OTHER = 'otra.marca@gmail.com';

describe('buildGenerationJobsMock — determinismo y scoping', () => {
  it('dos invocaciones idénticas → historial deep-equal', () => {
    const a = buildGenerationJobsMock(EPOCH, CLIENT);
    const b = buildGenerationJobsMock(EPOCH, CLIENT);
    expect(a).toEqual(b);
  });

  it('dos clientSeeds distintos → ids y timestamps distintos', () => {
    const a = buildGenerationJobsMock(EPOCH, CLIENT);
    const b = buildGenerationJobsMock(EPOCH, OTHER);
    expect(a.map((j) => j.id)).not.toEqual(b.map((j) => j.id));
    expect(a.map((j) => j.createdAt)).not.toEqual(b.map((j) => j.createdAt));
  });
});

describe('buildGenerationJobsMock — volúmenes y estados (D7/D9)', () => {
  const jobs = buildGenerationJobsMock(EPOCH, CLIENT);

  it('produce 4-6 jobs históricos, SOLO estados terminales, sin progressPct', () => {
    expect(jobs.length).toBeGreaterThanOrEqual(4);
    expect(jobs.length).toBeLessThanOrEqual(6);
    for (const job of jobs) {
      expect(['succeeded', 'failed']).toContain(job.status);
      expect(job.progressPct).toBeUndefined();
    }
  });

  it('cubre los tres kinds (caption/image/video) y ≥1 failed', () => {
    expect(new Set(jobs.map((j) => j.kind)).size).toBe(3);
    const failed = jobs.filter((j) => j.status === 'failed');
    expect(failed.length).toBeGreaterThanOrEqual(1);
    for (const job of failed) {
      expect(job.failureReason).toBeDefined();
      expect(job.failureReason!.length).toBeGreaterThan(10);
      expect(job.resultVariants).toBeUndefined();
      expect(job.resultUrls).toBeUndefined();
    }
  });

  it('caption succeeded → SIEMPRE exactamente 3 resultVariants es-CL (contrato D2)', () => {
    const captions = jobs.filter((j) => j.kind === 'caption' && j.status === 'succeeded');
    expect(captions.length).toBeGreaterThanOrEqual(1);
    for (const job of captions) {
      expect(job.resultVariants).toHaveLength(3);
      expect(job.resultUrls).toBeUndefined();
      for (const variant of job.resultVariants!) {
        expect(variant.length).toBeGreaterThan(20);
      }
    }
  });

  it('image succeeded → 4 resultUrls; video succeeded → 1 (D9), todos demoAsset', () => {
    for (const job of jobs) {
      if (job.status !== 'succeeded' || job.kind === 'caption') {
        continue;
      }
      expect(job.resultUrls).toHaveLength(job.kind === 'image' ? 4 : 1);
      for (const url of job.resultUrls!) {
        expect(url.startsWith(DEMO_ASSETS_BASE)).toBe(true);
      }
      expect(job.resultVariants).toBeUndefined();
    }
  });
});

describe('buildGenerationJobsMock — shape del contrato (D2)', () => {
  const jobs = buildGenerationJobsMock(EPOCH, CLIENT);

  it('request espeja el job: kind, providerId y prompt idénticos', () => {
    for (const job of jobs) {
      expect(job.request.kind).toBe(job.kind);
      expect(job.request.providerId).toBe(job.providerId);
      expect(job.request.prompt).toBe(job.prompt);
    }
  });

  it('los video jobs declaran durationSeconds en las options del request', () => {
    const videos = jobs.filter((j) => j.kind === 'video');
    expect(videos.length).toBeGreaterThanOrEqual(1);
    for (const job of videos) {
      expect(job.request.options.durationSeconds).toBeDefined();
      expect(job.request.options.aspectRatio).toBeDefined();
    }
  });

  it('costEstimateUsd presente y positivo (tabla por provider ± jitter, D9)', () => {
    for (const job of jobs) {
      expect(job.costEstimateUsd).toBeDefined();
      expect(job.costEstimateUsd!).toBeGreaterThan(0);
      expect(job.costEstimateUsd!).toBeLessThan(1);
    }
  });

  it('timestamps derivados del epoch: createdAt < completedAt < epoch, historial de nuevo a viejo', () => {
    let previousCreated = Number.POSITIVE_INFINITY;
    for (const job of jobs) {
      const created = new Date(job.createdAt).getTime();
      const completed = new Date(job.completedAt!).getTime();
      expect(created).toBeLessThan(completed);
      expect(completed).toBeLessThan(EPOCH);
      // El primer job es el más reciente; cada siguiente es más viejo.
      expect(created).toBeLessThan(previousCreated);
      expect(created).toBeGreaterThan(EPOCH - 12 * 86_400_000);
      previousCreated = created;
    }
  });
});
