import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ButtonModule } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelect } from 'primeng/multiselect';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';

import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { TooltipDismissOnClickDirective } from '../../../../shared/directives/tooltip-dismiss-on-click.directive';
import { RelativeTimePipe } from '../../../../shared/pipes/relative-time.pipe';
import type {
  ApiKey,
  ApiKeyScope,
  ApiKeyStatus,
} from '../../models/api-key.interface';
import type { User } from '../../models/user.interface';
import { ApiKeysMockService } from '../../services/api-keys-mock.service';

const NG_MODULES = [CommonModule, FormsModule];
const PRIME_MODULES = [
  ButtonModule,
  Dialog,
  InputTextModule,
  MultiSelect,
  TableModule,
  Tag,
  TooltipModule,
];
const LOCAL_COMPONENTS = [
  EmptyStateComponent,
  TooltipDismissOnClickDirective,
  RelativeTimePipe,
];

/**
 * Dialog de gestión de API keys para usuarios externos. Tres modos:
 *
 *   1. **list**  — tabla de keys existentes + acciones por fila (Rotar /
 *      Revocar). Botón "Generar nueva key" abajo.
 *
 *   2. **form**  — crear o configurar key nueva (name + scopes). Submit
 *      → genera secret y entra en `reveal`.
 *
 *   3. **reveal** — muestra el plaintext UNA VEZ con copy-to-clipboard.
 *      Al cerrar, vuelve a `list` y descarta el secret. Patrón Stripe /
 *      GitHub: el backend hashea inmediatamente, el frontend no puede
 *      recuperar el secret después de este momento.
 *
 * El estado se resetea automáticamente al cerrar el dialog (effect que
 * observa `visible`) — abrir el mismo user dos veces no muestra residual.
 */
@Component({
  selector: 'app-user-api-keys-dialog',
  imports: [NG_MODULES, PRIME_MODULES, LOCAL_COMPONENTS],
  templateUrl: './user-api-keys-dialog.component.html',
  styleUrl: './user-api-keys-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserApiKeysDialogComponent {
  private api = inject(ApiKeysMockService);

  /**
   * User cuyas keys se gestionan. Null cuando el dialog está cerrado y
   * no hay user seleccionado — el template guardea contra null antes
   * de leer propiedades.
   */
  readonly user = input<User | null>(null);

  /**
   * Two-way binding con el parent. Cuando el usuario cierra el dialog
   * (clic en X, fuera del modal, o ESC), `model()` actualiza el parent.
   */
  readonly visible = model<boolean>(false);

  /**
   * Keys del user activo — reactividad delegada al `keysFor()` del
   * service que retorna un computed sobre el state mutable. Cualquier
   * create/rotate/revoke re-renderiza la tabla automáticamente.
   */
  protected readonly keys = computed<readonly ApiKey[]>(() => {
    const u = this.user();
    return u ? this.api.keysFor(u.id)() : [];
  });

  /** UI mode actual del dialog. */
  protected readonly mode = signal<'list' | 'form' | 'reveal'>('list');

  /** Inputs del form de creación. */
  protected readonly newKeyName = signal('');
  protected readonly newKeyScopes = signal<ApiKeyScope[]>([]);

  /**
   * Plaintext del secret recién generado. Sólo se setea durante el
   * `reveal` mode y se descarta al cerrar — no persiste en memoria
   * más allá de este window de exposición controlado.
   */
  protected readonly revealedSecret = signal<string | null>(null);

  /**
   * Flag de operación en curso (create / rotate / revoke). Bloquea
   * botones para evitar double-submit y comunica visualmente que la
   * UI está procesando.
   */
  protected readonly busy = signal(false);

  /** Feedback temporal del copy-to-clipboard (toast inline). */
  protected readonly copied = signal(false);

  /** Scopes disponibles — set cerrado del dominio. */
  protected readonly scopeOptions: ApiKeyScope[] = [
    'read:customers',
    'write:customers',
    'read:orders',
    'write:orders',
    'read:reports',
    'webhooks:manage',
  ];

  constructor() {
    // Reset state al cerrar — abrir el dialog nuevamente arranca limpio,
    // sin residual del flujo anterior. Sin esto, si el user cancela
    // mid-form y reabre, vería los inputs medio llenos.
    effect(() => {
      if (!this.visible()) {
        this.mode.set('list');
        this.newKeyName.set('');
        this.newKeyScopes.set([]);
        this.revealedSecret.set(null);
        this.copied.set(false);
      }
    });
  }

  protected openCreateForm(): void {
    this.mode.set('form');
    this.newKeyName.set('');
    this.newKeyScopes.set([]);
  }

  protected cancelForm(): void {
    this.mode.set('list');
  }

  /**
   * Submit del form de creación. Validación mínima: name no vacío,
   * scopes no vacío. En producción el backend re-valida + agrega
   * checks (uniqueness del name por user, scopes permitidos según
   * role del user, etc.).
   */
  protected submitCreate(): void {
    const u = this.user();
    if (!u) return;
    const name = this.newKeyName().trim();
    const scopes = this.newKeyScopes();
    if (!name || scopes.length === 0 || this.busy()) return;
    this.busy.set(true);
    this.api.createKey(u.id, name, scopes).subscribe(({ plaintext }) => {
      this.revealedSecret.set(plaintext);
      this.mode.set('reveal');
      this.busy.set(false);
    });
  }

  /**
   * Rotación de una key existente. Genera secret nuevo con mismo name
   * + scopes que la antigua, y la antigua queda en estado `Revocada`.
   */
  protected rotate(keyId: string): void {
    const u = this.user();
    if (!u || this.busy()) return;
    this.busy.set(true);
    this.api.rotateKey(u.id, keyId).subscribe(({ plaintext }) => {
      this.revealedSecret.set(plaintext);
      this.mode.set('reveal');
      this.busy.set(false);
    });
  }

  /**
   * Revocación inmediata. Sin confirm dialog porque la action retorna
   * a estado `Revocada` (no destructiva — la entry permanece visible).
   * Si por error se revoca, el admin puede generar una key nueva con
   * mismo name + scopes en segundos vía "Generar nueva key".
   */
  protected revoke(keyId: string): void {
    const u = this.user();
    if (!u || this.busy()) return;
    this.busy.set(true);
    this.api.revokeKey(u.id, keyId).subscribe(() => {
      this.busy.set(false);
    });
  }

  protected dismissReveal(): void {
    this.mode.set('list');
    this.revealedSecret.set(null);
    this.copied.set(false);
  }

  /**
   * Copy-to-clipboard del secret. `navigator.clipboard` puede no estar
   * disponible (HTTP plano sin localhost, browsers viejos, iframes
   * sin permission policy). En esos casos el usuario debe seleccionar
   * manualmente — el text del secret está en un `<code>` selectable.
   */
  protected async copySecret(): Promise<void> {
    const s = this.revealedSecret();
    if (!s || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(s);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      // Permiso denegado o clipboard API no soportada — silent fail,
      // el usuario tiene el text seleccionable como fallback.
    }
  }

  protected statusSeverity(
    status: ApiKeyStatus,
  ): 'success' | 'warn' | 'secondary' {
    if (status === 'Activa') return 'success';
    if (status === 'Expirada') return 'warn';
    return 'secondary';
  }

  /**
   * Habilita Rotar/Revocar solo en keys activas. Las expiradas o
   * revocadas son read-only para auditoría — re-activar requiere
   * generar key nueva.
   */
  protected canMutate(status: ApiKeyStatus): boolean {
    return status === 'Activa';
  }

  /**
   * Form de creación válido — name no vacío y al menos un scope.
   * Mismo gating que `submitCreate` pero para `[disabled]` del button.
   */
  protected readonly canSubmit = computed(
    () => this.newKeyName().trim().length > 0 && this.newKeyScopes().length > 0,
  );
}
