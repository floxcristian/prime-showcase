import { seededRandom } from '../../../shared/utils/mock-utils';
import type { AnalyticsConnectorId } from '../models/provider.interface';
import type { SocialAccount, SocialNetwork } from '../models/social.interface';
import { clientHash } from './social-mock-utils';

/**
 * Factory PURA de la cuenta social DEL CLIENTE autenticado (RFC-002 D6 /
 * RFC-003 D4.3). Sin Angular ni side effects — importable desde el harness
 * de Playwright (`tests/fixtures/social-seed.ts`, RFC-001 D7), requisito
 * de diseño de RFC-002 criterios.
 *
 * **Cero cuentas hardcodeadas:** la identidad se DERIVA del email
 * (`clientSeed`) — jamás sale de un pool. `handle = '@' + localPart`
 * saneado (`colegios.norte@…` → `@colegiosnorte`); `displayName` es el
 * brandName del signup (fallback: localPart capitalizado). El `id` incluye
 * `clientHash(clientSeed)` y NO depende de `epoch`: reconectar tras
 * desconectar reproduce la MISMA cuenta ("reconectaste tu cuenta", no
 * "apareció otra").
 *
 * **Determinismo:** followers/following/postsCount salen de
 * `seededRandom(`${clientSeed}:acct:${network}`)` en rangos realistas por
 * red; timestamps derivados de `epoch` (`connectedAt = lastSyncAt = epoch
 * ISO`) — cero reloj real. El `status` efectivo (`expired` por TTL, `error`
 * determinista) lo computa `SocialSettingsService` EN LECTURA (D6): la
 * factory siempre entrega la cuenta recién conectada, limpia.
 */

/** Mapeo red → provider del catálogo que la alimenta (D3). */
const NETWORK_CONNECTOR: Readonly<Record<SocialNetwork, AnalyticsConnectorId>> = {
  instagram: 'instagram-graph',
  facebook: 'facebook-graph',
  tiktok: 'tiktok-api',
};

/** Rangos realistas por red para una pyme chilena (D6: "rangos realistas
 *  por red" — valores concretos a criterio de la factory). */
const ACCOUNT_RANGES: Readonly<
  Record<
    SocialNetwork,
    {
      readonly followers: readonly [number, number];
      readonly following: readonly [number, number];
      readonly posts: readonly [number, number];
    }
  >
> = {
  instagram: { followers: [2500, 18000], following: [300, 1200], posts: [120, 600] },
  facebook: { followers: [1500, 12000], following: [50, 400], posts: [200, 900] },
  tiktok: { followers: [1000, 25000], following: [80, 500], posts: [40, 250] },
};

/** Entero determinista en `[min, max]` desde el PRNG seedeado. */
const intBetween = (rand: () => number, range: readonly [number, number]): number =>
  range[0] + Math.floor(rand() * (range[1] - range[0] + 1));

/** Parte local del email saneada a `[a-z0-9]`: `colegios.norte@…` →
 *  `colegiosnorte`. Fallback defensivo si el saneo vacía el string. */
const localPart = (clientSeed: string): string => {
  const raw = clientSeed.trim().toLowerCase().split('@')[0] ?? '';
  const sane = raw.replace(/[^a-z0-9]/g, '');
  return sane.length > 0 ? sane : 'cliente';
};

/** `colegiosnorte` → `Colegiosnorte` — fallback de displayName (RFC-003 D4.3). */
const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Construye la cuenta determinista del cliente para `network`. La llama
 * `SocialSettingsService.connectAccount` (el "OAuth" simulado, D4) y el
 * seed de fixtures de Playwright.
 */
export const buildAccountMock = (
  epoch: number,
  clientSeed: string,
  brandName: string,
  network: SocialNetwork,
): SocialAccount => {
  // El orden de extracción del PRNG es parte del contrato de determinismo:
  // followers → following → postsCount, siempre.
  const rand = seededRandom(`${clientSeed}:acct:${network}`);
  const ranges = ACCOUNT_RANGES[network];
  const followers = intBetween(rand, ranges.followers);
  const following = intBetween(rand, ranges.following);
  const postsCount = intBetween(rand, ranges.posts);

  const local = localPart(clientSeed);
  const trimmedBrand = brandName.trim();
  const connectedAt = new Date(epoch).toISOString();

  return {
    id: `acc-${network}-${clientHash(clientSeed)}`,
    network,
    handle: `@${local}`,
    displayName: trimmedBrand.length > 0 ? trimmedBrand : capitalize(local),
    status: 'connected',
    followers,
    following,
    postsCount,
    connectedAt,
    lastSyncAt: connectedAt,
    connectorId: NETWORK_CONNECTOR[network],
  };
};
