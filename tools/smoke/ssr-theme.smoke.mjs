#!/usr/bin/env node
/**
 * SSR theme smoke test — end-to-end verification that the cookie contract
 * survives the full request pipeline (Express → Angular engine → REQUEST
 * token → AppConfigService → document class → serialized HTML).
 *
 * Not part of the default `npm test`: it requires the production SSR server
 * to be running so there is no build orchestration to worry about. Invoke
 * via `npm run test:ssr:smoke` after `npm run build && npm run serve:ssr:*`.
 *
 * Rationale for keeping this separate from Vitest:
 *   - Vitest suites must run in every CI pass and must not depend on a live
 *     server. Booting the SSR server inside a test would couple suite time
 *     to `ng build` (minutes, not ms) and introduce port-conflict flakes.
 *   - A standalone smoke script is portable: CI pipelines run it as a stage
 *     after deploy-to-preview; developers run it after local build. Same
 *     code, two call sites.
 *
 * Ref: ADR-001 §4 (cookie-based SSR theming).
 */

const BASE_URL = process.env.SSR_BASE_URL ?? 'http://localhost:4000';
const TIMEOUT_MS = 10_000;

const cases = [
  {
    name: 'no cookie → no p-dark class in <html>',
    cookie: null,
    expectedClassOnHtml: false,
  },
  {
    name: 'theme=dark → <html class="p-dark">',
    cookie: 'theme=dark',
    expectedClassOnHtml: true,
  },
  {
    name: 'theme=light → no p-dark class',
    cookie: 'theme=light',
    expectedClassOnHtml: false,
  },
  {
    name: 'theme=invalid → no p-dark class (fallback to light)',
    cookie: 'theme=solarized',
    expectedClassOnHtml: false,
  },
];

/**
 * Regex that matches the opening <html ...> tag and captures its class list.
 * Angular may emit attributes in any order, so we don't anchor class to a
 * fixed position — we search for `class="..."` inside the tag's attributes.
 */
const HTML_TAG_REGEX = /<html\b[^>]*>/i;
const CLASS_ATTR_REGEX = /\bclass="([^"]*)"/;

async function fetchWithTimeout(url, init) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function extractHtmlTagClasses(body) {
  const tagMatch = HTML_TAG_REGEX.exec(body);
  if (!tagMatch) throw new Error('Response has no <html> tag — SSR not running?');
  const classMatch = CLASS_ATTR_REGEX.exec(tagMatch[0]);
  return classMatch ? classMatch[1] : '';
}

async function runCase({ name, cookie, expectedClassOnHtml }) {
  const headers = {};
  if (cookie) headers.cookie = cookie;

  const response = await fetchWithTimeout(`${BASE_URL}/`, { headers });
  if (!response.ok) {
    throw new Error(`${name}: HTTP ${response.status} ${response.statusText}`);
  }

  const body = await response.text();
  const classes = extractHtmlTagClasses(body);
  const hasDark = classes.split(/\s+/).includes('p-dark');

  if (hasDark !== expectedClassOnHtml) {
    throw new Error(
      `${name}: expected p-dark=${expectedClassOnHtml}, got p-dark=${hasDark} (class="${classes}")`,
    );
  }

  // Vary: Cookie is non-negotiable — without it a shared cache would serve
  // the dark HTML to light-theme users and vice versa.
  const vary = response.headers.get('vary') ?? '';
  if (!/\bcookie\b/i.test(vary)) {
    throw new Error(
      `${name}: missing "Vary: Cookie" header — cache fragmentation risk (got "${vary}")`,
    );
  }

  // Cache-Control: s-maxage lets CDNs cache per-cookie-variant HTML. Dropping
  // it would silently regress hit-rate on every themed request.
  const cacheControl = response.headers.get('cache-control') ?? '';
  if (!/\bs-maxage=\d+/i.test(cacheControl)) {
    throw new Error(
      `${name}: missing "s-maxage" in Cache-Control (got "${cacheControl}")`,
    );
  }

  return `  ✓ ${name}`;
}

async function main() {
  console.log(`SSR theme smoke test → ${BASE_URL}`);
  const results = [];
  let failures = 0;

  for (const testCase of cases) {
    try {
      results.push(await runCase(testCase));
    } catch (err) {
      results.push(`  ✗ ${testCase.name}\n    ${err.message}`);
      failures += 1;
    }
  }

  console.log(results.join('\n'));
  if (failures > 0) {
    console.error(`\n${failures}/${cases.length} cases failed`);
    process.exit(1);
  }
  console.log(`\nAll ${cases.length} cases passed.`);
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(2);
});
