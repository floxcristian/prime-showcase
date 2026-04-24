/**
 * Cookie-based auth persistence. Reemplaza `sessionStorage` anterior porque
 * el servidor NO puede leer sessionStorage — resultado: cualquier deep-link
 * vía SSR se redirigía a /login perdiendo el destino original (verificado
 * con `curl /customers` → `Location: /login` en prod SSR, ronda 8).
 *
 * **Enterprise pattern:** backend emite `Set-Cookie: auth=<JWT>; HttpOnly` vía
 * response header post-login. JS nunca toca el cookie directamente. Para este
 * showcase con auth mock no hay backend, así que escribimos vía
 * `document.cookie` (NO HttpOnly) — trade-off documentado. En migración a
 * backend real:
 *   1. Backend retorna `Set-Cookie: prime_auth_user=<JWT>; HttpOnly; Secure`.
 *   2. Este util se simplifica a parseAuthCookie only (server via REQUEST,
 *      client via reconstrucción); la escritura la maneja el backend.
 *   3. El HMAC signed JWT resuelve forgery.
 *
 * **Security model actual (showcase):**
 *   - SameSite=Lax — protege contra CSRF cross-site POST.
 *   - Secure opt-in — solo HTTPS en prod. Caller pasa el flag.
 *   - Valor es el email raw URL-encoded — cualquiera puede forjarlo. Mock.
 *   - Max-Age 1 día vs session-only del sessionStorage anterior — trade-off:
 *     ganamos persistencia across tabs + SSR pero perdemos auto-expire al
 *     cerrar browser. Aceptable para un demo; para prod usar token refresh.
 *
 * Ref: ADR-001 §4 (cookie pattern), OWASP ASVS V3 Session Management.
 */

export const AUTH_COOKIE_NAME = 'prime_auth_user';

/** 1 día. Corto para un mock demo; en prod con JWT usar refresh-token flow. */
export const AUTH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24;

export interface SerializeAuthCookieOptions {
  /**
   * Emit `Secure` attribute. Caller deriva de su origen (location.protocol
   * en browser, X-Forwarded-Proto en servidor) — el util queda pure.
   */
  secure: boolean;
}

/**
 * Parse del cookie header (`Cookie:` server-side) o `document.cookie` (browser).
 * Retorna null si ausente o malformado para que los callers caigan al default.
 *
 * Regex notes:
 *   - `(?:^|;\s*)` anchor — evita matches parciales en otros nombres cookie.
 *   - `[^;\s]+` value body — rechaza whitespace interno (inyección).
 *   - Decode URI — el email puede tener `@`/`+` URL-escaped.
 *   - Try/catch por `decodeURIComponent` — mal-form triple-%% devuelve null.
 */
export function parseAuthCookie(
  cookie: string | null | undefined,
): string | null {
  if (!cookie) return null;
  const match = cookie.match(/(?:^|;\s*)prime_auth_user=([^;\s]+)/);
  if (!match) return null;
  try {
    const decoded = decodeURIComponent(match[1]);
    return decoded.length > 0 ? decoded : null;
  } catch {
    return null;
  }
}

/**
 * Serializa para `document.cookie` (client-side write). `email === null`
 * retorna un cookie de expiración inmediata (Max-Age=0) que borra el
 * existente — patrón estándar para logout.
 *
 * Validación anti cookie-injection: el email no puede contener `;`, `,`, ni
 * whitespace. Los email válidos no los tienen; este check es defense-in-depth
 * para que un input malformado o user-controlled futuro no inyecte atributos.
 * Ref: OWASP ASVS V13.1.3.
 */
export function serializeAuthCookie(
  email: string | null,
  options: SerializeAuthCookieOptions,
): string {
  const secureAttr = options.secure ? '; Secure' : '';
  if (email === null) {
    return `${AUTH_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax${secureAttr}`;
  }
  if (/[;,\s]/.test(email)) {
    throw new TypeError(
      `Invalid auth cookie value (contains ; , or whitespace): ${email}`,
    );
  }
  const encoded = encodeURIComponent(email);
  return `${AUTH_COOKIE_NAME}=${encoded}; Path=/; Max-Age=${AUTH_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${secureAttr}`;
}
