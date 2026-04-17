export const THEME_COOKIE_NAME = 'theme';

export type ThemePreference = 'dark' | 'light';

export interface SerializeThemeCookieOptions {
  /**
   * Emit the `Secure` attribute. Browsers never add it implicitly, so the
   * caller MUST derive this from its own origin (e.g. `location.protocol`
   * on the browser, the forwarded protocol header on the server). Keeping
   * the util pure makes it unit-testable without globals and lets us cover
   * Secure/no-Secure with deterministic inputs.
   */
  secure: boolean;
}

/**
 * Parse the theme preference from a cookie header (`Cookie:` on the server) or
 * `document.cookie` (browser). Returns `null` when absent or unrecognized so
 * callers can fall back to OS preference or default.
 *
 * Regex shape notes:
 *   - `(?:^|;\s*)` anchor — prevents false positives on cookie names that
 *     END in `theme` (e.g. `mytheme=dark` must not parse).
 *   - `[^;\s]+` value body — rejects whitespace inside the value so inputs
 *     like `theme=dark evil` don't silently capture `dark evil`.
 *   - Leftmost match wins on duplicates — documented and asserted in tests.
 */
export function parseThemeCookie(
  cookie: string | null | undefined,
): ThemePreference | null {
  if (!cookie) return null;
  const match = cookie.match(/(?:^|;\s*)theme=([^;\s]+)/);
  if (!match) return null;
  const value = match[1];
  return value === 'dark' || value === 'light' ? value : null;
}

/**
 * Serialize for `document.cookie`. 1-year persistence, Path=/ so it is sent on
 * every route (SSR relies on this), SameSite=Lax so it survives top-level
 * navigations from external links without leaking to cross-site POSTs.
 *
 * `Secure` is emitted only when the caller signals an HTTPS origin. Pure
 * function: no reads from `location` or any other global — callers own the
 * protocol decision and can test both branches deterministically.
 *
 * Runtime value check: `ThemePreference` is a TypeScript narrowing and is not
 * enforced at JS runtime. We re-validate here so that future callers that
 * forward user-controlled input — even accidentally — can't inject a cookie
 * attribute (`dark; Path=/; evil=1`). Defense-in-depth against header/cookie
 * injection is the industry baseline for anything that writes `Set-Cookie` or
 * `document.cookie` (see OWASP ASVS V13.1.3).
 */
export function serializeThemeCookie(
  theme: ThemePreference,
  options: SerializeThemeCookieOptions,
): string {
  if (theme !== 'dark' && theme !== 'light') {
    throw new TypeError(`Invalid theme value: ${String(theme)}`);
  }
  const base = `${THEME_COOKIE_NAME}=${theme}; Path=/; Max-Age=31536000; SameSite=Lax`;
  return options.secure ? `${base}; Secure` : base;
}
