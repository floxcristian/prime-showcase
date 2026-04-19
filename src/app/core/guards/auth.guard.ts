import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth/auth.service';

/**
 * Bloquea rutas del dashboard si el usuario no está autenticado.
 * Retorna un `UrlTree` en vez de navegar imperativamente — es el patrón
 * Angular 20+ recomendado: cancela la navegación actual y redirige en
 * una sola operación atómica, sin ciclos extra de CD ni race conditions.
 */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isAuthenticated() ? true : router.createUrlTree(['/login']);
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
