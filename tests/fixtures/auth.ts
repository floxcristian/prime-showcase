// @ts-check
/**
 * Test fixtures shared across visual + a11y suites.
 *
 * The single fixture here — `authedPage` — bootstraps a session by writing
 * the mock auth cookie before the first navigation. The cookie format
 * matches `serializeAuthCookie` in `src/app/core/services/auth/auth-cookie.util.ts`:
 * URL-encoded email payload. Mock auth (no JWT signing) lets the test
 * write the cookie directly without exercising the login flow, which would
 * add ~1.5s of wall time per spec and couple the visual baseline to
 * `/login` rendering.
 *
 * Why a fixture and not `beforeEach`: Playwright fixtures are composable
 * and lazy — only specs that ask for `authedPage` pay the cookie cost,
 * and they get IDE autocompletion + first-class trace integration.
 */
import { test as base, expect, Page } from '@playwright/test';

const AUTH_COOKIE_NAME = 'prime_auth_user';
const TEST_EMAIL = 'visual-regression@example.com';

export const test = base.extend<{ authedPage: Page }>({
  authedPage: async ({ browser, baseURL }, use) => {
    const url = new URL(baseURL ?? 'http://127.0.0.1:4000');
    const context = await browser.newContext({
      // Cookie set before any navigation so the first HTML response (SSR)
      // includes the authed render — no client-side redirect to /login,
      // no FOUC on the visual baseline.
      storageState: {
        cookies: [
          {
            name: AUTH_COOKIE_NAME,
            value: encodeURIComponent(TEST_EMAIL),
            domain: url.hostname,
            path: '/',
            httpOnly: false,
            secure: url.protocol === 'https:',
            sameSite: 'Lax',
          },
        ],
        origins: [],
      },
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

export { expect };
