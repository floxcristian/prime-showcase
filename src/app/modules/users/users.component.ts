// Angular
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
// PrimeNG
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelect } from 'primeng/multiselect';
import { OverlayBadgeModule } from 'primeng/overlaybadge';
import type { Popover } from 'primeng/popover';
import { PopoverModule } from 'primeng/popover';
import { Skeleton } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
// Local
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { TableFilterShellComponent } from '../../shared/components/table-filter-shell/table-filter-shell.component';
import { TooltipDismissOnClickDirective } from '../../shared/directives/tooltip-dismiss-on-click.directive';
import { RelativeTimePipe } from '../../shared/pipes/relative-time.pipe';
import { UserApiKeysDialogComponent } from './components/user-api-keys-dialog/user-api-keys-dialog.component';
import type { User, UserRole, UserStatus, UserType } from './models/user.interface';
import { UsersMockService } from './services/users-mock.service';

const NG_MODULES = [CommonModule, FormsModule];
const PRIME_MODULES = [
  AvatarModule,
  ButtonModule,
  InputTextModule,
  MultiSelect,
  OverlayBadgeModule,
  PopoverModule,
  Skeleton,
  TableModule,
  Tag,
  TooltipModule,
];
const LOCAL_COMPONENTS = [
  EmptyStateComponent,
  TableFilterShellComponent,
  TooltipDismissOnClickDirective,
  RelativeTimePipe,
  UserApiKeysDialogComponent,
];

@Component({
  selector: 'app-users',
  imports: [NG_MODULES, PRIME_MODULES, LOCAL_COMPONENTS],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'flex-1 h-full flex flex-col overflow-hidden border border-surface rounded-2xl p-6',
  },
})
export class UsersComponent {
  private api = inject(UsersMockService);

  /**
   * Resource principal — fetch del backend (mock con delay 800-1800ms).
   * Mismo pattern que customers / obs-uptime: rxResource expone `value`,
   * `isLoading`, `error`, `reload()`.
   */
  protected readonly usersResource = rxResource({
    stream: () => this.api.getUsers(),
  });
  protected readonly loading = computed(() => this.usersResource.isLoading());
  protected readonly loadError = computed(() => this.usersResource.error());

  /**
   * Rows visibles — derivado del resource. Mientras `value()` es
   * undefined (initial fetch), retorna array vacío para que el p-table
   * muestre el `#loadingbody` con skeletons via `[loading]="loading()"`.
   */
  protected readonly tableData = computed<readonly User[]>(() => this.usersResource.value() ?? []);

  /**
   * Lista deduplicada de organizaciones (departamentos para internos +
   * empresas para externos) — para el `<p-columnFilter>` multiselect.
   */
  protected readonly availableOrganizations = computed<string[]>(() =>
    Array.from(new Set(this.tableData().map((u) => u.organization))).sort(),
  );

  /**
   * Roles que están presentes en la sesión actual — derivados de la data
   * para no listar opciones huérfanas. Sort alfabético para escaneo
   * predecible en el filter dropdown.
   */
  protected readonly availableRoles = computed<UserRole[]>(
    () => Array.from(new Set(this.tableData().map((u) => u.role))).sort() as UserRole[],
  );

  /**
   * Tipo de usuario — set cerrado de 2 valores. Hardcoded en lugar de
   * derivar de la data porque siempre queremos mostrar las 2 opciones
   * aunque temporalmente solo haya rows de un tipo.
   */
  protected readonly typeOptions: UserType[] = ['Interno', 'Externo'];

  /**
   * Status options con label en español. Hardcoded — el set es cerrado
   * (`'Activo' | 'Inactivo' | 'Pendiente'`).
   */
  protected readonly statusOptions: { label: string; value: UserStatus }[] = [
    { label: 'Activo', value: 'Activo' },
    { label: 'Inactivo', value: 'Inactivo' },
    { label: 'Pendiente', value: 'Pendiente' },
  ];

  /**
   * Passthrough config para `<p-columnFilter>` — alineado con customers
   * y obs-uptime. `pcFilterClearButton` aplica `.p-button-tonal`
   * (Material 3 secondary) y `filterButtonBar` agrupa los botones a
   * la derecha con gap-2.
   */
  protected readonly columnFilterPt = {
    pcFilterClearButton: { root: { class: 'p-button-tonal' } },
    filterButtonBar: { class: '!justify-end gap-2' },
  };

  protected selectedRows = signal<readonly User[]>([]);

  /**
   * Timestamp del último fetch exitoso — feedback de freshness en la
   * toolbar. Sincronizado vía `effect()` con cada emisión del resource.
   */
  private readonly _lastFetchedAt = signal<string | null>(null);
  protected readonly lastFetchedAt = this._lastFetchedAt.asReadonly();

  /** Placeholder rows para `#loadingbody`. */
  protected readonly skeletonPlaceholders = [0, 1, 2, 3, 4];

  /**
   * Conteo derivado para el count pill del header. "X de Y activos" da
   * más contexto que un solo número absoluto — el SRE/admin entiende
   * inmediatamente la fracción saludable de la base.
   */
  protected readonly activeCount = computed(() => this.tableData().filter((u) => u.status === 'Activo').length);
  protected readonly totalCount = computed(() => this.tableData().length);

  constructor() {
    effect(() => {
      const val = this.usersResource.value();
      if (val !== undefined && !this.usersResource.isLoading()) {
        this._lastFetchedAt.set(new Date().toISOString());
      }
    });
  }

  protected retry(): void {
    if (this.usersResource.isLoading()) return;
    this.usersResource.reload();
  }

  /**
   * Severity del tag de estado — mapping semántico:
   *   - Activo → success (verde)
   *   - Pendiente → warn (amarillo): user invitado pero no completó el
   *     onboarding o falta aprobación de admin.
   *   - Inactivo → danger (rojo): cuenta deshabilitada.
   */
  protected statusSeverity(status: UserStatus): 'success' | 'warn' | 'danger' {
    if (status === 'Activo') return 'success';
    if (status === 'Pendiente') return 'warn';
    return 'danger';
  }

  /**
   * Severity del tag de tipo — `Interno` con default (primary color,
   * énfasis del dominio: empleados de la empresa), `Externo` con
   * `secondary` (chrome neutro: partners/auditores son visitantes
   * en el sistema). Patrón Stripe Connect / Linear members: tipo de
   * cuenta como tag visual con tonalidad jerárquica.
   *
   * Retorna `undefined` para Internos: PrimeNG `<p-tag>` sin severity
   * usa el primary color del tema. No existe valor literal "primary"
   * en el API del componente.
   */
  protected typeSeverity(type: UserType): 'secondary' | undefined {
    return type === 'Interno' ? undefined : 'secondary';
  }

  /**
   * User activo del popover de fila — al clickear el botón de acciones
   * trackeamos el row para que las acciones (Detalles, Suspender,
   * Gestionar API keys) operen sobre ese user. Sin esto, el popover
   * sería estático y no podría diferenciar acciones por row.
   */
  protected readonly activeUser = signal<User | null>(null);

  /** Visibilidad del dialog de API keys — driven by user click. */
  protected readonly apiKeysDialogVisible = signal(false);

  protected displayPopover(e: MouseEvent, op: Popover, user: User): void {
    this.activeUser.set(user);
    op.hide();
    setTimeout(() => {
      op.show(e);
    }, 150);
  }

  /**
   * Abre el dialog de API keys para el `activeUser`. Solo aplica a
   * externos — los internos usan SSO/OAuth corporativo y no manejan
   * API keys directas. El template guardea la action via
   * `@if (activeUser()?.type === 'Externo')`.
   */
  protected openApiKeysDialog(op: Popover): void {
    op.hide();
    this.apiKeysDialogVisible.set(true);
  }
}
