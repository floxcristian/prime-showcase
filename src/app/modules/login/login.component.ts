// Angular
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
// PrimeNG
import { ButtonModule } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { InputTextModule } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { PasswordModule } from 'primeng/password';
// App
import { AUTH_SUBMIT_DELAY_MS } from '../../core/constants/auth-timings';
import { AuthService } from '../../core/services/auth/auth.service';
// Constants
import {
  LOGIN_FEATURES,
  LOGIN_STATS,
  LOGIN_TESTIMONIAL,
  LoginFeature,
  LoginStat,
  LoginTestimonial,
} from './constants/login-features';

const NG_MODULES = [FormsModule, RouterLink];
const PRIME_MODULES = [
  ButtonModule,
  Checkbox,
  InputTextModule,
  Message,
  PasswordModule,
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Component({
  selector: 'app-login',
  imports: [NG_MODULES, PRIME_MODULES],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    // min-h-screen en mobile (form crece si el viewport es bajo); lg:h-screen
    // fija altura a 100vh desde lg en adelante para que el bento del aside no
    // haga crecer el body fuera del viewport (overflow-hidden solo clipea
    // hijos, no al host mismo).
    class:
      'flex w-full min-h-screen lg:h-screen bg-surface-0 dark:bg-surface-950 overflow-hidden',
  },
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  /**
   * URL destino tras login. Viene via queryParam desde `authGuard` cuando el
   * usuario intenta acceder a una ruta protegida sin sesión. Default a `/`
   * si no hay returnUrl (flujo standalone desde /login).
   *
   * **Sanitización contra open-redirect:** solo aceptamos paths internos que
   * empiezan con `/` y no son `//` (protocolo-relative). Cualquier otra cosa
   * cae al fallback `/`. Evita que un attacker pase `?returnUrl=https://evil.com`
   * en un email phishing y el login-success redirija afuera. Patrón OWASP
   * Unvalidated-Redirect. Ref: https://owasp.org/www-community/attacks/Unvalidated_Redirects_and_Forwards
   */
  private readonly returnUrl = ((): string => {
    const raw = this.route.snapshot.queryParamMap.get('returnUrl');
    if (!raw) return '/';
    if (!raw.startsWith('/') || raw.startsWith('//')) return '/';
    return raw;
  })();

  readonly email = signal('');
  readonly password = signal('');
  // Default OFF: panel de distribución suele usarse en PCs compartidos de
  // tienda/bodega. Marcarlo por default sería riesgo de seguridad (Agent B2B
  // research: Vercel/Supabase/Notion coinciden en default OFF para B2B).
  readonly remember = signal(false);
  readonly submitting = signal(false);
  readonly emailTouched = signal(false);
  readonly passwordTouched = signal(false);

  readonly features: readonly LoginFeature[] = LOGIN_FEATURES;
  readonly stats: readonly LoginStat[] = LOGIN_STATS;
  readonly testimonial: LoginTestimonial = LOGIN_TESTIMONIAL;

  // Validación perezosa: solo tras blur, nunca durante tipeo. Evita interrumpir
  // al usuario mientras escribe (Smashing/NN-g: inline validation on blur).
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
    return this.passwordTouched() && this.password().length === 0;
  });

  markEmailTouched(): void {
    this.emailTouched.set(true);
  }

  markPasswordTouched(): void {
    this.passwordTouched.set(true);
  }

  onSubmit(): void {
    if (this.submitting()) return;
    // Boton siempre habilitado: al click forzamos ambos campos a "touched"
    // para que los computed de validacion (emailInvalid/passwordInvalid) se
    // destapen. Patron Stripe/Vercel/GitHub: el usuario descubre el estado
    // de error al intentar submit, no antes. Si algo es invalido, bail —
    // los p-message ya renderizaran via los signals.
    this.emailTouched.set(true);
    this.passwordTouched.set(true);
    if (this.emailInvalid() || this.passwordInvalid()) return;
    this.submitting.set(true);
    // Delay corto para dar feedback visual del estado "cargando"; sin backend
    // que llamar, el timer es la única fuente de latencia. Ref: ADR-001 §8.
    setTimeout(() => {
      this.auth.login(this.email().trim());
      this.router.navigateByUrl(this.returnUrl);
    }, AUTH_SUBMIT_DELAY_MS);
  }
}
