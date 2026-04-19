import { isPlatformBrowser } from '@angular/common';
import {
  computed,
  inject,
  Injectable,
  PLATFORM_ID,
  Signal,
  signal,
} from '@angular/core';

const STORAGE_KEY = 'prime_auth_user';

/**
 * Mock auth para el showcase: cualquier credencial es aceptada.
 *
 * Persistencia scope-session: la sesión se conserva ante refresh completo
 * pero no entre pestañas/ventanas nuevas ni tras cerrar el navegador. Es
 * intencional para un mockup — no hay backend ni token real que validar.
 *
 * SSR: `sessionStorage` no existe en el server, así que el valor inicial
 * siempre resuelve a `null` durante SSR. El guard redirige a /login en el
 * render del server; el browser reconcilia tras hidratación si la sesión
 * local dice lo contrario (acepteable porque login es una ruta pública).
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private platformId = inject(PLATFORM_ID);

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

  private readInitial(): string | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    return sessionStorage.getItem(STORAGE_KEY);
  }

  private persist(email: string | null): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (email) sessionStorage.setItem(STORAGE_KEY, email);
    else sessionStorage.removeItem(STORAGE_KEY);
  }
}
