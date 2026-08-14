import { describe, expect, it } from 'vitest';

import { SOCIAL_NETWORKS } from '../models/social.interface';
import {
  CITY_POOL,
  clientHash,
  COMPETITOR_POOLS,
  dailySeries,
  HASHTAG_POOL,
} from './social-mock-utils';

/**
 * Specs de RFC-002 plan §4: determinismo de `dailySeries` (mismo seed →
 * misma serie), estacionalidad de fin de semana presente, 90 buckets.
 * Todo es puro — sin TestBed, sin reloj real: el epoch se fija acá.
 */

// Ancla fija arbitraria (mediodía UTC para esquivar bordes de día en
// cualquier timezone del runner) — el determinismo no depende del valor.
const EPOCH = Date.UTC(2026, 7, 14, 12, 0, 0);

describe('dailySeries', () => {
  it('produce SIEMPRE 90 buckets diarios', () => {
    const serie = dailySeries(EPOCH, 'spec:len', 100, 1, 0.1);
    expect(serie).toHaveLength(90);
  });

  it('mismo epoch + mismo seed → serie idéntica (deep-equal)', () => {
    const a = dailySeries(EPOCH, 'spec:same', 500, 2, 0.15);
    const b = dailySeries(EPOCH, 'spec:same', 500, 2, 0.15);
    expect(a).toEqual(b);
  });

  it('seeds distintos → series distintas (el ruido es seeded, no fijo)', () => {
    const a = dailySeries(EPOCH, 'spec:seed-a', 500, 2, 0.15);
    const b = dailySeries(EPOCH, 'spec:seed-b', 500, 2, 0.15);
    expect(a).not.toEqual(b);
  });

  it('buckets ordenados del más viejo al más nuevo, el último anclado al epoch', () => {
    const serie = dailySeries(EPOCH, 'spec:order', 100, 0, 0);
    const times = serie.map((p) => new Date(p.t).getTime());
    const sorted = [...times].sort((x, y) => x - y);
    expect(times).toEqual(sorted);
    expect(serie[serie.length - 1]?.t).toBe(new Date(EPOCH).toISOString());
    // Buckets consecutivos separados exactamente 24 h.
    expect(times[1]! - times[0]!).toBe(86_400_000);
  });

  it('aplica weekendFactor 1.25 default a sáb/dom (estacionalidad presente)', () => {
    // Sin ruido ni tendencia, el valor de cada bucket depende SOLO de si
    // su fecha cae en fin de semana — verificable punto a punto releyendo
    // el día desde el propio `t` (robusto ante el timezone del runner).
    const base = 400;
    const serie = dailySeries(EPOCH, 'spec:weekend', base, 0, 0);
    const isWeekend = (t: string): boolean => {
      const day = new Date(t).getDay();
      return day === 0 || day === 6;
    };
    for (const p of serie) {
      expect(p.v).toBe(isWeekend(p.t) ? Math.round(base * 1.25) : base);
    }
    // 90 días garantizan ambos tipos de bucket — el branch no es dead code.
    expect(serie.some((p) => isWeekend(p.t))).toBe(true);
    expect(serie.some((p) => !isWeekend(p.t))).toBe(true);
  });

  it('weekendFactor < 1 deprime el finde (perfil FB corporativo)', () => {
    const base = 400;
    const serie = dailySeries(EPOCH, 'spec:weekend-fb', base, 0, 0, 0.8);
    const weekend = serie.filter((p) => {
      const day = new Date(p.t).getDay();
      return day === 0 || day === 6;
    });
    expect(weekend.length).toBeGreaterThan(0);
    for (const p of weekend) {
      expect(p.v).toBeLessThan(base);
    }
  });

  it('la tendencia lineal sube la serie a lo largo de los 90 días', () => {
    const serie = dailySeries(EPOCH, 'spec:trend', 100, 5, 0);
    // Comparar dos días de semana (sin factor finde) alejados entre sí.
    const weekdays = serie.filter((p) => {
      const day = new Date(p.t).getDay();
      return day !== 0 && day !== 6;
    });
    expect(weekdays[weekdays.length - 1]!.v).toBeGreaterThan(weekdays[0]!.v);
  });
});

describe('clientHash', () => {
  it('es estable: mismo clientSeed → mismo hash', () => {
    expect(clientHash('colegios.norte@fjuanxxiii.cl')).toBe(
      clientHash('colegios.norte@fjuanxxiii.cl'),
    );
  });

  it('clientSeeds distintos → hashes distintos', () => {
    const seeds = [
      'colegios.norte@fjuanxxiii.cl',
      'otra.marca@gmail.com',
      'demo@showcase',
      'ferreteria@sur.cl',
    ];
    const hashes = seeds.map(clientHash);
    expect(new Set(hashes).size).toBe(seeds.length);
  });

  it('emite base36 seguro para ids y keys de storage', () => {
    expect(clientHash('colegios.norte@fjuanxxiii.cl')).toMatch(/^[0-9a-z]+$/);
  });
});

describe('pools es-CL de terceros', () => {
  it('cada red tiene al menos 3 competidores curados (D7)', () => {
    for (const network of SOCIAL_NETWORKS) {
      expect(COMPETITOR_POOLS[network].length).toBeGreaterThanOrEqual(3);
    }
  });

  it('los handles de competidores empiezan con @ y están saneados', () => {
    for (const network of SOCIAL_NETWORKS) {
      for (const seed of COMPETITOR_POOLS[network]) {
        expect(seed.handle).toMatch(/^@[a-z0-9._-]+$/);
        expect(seed.name.length).toBeGreaterThan(0);
      }
    }
  });

  it('hashtags SIN "#" (forma canónica de HashtagSuggestion.tag) e incluye el rubro pyme', () => {
    for (const tag of HASHTAG_POOL) {
      expect(tag).not.toContain('#');
    }
    expect(HASHTAG_POOL).toContain('pymechile');
  });

  it('las ciudades curadas del RFC están presentes', () => {
    for (const city of ['Santiago', 'Valparaíso', 'Concepción', 'Temuco']) {
      expect(CITY_POOL).toContain(city);
    }
  });
});
