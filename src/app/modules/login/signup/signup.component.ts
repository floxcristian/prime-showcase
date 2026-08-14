// Angular
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
// PrimeNG
import { ButtonModule } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { InputTextModule } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { PasswordModule } from 'primeng/password';
// App
import { AUTH_SUBMIT_DELAY_MS } from '../../../core/constants/auth-timings';
import { AuthService } from '../../../core/services/auth/auth.service';
import { SocialSettingsService } from '../../social/services/social-settings.service';
// Constants
import { SIGNUP_BENEFITS, SignupBenefit } from './constants/signup-content';

const NG_MODULES = [FormsModule, RouterLink];
const PRIME_MODULES = [
  ButtonModule,
  Checkbox,
  InputTextModule,
  Message,
  PasswordModule,
];

// Mismo pattern que login.component.ts — validación de FORMA del email, no
// de autenticidad (no hay backend). Duplicado deliberadamente: cada flujo de
// auth es dueño de su const local (ownership por módulo, RFC-003 D2).
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Largo mínimo de contraseña (RFC-003 D2). Solo regla de largo — la fuerza
 *  la comunica el feedback de `<p-password>`, sin bloquear el submit. */
const MIN_PASSWORD_LENGTH = 8;

/**
 * Registro mock del SaaS social (RFC-003 D2), réplica de los patrones de
 * `login.component.ts`: signals por campo, validación perezosa on-blur
 * destapada al submit, `AUTH_SUBMIT_DELAY_MS` como única latencia y timer
 * cancelado en destroy.
 *
 * El registro mock ES un login: cualquier email crea sesión (cookie de
 * `AuthService`) y el usuario autenticado pasa a ser el cliente/tenant de la
 * suite social (RFC-003 D1). El `brandName` se entrega a
 * `SocialSettingsService`, que lo persiste scoped al cliente (RFC-003 D6)
 * para saludos/branding y como `displayName` de las cuentas conectadas.
 * Sin verificación de unicidad de email — en producción: POST /signup +
 * verificación de email.
 */
@Component({
  selector: 'app-signup',
  imports: [NG_MODULES, PRIME_MODULES],
  templateUrl: './signup.component.html',
  styleUrl: './signup.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    // Idéntica al login (RFC-003 D2): min-h-screen en mobile (el form crece
    // si el viewport es bajo); lg:h-screen fija 100vh desde lg para que el
    // aside no haga crecer el body fuera del viewport.
    class:
      'flex w-full min-h-screen lg:h-screen bg-surface-0 dark:bg-surface-950 overflow-hidden',
  },
})
export class SignupComponent {
  private auth = inject(AuthService);
  private settings = inject(SocialSettingsService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  // Handle del timer de submit simulado. Se cancela si el componente se
  // destruye antes de disparar (evita login/navegación post-destroy).
  private submitTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    this.destroyRef.onDestroy(() => clearTimeout(this.submitTimer));
  }

  /** Nombre de la marca/empresa del cliente (RFC-003 D1/D2). */
  readonly brandName = signal('');
  readonly email = signal('');
  readonly password = signal('');
  readonly acceptTerms = signal(false);
  readonly submitting = signal(false);
  readonly brandTouched = signal(false);
  readonly emailTouched = signal(false);
  readonly passwordTouched = signal(false);
  readonly termsTouched = signal(false);

  readonly benefits: readonly SignupBenefit[] = SIGNUP_BENEFITS;

  // Validación perezosa: solo tras blur, nunca durante tipeo — calcada de
  // login.component.ts (Smashing/NN-g: inline validation on blur).
  readonly brandInvalid = computed(() => {
    return this.brandTouched() && this.brandName().trim().length === 0;
  });

  readonly emailInvalid = computed(() => {
    if (!this.emailTouched()) return false;
    const value = this.email().trim();
    if (value.length === 0) return true;
    return !EMAIL_PATTERN.test(value);
  });

  readonly emailErrorMessage = computed(() => {
    if (this.email().trim().length === 0) return 'Este campo es requerido.';
    return 'El correo electrónico ingresado no es válido.';
  });

  readonly passwordInvalid = computed(() => {
    if (!this.passwordTouched()) return false;
    return this.password().length < MIN_PASSWORD_LENGTH;
  });

  readonly passwordErrorMessage = computed(() => {
    if (this.password().length === 0) return 'Este campo es requerido.';
    return 'Mínimo 8 caracteres.';
  });

  readonly termsInvalid = computed(() => {
    return this.termsTouched() && !this.acceptTerms();
  });

  markBrandTouched(): void {
    this.brandTouched.set(true);
  }

  markEmailTouched(): void {
    this.emailTouched.set(true);
  }

  markPasswordTouched(): void {
    this.passwordTouched.set(true);
  }

  markTermsTouched(): void {
    this.termsTouched.set(true);
  }

  onSubmit(): void {
    if (this.submitting()) return;
    // Botón siempre habilitado: al click forzamos todos los campos a
    // "touched" para destapar los computeds de validación. Patrón
    // Stripe/Vercel/GitHub (mismo que login): el usuario descubre el estado
    // de error al intentar submit, no antes. Si algo es inválido, bail —
    // los p-message ya renderizarán vía los signals.
    this.markAllTouched();
    if (this.anyInvalid()) return;
    this.submitting.set(true);
    // Delay corto para feedback visual de "cargando"; sin backend que
    // llamar, el timer es la única fuente de latencia. Ref: ADR-001 §8.
    this.submitTimer = setTimeout(() => {
      // El registro mock ES un login: cualquier email crea sesión (cookie de
      // AuthService). El brandName se persiste scoped al cliente (RFC-003
      // D6). Post-registro aterriza en el checklist de primeros pasos de
      // /social/overview (RFC-003 D3) — sin returnUrl: nadie deep-linkea a
      // rutas protegidas para terminar registrándose.
      this.auth.login(this.email().trim());
      this.settings.setBrandName(this.brandName().trim());
      void this.router.navigateByUrl('/social/overview');
    }, AUTH_SUBMIT_DELAY_MS);
  }

  private markAllTouched(): void {
    this.brandTouched.set(true);
    this.emailTouched.set(true);
    this.passwordTouched.set(true);
    this.termsTouched.set(true);
  }

  private anyInvalid(): boolean {
    return (
      this.brandInvalid() ||
      this.emailInvalid() ||
      this.passwordInvalid() ||
      this.termsInvalid()
    );
  }
}
