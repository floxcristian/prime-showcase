import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth/auth.service';

/**
 * Bloquea rutas del dashboard si el usuario no está autenticado.
 *
 * **Preservación de deep-link vía `returnUrl`:** al redirigir, adjunta la URL
 * destino como queryParam para que el login la recupere post-auth. Sin esto
 * (patrón original) cualquier usuario que aterrice directo en `/customers`,
 * `/chat/thread-x`, o una URL compartida por email/push/bookmark terminaría
 * en home tras login, **perdiendo su intención de navegación original**.
 * Confirmado como bug real: `curl -sI http://prod/customers` devuelve 302 sin
 * context → tras login se pierde el destino.
 *
 * Patrón estándar enterprise (Angular Router docs, Auth0, Okta, Firebase Auth):
 * returnUrl → login → navegar a returnUrl tras success. Sanitizado contra
 * open-redirect en el consumer (login component) — solo acepta paths
 * internos que empiezan con `/` (no URLs externas).
 */
export const authGuard: CanActivateFn = (_, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isAuthenticated()) return true;
  // Preservar deep-link en queryParam `returnUrl` para que login navegue
  // al destino original post-auth. Sanitización contra open-redirect en el
  // consumer (login component): solo acepta paths internos. Nota: Angular
  // SSR 21 no serializa queryParams de UrlTree al emitir Location header en
  // redirects server-side (behavior confirmado con curl) — el returnUrl
  // funciona cliente-side en SPA internal nav pero se pierde en 302 SSR.
  // Workaround: cuando el usuario hace hard-deep-link, aterriza en /login
  // sin returnUrl y tras auth va a /. Caso edge aceptable para un showcase
  // con auth mock; migrar a auth via cookie en prod con backend real.
  const needsReturn = state.url && state.url !== '/';
  return router.parseUrl(
    needsReturn
      ? `/login?returnUrl=${encodeURIComponent(state.url)}`
      : '/login',
  );
};

/**
 * Previene volver a /login si ya hay sesión activa (evita que un usuario
 * autenticado vea la pantalla de login al navegar atrás con el browser).
 */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isAuthenticated() ? router.createUrlTree(['/']) : true;
};
