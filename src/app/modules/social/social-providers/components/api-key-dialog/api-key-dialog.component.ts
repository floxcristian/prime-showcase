// Angular
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
// PrimeNG
import { ButtonModule } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { Message } from 'primeng/message';
// Local
import type { ProviderDescriptor } from '../../../models/provider.interface';
import { SocialSettingsService } from '../../../services/social-settings.service';

const NG_MODULES = [FormsModule];
const PRIME_MODULES = [ButtonModule, Dialog, InputTextModule, Message];

/** Ventana de feedback del copy-to-clipboard (mismo valor que el dialog de
 *  API keys de usuarios — el patrón ya existe en el repo). */
const COPY_FEEDBACK_MS = 2000;

/**
 * Alta de API key en dos pasos (RFC-003 D5.2) — componente LOCAL de
 * `social-providers`.
 *
 *   1. **form** — label opcional + key. La validación de FORMA usa como
 *      fuente ÚNICA el `keyPattern` del `ProviderDescriptor`
 *      (`new RegExp(descriptor.keyPattern)`): cero regex paralelas, cero
 *      drift contra el shape-check de `verifyKey` (RFC-002 D5). On-blur,
 *      no on-keystroke; el submit queda deshabilitado hasta pasar la forma.
 *   2. **reveal** — `addKey` devuelve el plaintext UNA sola vez y lo
 *      descarta: el service persiste únicamente `maskedKey`. Se muestra con
 *      copy-to-clipboard y aviso `warn`; **cerrar es irreversible**. La key
 *      nace `unverified` — habilitar el provider exige verificarla antes.
 *
 * El plaintext vive exclusivamente en memoria de este componente y se
 * limpia al cerrar (effect de reset): nunca va a storage, ni al signal de
 * estado, ni a un output.
 */
@Component({
  selector: 'app-api-key-dialog',
  imports: [NG_MODULES, PRIME_MODULES],
  templateUrl: './api-key-dialog.component.html',
  styleUrl: './api-key-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApiKeyDialogComponent {
  private readonly settings = inject(SocialSettingsService);
  private readonly destroyRef = inject(DestroyRef);

  /** Provider al que se le agrega la key. `null` con el dialog cerrado. */
  readonly descriptor = input<ProviderDescriptor | null>(null);

  /** Two-way con la página, que es quien abre el dialog desde la card. */
  readonly visible = model<boolean>(false);

  protected readonly step = signal<'form' | 'reveal'>('form');
  protected readonly label = signal('');
  protected readonly keyValue = signal('');
  protected readonly keyTouched = signal(false);
  protected readonly busy = signal(false);
  protected readonly copied = signal(false);

  /**
   * Plaintext recién generado — única ventana de exposición. Se descarta al
   * cerrar el dialog; después solo existe la máscara persistida.
   */
  protected readonly plaintext = signal<string | null>(null);

  private copiedResetTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    // Reset al cerrar: reabrir para otro provider arranca limpio y el
    // plaintext deja de existir en memoria (cerrar ES irreversible).
    effect(() => {
      if (!this.visible()) {
        this.step.set('form');
        this.label.set('');
        this.keyValue.set('');
        this.keyTouched.set(false);
        this.busy.set(false);
        this.plaintext.set(null);
        this.copied.set(false);
      }
    });

    this.destroyRef.onDestroy(() => clearTimeout(this.copiedResetTimer));
  }

  /** Shape-check contra el catálogo — la MISMA regex que usa `verifyKey`. */
  protected readonly shapeOk = computed<boolean>(() => {
    const provider = this.descriptor();
    if (!provider) {
      return false;
    }
    return new RegExp(provider.keyPattern).test(this.keyValue().trim());
  });

  /** Validación perezosa: solo después del primer blur (receta de
   *  `ux-patterns.md`, calcada de login/signup). */
  protected readonly keyInvalid = computed(
    () => this.keyTouched() && !this.shapeOk(),
  );

  protected readonly keyErrorMessage = computed<string>(() => {
    if (this.keyValue().trim().length === 0) {
      return 'Este campo es requerido.';
    }
    const hint = this.descriptor()?.keyFormatHint ?? '';
    return `El formato esperado es «${hint}».`;
  });

  protected markKeyTouched(): void {
    this.keyTouched.set(true);
  }

  /**
   * Alta real. `addKey` enmascara al vuelo y devuelve el plaintext una
   * única vez; a partir de acá el estado del cliente solo conoce la
   * máscara. La key nace `unverified` (RFC-003 D5.2).
   */
  protected submit(): void {
    const provider = this.descriptor();
    if (!provider || !this.shapeOk() || this.busy()) {
      return;
    }
    this.busy.set(true);
    const trimmedLabel = this.label().trim();
    this.settings
      .addKey(provider.id, this.keyValue().trim(), trimmedLabel || undefined)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ plaintext }) => {
          this.plaintext.set(plaintext);
          // El input pierde el plaintext acá: el paso 2 lee `plaintext()`.
          this.keyValue.set('');
          this.step.set('reveal');
          this.busy.set(false);
        },
        error: () => {
          this.busy.set(false);
        },
      });
  }

  protected cancel(): void {
    this.visible.set(false);
  }

  /**
   * Copy-to-clipboard del plaintext. `navigator.clipboard` puede no existir
   * (HTTP plano, iframes sin permission policy) — en ese caso el usuario
   * tiene el `<code>` seleccionable como fallback.
   */
  protected async copyPlaintext(): Promise<void> {
    const value = this.plaintext();
    if (!value || !navigator.clipboard) {
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      this.copied.set(true);
      clearTimeout(this.copiedResetTimer);
      this.copiedResetTimer = setTimeout(
        () => this.copied.set(false),
        COPY_FEEDBACK_MS,
      );
    } catch {
      // Permiso denegado o API no soportada — silent fail intencional.
    }
  }
}
