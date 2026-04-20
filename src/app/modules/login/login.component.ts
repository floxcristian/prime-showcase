// Angular
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
// PrimeNG
import { ButtonModule } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { InputTextModule } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { PasswordModule } from 'primeng/password';
import { TooltipModule } from 'primeng/tooltip';
// App
import { AppConfigService } from '../../core/services/app-config/app-config.service';
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

const NG_MODULES = [FormsModule];
const PRIME_MODULES = [
  ButtonModule,
  Checkbox,
  InputTextModule,
  Message,
  PasswordModule,
  TooltipModule,
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
  private configService = inject(AppConfigService);

  readonly darkTheme = this.configService.darkTheme;

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

  readonly canSubmit = computed(
    () => this.email().trim().length > 0 && this.password().length > 0,
  );

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

  toggleTheme(): void {
    this.configService.setDarkTheme(!this.darkTheme());
  }

  markEmailTouched(): void {
    this.emailTouched.set(true);
  }

  markPasswordTouched(): void {
    this.passwordTouched.set(true);
  }

  onSubmit(): void {
    if (!this.canSubmit() || this.submitting()) return;
    this.submitting.set(true);
    // Delay corto para dar feedback visual del estado "cargando"; sin backend
    // que llamar, el timer es la única fuente de latencia. Ref: ADR-001 §8.
    setTimeout(() => {
      this.auth.login(this.email().trim());
      this.router.navigateByUrl('/');
    }, 450);
  }
}
