// Angular
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
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
import { LoadErrorStateComponent } from '../../shared/components/load-error-state/load-error-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { RefreshToolbarComponent } from '../../shared/components/refresh-toolbar/refresh-toolbar.component';
import { StaleDataBannerComponent } from '../../shared/components/stale-data-banner/stale-data-banner.component';
import { TableFilterShellComponent } from '../../shared/components/table-filter-shell/table-filter-shell.component';
import { TooltipDismissOnClickDirective } from '../../shared/directives/tooltip-dismiss-on-click.directive';
import { RelativeTimePipe } from '../../shared/pipes/relative-time.pipe';
import { COLUMN_FILTER_PT } from '../../shared/tokens/table-tokens';
import { reopenPopover } from '../../shared/utils/popover';
import { trackedResource } from '../../shared/utils/tracked-resource';
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
  LoadErrorStateComponent,
  PageHeaderComponent,
  RefreshToolbarComponent,
  StaleDataBannerComponent,
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
    class:
      'flex-1 h-full flex flex-col overflow-hidden border border-surface rounded-2xl p-6',
  },
})
export class UsersComponent {
  private api = inject(UsersMockService);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * Resource principal — fetch del backend (mock con delay 800-1800ms).
   * `trackedResource()` empaqueta el pattern compartido con roles /
   * customers / obs-uptime: rxResource + loading/loadError + copia
   * mutable para p-table + freshness (`lastFetchedAt` + bump del
   * TimeService) + retry con guard.
   */
  private readonly usersData = trackedResource<User>(() =>
    this.api.getUsers(),
  );
  protected readonly loading = this.usersData.loading;
  protected readonly loadError = this.usersData.loadError;
  protected readonly tableData = this.usersData.rows;
  protected readonly lastFetchedAt = this.usersData.lastFetchedAt;

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
  protected readonly availableRoles = computed<UserRole[]>(() =>
    Array.from(new Set(this.tableData().map((u) => u.role))).sort() as UserRole[],
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
   * Passthrough config compartida para `<p-columnFilter>` — ver JSDoc
   * en `shared/tokens/table-tokens.ts`.
   */
  protected readonly columnFilterPt = COLUMN_FILTER_PT;

  protected selectedRows = signal<readonly User[]>([]);

  /** Placeholder rows para `#loadingbody`. */
  protected readonly skeletonPlaceholders = [0, 1, 2, 3, 4];

  /**
   * Conteo derivado para el count pill del header. "X de Y activos" da
   * más contexto que un solo número absoluto — el SRE/admin entiende
   * inmediatamente la fracción saludable de la base.
   */
  protected readonly activeCount = computed(
    () => this.tableData().filter((u) => u.status === 'Activo').length,
  );
  protected readonly totalCount = computed(() => this.tableData().length);

  constructor() {
    // Cancela un reopen de popover pendiente si el componente se
    // destruye dentro de la ventana de 150ms (ver shared/utils/popover).
    this.destroyRef.onDestroy(() => {
      if (this.popoverReopenTimer !== null) {
        clearTimeout(this.popoverReopenTimer);
        this.popoverReopenTimer = null;
      }
    });
  }

  protected retry(): void {
    this.usersData.retry();
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

  /** Handle del reopen diferido — cancelado en destroy (constructor). */
  private popoverReopenTimer: ReturnType<typeof setTimeout> | null = null;

  protected displayPopover(e: MouseEvent, op: Popover, user: User): void {
    this.activeUser.set(user);
    this.popoverReopenTimer = reopenPopover(e, op);
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
