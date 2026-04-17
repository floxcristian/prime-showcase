import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import compression from 'compression';
import express from 'express';
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
 * set `NG_ALLOWED_HOSTS=*`.
 *
 * Ref: https://angular.dev/best-practices/security#preventing-server-side-request-forgery-ssrf
 */
const angularApp = new AngularNodeAppEngine({
  allowedHosts: ['localhost', '127.0.0.1'],
});

/**
 * Compression and security middleware
 */
app.use(compression());

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
 */
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        fontSrc: ["'self'", 'data:'],
        connectSrc: ["'self'", 'ws:'],
        workerSrc: ["'self'", 'blob:'],
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
 * Static assets already get 1-year cache from express.static above.
 */
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.includes('.')) {
    res.set('Cache-Control', 'public, max-age=3600, s-maxage=86400');
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
  const port = process.env['PORT'] || 4000;
  app.listen(port, () => {
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
