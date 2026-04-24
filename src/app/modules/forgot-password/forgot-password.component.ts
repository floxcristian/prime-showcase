// Angular
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
// PrimeNG
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { Message } from 'primeng/message';
// App
import { AUTH_SUBMIT_DELAY_MS } from '../../core/constants/auth-timings';

const NG_MODULES = [FormsModule, RouterLink];
const PRIME_MODULES = [ButtonModule, InputTextModule, Message];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Component({
  selector: 'app-forgot-password',
  imports: [NG_MODULES, PRIME_MODULES],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    // Misma receta que login: min-h-screen en mobile (form crece si viewport
    // es bajo); lg:h-screen fija 100vh desde lg en adelante.
    class:
      'flex w-full min-h-screen lg:h-screen bg-surface-0 dark:bg-surface-950 overflow-hidden',
  },
})
export class ForgotPasswordComponent {
  readonly email = signal('');
  readonly emailTouched = signal(false);
  readonly submitting = signal(false);
  // Switch entre estado 1 (form) y estado 2 (confirmacion "revisa tu correo").
  // Sin backend real: el flip lo hace onSubmit() tras el delay de UX.
  readonly submitted = signal(false);

  // Validacion perezosa, mismo patron que login: tras blur o tras intentar
  // submit. Evita flagear error mientras el usuario todavia tipea.
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

  markEmailTouched(): void {
    this.emailTouched.set(true);
  }

  onSubmit(): void {
    if (this.submitting()) return;
    // Mismo contrato que login: boton siempre habilitado, al click forzamos
    // touched para destapar el error via los computed. Bail si invalido.
    this.emailTouched.set(true);
    if (this.emailInvalid()) return;
    this.submitting.set(true);
    // Delay corto para feedback visual. Sin backend, el timer simula latencia.
    setTimeout(() => {
      this.submitting.set(false);
      this.submitted.set(true);
    }, AUTH_SUBMIT_DELAY_MS);
  }

  resend(): void {
    // Reenvio desde la pantalla de confirmacion. Sin backend, solo simula
    // spinner para dar feedback "envie de nuevo" (patron Stripe/Linear).
    if (this.submitting()) return;
    this.submitting.set(true);
    setTimeout(() => {
      this.submitting.set(false);
    }, AUTH_SUBMIT_DELAY_MS);
  }

  useDifferentEmail(): void {
    // Vuelve al estado 1 para que el usuario corrija el correo. Limpia el
    // valor para no dejar el anterior pegado en el input.
    this.submitted.set(false);
    this.email.set('');
    this.emailTouched.set(false);
  }
}
