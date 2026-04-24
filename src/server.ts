import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import compression from 'compression';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');

const app = express();

/**
 * SSRF protection — Angular 21 SSR validates the Host / X-Forwarded-Host headers
 * against `allowedHosts`. If the list is empty, every request falls back to CSR
 * (serves the unrendered `index.csr.html`). In a future major this becomes a 400.
 *
 * Production: set `NG_ALLOWED_HOSTS="app.example.com,www.example.com"` via env.
 * Development: we allow localhost/127.0.0.1 so `npm run start` and the SSR server
 *              both work out-of-the-box. The env var value is merged on top.
 *
 * When deployed behind a trusted LB/reverse proxy that already validates Host,
 * set `NG_ALLOWED_HOSTS=*` — we detect it and pass the wildcard through.
 *
 * Ref: https://angular.dev/best-practices/security#preventing-server-side-request-forgery-ssrf
 */
const DEV_ALLOWED_HOSTS = ['localhost', '127.0.0.1'];
const allowedHosts = ((): string[] => {
  const raw = process.env['NG_ALLOWED_HOSTS']?.trim();
  if (!raw) return DEV_ALLOWED_HOSTS;
  // Wildcard: trust upstream host validation (LB / reverse proxy). Vite &
  // angular-ssr treat `['*']` as "any host". Dev hosts are not merged in
  // because the wildcard already covers them.
  if (raw === '*') return ['*'];
  const configured = raw
    .split(',')
    .map(host => host.trim())
    .filter(Boolean);
  // Merge dev hosts so localhost still works when an env override is set —
  // otherwise a misconfigured deploy would kill local SSR e2e runs.
  return Array.from(new Set([...DEV_ALLOWED_HOSTS, ...configured]));
})();
const angularApp = new AngularNodeAppEngine({ allowedHosts });

/**
 * Trust proxy — Express necesita este flag cuando se despliega tras un LB /
 * CDN (Cloudflare, Fastly, nginx, AWS ALB). Sin `trust proxy`, `req.ip` es la
 * IP del LB → todos los usuarios parecen el mismo → rate-limiter bloquea a
 * todos al llegar al primer límite. Con `trust proxy: 1` Express lee
 * `X-Forwarded-For` (el último hop) que inyecta el LB con la IP real del
 * cliente. Value `1` = trust 1 hop (el LB inmediato); nunca usar `true` sin
 * LB conocido (riesgo de IP spoofing).
 * Ref: https://expressjs.com/en/guide/behind-proxies.html
 */
app.set('trust proxy', 1);

/**
 * Compression and security middleware
 */
app.use(compression());

/**
 * Rate limiting — defensa de profundidad contra flood de requests (DoS, brute
 * force login, scraping). Generoso para SSR: una carga de página típica
 * dispara ~10-50 requests (document + chunks + fonts + images + hydration).
 * 300/minuto permite ~6 page-loads/min por IP antes de throttle — muy por
 * encima del uso humano real. Para APIs propias (cuando haya backend) crear
 * un limiter específico `/api/*` con 30/min y retornar 429 + Retry-After.
 *
 * **Cuando desactivar:** si hay LB/CDN que ya rate-limita (Cloudflare, AWS
 * WAF, Fastly), este limiter es redundant. Mantenerlo como defense-in-depth
 * es barato (~5μs por request) y protege si el LB falla.
 *
 * `standardHeaders: 'draft-8'` emite `RateLimit` + `RateLimit-Policy` headers
 * per IETF draft (https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-ratelimit-headers)
 * — legibles por clients automatizados. `legacyHeaders: false` apaga los
 * antiguos `X-RateLimit-*` que no están estandarizados.
 *
 * `keyGenerator`: por defecto usa `req.ip` (ya corregido vía trust proxy).
 * IPv6 normalization con `ipKeyGenerator` para prevenir bypass de rate limit
 * vía sub-prefixes IPv6 (cada usuario tiene /64 rango en ISP típico).
 */
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

/**
 * CSP (Content Security Policy) via Helmet.
 *
 * Uses 'unsafe-inline' for both script-src and style-src because:
 * - PrimeNG injects theme styles dynamically at runtime via its useStyle system,
 *   which does not support per-request nonces.
 * - Angular's event replay (withEventReplay) injects an inline jsaction bootstrap
 *   script during SSR that does not receive the ngCspNonce attribute.
 *
 * This is the standard approach used by production Angular apps (including Google's
 * own properties). The CSP still provides meaningful protection via:
 * - default-src 'self' — blocks unauthorized resource loading
 * - img-src, font-src, connect-src — restricts asset origins
 * - frame-ancestors 'self' — prevents clickjacking
 * - object-src 'none' — blocks Flash/Java embeds
 *
 * When PrimeNG and Angular SSR add full nonce support, migrate to nonce-based CSP
 * by generating per-request nonces and injecting via ngCspNonce attribute.
 *
 * `connect-src`:
 * - Production / unset / anything-not-development: HTTPS-only connections via
 *   `'self'` + `wss:` for secure WebSockets (e.g. live data streams). Plaintext
 *   `ws:` is rejected so a compromised script can't downgrade a real-time
 *   channel on an HTTPS page.
 * - Development: adds plaintext `ws:` for Angular CLI HMR and Vite-style dev
 *   servers which speak `ws://localhost:…`.
 *
 * Polarity note: the check is `=== 'development'`, not `!== 'production'`. A
 * misconfigured deploy where NODE_ENV is unset or reads `staging` must fail
 * CLOSED (strict CSP), not open (permissive dev CSP leaking plaintext `ws:`).
 *
 * `frame-ancestors 'none'`: this is a pure SPA, it's never framed by anything.
 * Setting `'none'` blocks both third-party and self-framing clickjacking.
 */
const isDev = process.env['NODE_ENV'] === 'development';
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        fontSrc: ["'self'", 'data:'],
        connectSrc: ["'self'", 'wss:', ...(isDev ? ['ws:'] : [])],
        workerSrc: ["'self'", 'blob:'],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Cache-control for HTML documents (non-static routes).
 *
 * `Vary: Cookie` is required because SSR personalizes the response based on
 * the `theme` cookie (see app-config.service.ts / ADR-001 §4): without it, a
 * shared cache would serve a dark-rendered page to a light-theme user. We
 * keep `public` + `s-maxage` so CDNs still cache per-cookie-variant, which is
 * acceptable while `theme` is the only personalization dimension. When more
 * per-user state is added, migrate to `private` + strip cookies at the edge.
 *
 * Static assets already get 1-year cache from express.static above.
 */
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.includes('.')) {
    res.set('Cache-Control', 'public, max-age=3600, s-maxage=86400');
    res.set('Vary', 'Cookie');
  }
  next();
});

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use('/{*path}', (req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point.
 */
if (isMainModule(import.meta.url)) {
  const port = process.env['PORT'] ?? 4000;
  app.listen(port, () => {
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
