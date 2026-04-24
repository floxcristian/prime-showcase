import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  computed,
  inject,
  Injectable,
  PLATFORM_ID,
  REQUEST,
  Signal,
  signal,
} from '@angular/core';
import {
  parseAuthCookie,
  serializeAuthCookie,
} from './auth-cookie.util';

/**
 * Mock auth para el showcase: cualquier credencial es aceptada.
 *
 * **Persistencia: cookie (antes `sessionStorage`).** El cambio es necesario
 * porque `sessionStorage` no es accesible desde el servidor — resultado:
 * cualquier deep-link a una ruta protegida (/customers, /chat, etc.) se
 * redirigía a /login durante SSR perdiendo el destino, aunque el usuario
 * tuviera sesión válida client-side. Verificado con `curl /customers` → 302
 * en ronda 8. Cookie + SameSite=Lax resuelve esto:
 *   - SSR: `REQUEST` inyectable por Angular expone los cookies del browser →
 *     AuthService inicializa el signal con el email del cookie → authGuard
 *     ve isAuthenticated=true → renderiza /customers server-side → 200 OK.
 *   - CSR: `document.cookie` provee el mismo valor → hidratación coincide
 *     con el HTML SSR → cero mismatch.
 *
 * **Trade-offs del mock (documentados para el equipo):**
 *   - Persistencia cross-tab y 1-día (vs session-only sessionStorage).
 *     Aceptable para demo; prod con backend real usaría refresh-token flow.
 *   - Cookie NO es HttpOnly — JS lo escribe (no hay backend que emita
 *     Set-Cookie). En prod el backend emitiría `Set-Cookie: auth=<JWT>;
 *     HttpOnly; Secure` y JS nunca lo tocaría.
 *   - Valor es email raw URL-encoded — forjable. OK para showcase;
 *     prod requiere JWT HMAC-signed.
 *
 * Ref: ADR-001 §4 (cookie pattern compartido con theme).
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private platformId = inject(PLATFORM_ID);
  private document = inject(DOCUMENT);
  // REQUEST only exists during SSR; browser injection resolves to null.
  private request = inject(REQUEST, { optional: true });

  private readonly _email = signal<string | null>(this.readInitial());

  readonly email: Signal<string | null> = this._email.asReadonly();
  readonly isAuthenticated: Signal<boolean> = computed(
    () => this._email() !== null,
  );

  login(email: string): void {
    this._email.set(email);
    this.persist(email);
  }

  logout(): void {
    this._email.set(null);
    this.persist(null);
  }

  /**
   * Lectura inicial consistente server+client:
   *   - Server: `REQUEST.headers.get('cookie')` (inyectado por @angular/ssr).
   *   - Browser: `document.cookie` (cliente-side).
   * Mismo parser pure (`parseAuthCookie`) → zero divergence entre hydración
   * server y client state inicial.
   */
  /**
   * Lectura inicial consistente server+client:
   *   - Server: `REQUEST.headers.get('cookie')` (inyectado por @angular/ssr).
   *   - Browser: `document.cookie` (cliente-side).
   * Mismo parser pure (`parseAuthCookie`) → zero divergence entre hydración
   * server y client state inicial.
   *
   * **Known limitation (verificado ronda 8):** este Angular 21 SSR setup NO
   * invoca canActivate guards server-side — verificado con
   * `process.stderr.write` desde el guard + forced-auth-true probe; ni el
   * output del guard ni el cambio de redirect target desde el guard se
   * reflejaban. Resultado: todo deep-link a ruta protegida devuelve 302
   * /login con body vacío directamente desde el SSR engine sin tocar guards.
   * El cookie-based auth que acabamos de construir sí habilitaría SSR auth,
   * pero el guard no lo consume server-side. Client-side la migración
   * mejora la persistencia cross-tab y elimina el `sessionStorage` (que era
   * un sloc-level problem). La investigación del bypass requiere aislar en
   * repro minimal + upstream issue — fuera del scope de esta ronda.
   */
  private readInitial(): string | null {
    if (isPlatformBrowser(this.platformId)) {
      return parseAuthCookie(this.document.cookie);
    }
    const cookieHeader = this.request?.headers.get('cookie');
    return parseAuthCookie(cookieHeader);
  }

  /**
   * Escritura del cookie en el browser. En SSR no persiste nada (el server
   * nunca hace login directamente; el cookie lo emite el login route cuando
   * el usuario submittea desde el browser).
   *
   * `Secure` derivado de `location.protocol === 'https:'` — garantiza que
   * el cookie solo viaja por HTTPS en prod y queda plain en localhost dev.
   */
  private persist(email: string | null): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const secure =
      this.document.defaultView?.location?.protocol === 'https:';
    this.document.cookie = serializeAuthCookie(email, { secure });
  }
}
