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
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelect } from 'primeng/multiselect';
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
import { RolePermissionsDialogComponent } from './components/role-permissions-dialog/role-permissions-dialog.component';
import type { Role, RoleStatus, RoleType } from './models/role.interface';
import { RolesMockService } from './services/roles-mock.service';

const NG_MODULES = [CommonModule, FormsModule];
const PRIME_MODULES = [
  ButtonModule,
  InputTextModule,
  MultiSelect,
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
  RolePermissionsDialogComponent,
];

@Component({
  selector: 'app-roles',
  imports: [NG_MODULES, PRIME_MODULES, LOCAL_COMPONENTS],
  templateUrl: './roles.component.html',
  styleUrl: './roles.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'flex-1 h-full flex flex-col overflow-hidden border border-surface rounded-2xl p-6',
  },
})
export class RolesComponent {
  private api = inject(RolesMockService);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * Resource principal — `trackedResource()` empaqueta el pattern
   * compartido con users / customers / obs-uptime: rxResource +
   * loading/loadError + copia mutable para p-table + freshness
   * (`lastFetchedAt` + bump del TimeService) + retry con guard.
   */
  private readonly rolesData = trackedResource<Role>(() =>
    this.api.getRoles(),
  );
  protected readonly loading = this.rolesData.loading;
  protected readonly loadError = this.rolesData.loadError;
  protected readonly tableData = this.rolesData.rows;
  protected readonly lastFetchedAt = this.rolesData.lastFetchedAt;

  protected readonly typeOptions: RoleType[] = ['Sistema', 'Personalizado'];

  protected readonly statusOptions: { label: string; value: RoleStatus }[] = [
    { label: 'Activo', value: 'Activo' },
    { label: 'Inactivo', value: 'Inactivo' },
  ];

  /**
   * Passthrough config compartida para `<p-columnFilter>` — ver JSDoc
   * en `shared/tokens/table-tokens.ts`.
   */
  protected readonly columnFilterPt = COLUMN_FILTER_PT;

  /**
   * Métricas para el header — total de roles + count de usuarios
   * cubiertos. Suma los `userCount` de todos los roles activos: refleja
   * cuántos usuarios tienen al menos un role asignado (con dobles
   * conteos si tienen varios roles, pero el showcase no maneja
   * many-to-many).
   */
  protected readonly totalRoles = computed(() => this.tableData().length);
  protected readonly totalUsers = computed(() =>
    this.tableData().reduce((sum, r) => sum + r.userCount, 0),
  );

  protected readonly skeletonPlaceholders = [0, 1, 2, 3, 4];

  /**
   * Role activo del popover de fila — al clickear el botón de acciones
   * trackeamos el row para que las acciones (Editar permisos, Duplicar,
   * Eliminar) operen sobre ese role.
   */
  protected readonly activeRole = signal<Role | null>(null);

  /** Visibilidad del dialog de permisos. */
  protected readonly permissionsDialogVisible = signal(false);

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
    this.rolesData.retry();
  }

  /** Handle del reopen diferido — cancelado en destroy (constructor). */
  private popoverReopenTimer: ReturnType<typeof setTimeout> | null = null;

  protected displayPopover(e: MouseEvent, op: Popover, role: Role): void {
    this.activeRole.set(role);
    this.popoverReopenTimer = reopenPopover(e, op);
  }

  protected openPermissionsDialog(op: Popover): void {
    op.hide();
    this.permissionsDialogVisible.set(true);
  }

  /**
   * Severity del tag de estado:
   *   - Activo → success
   *   - Inactivo → secondary (chrome plomo, no danger — un role
   *     inactivo no es un error)
   */
  protected statusSeverity(status: RoleStatus): 'success' | 'secondary' {
    return status === 'Activo' ? 'success' : 'secondary';
  }

  /**
   * Severity del tag de tipo:
   *   - Sistema → undefined (primary color, énfasis en built-in del
   *     producto que no se puede eliminar).
   *   - Personalizado → secondary (chrome plomo, role del cliente).
   */
  protected typeSeverity(type: RoleType): 'secondary' | undefined {
    return type === 'Sistema' ? undefined : 'secondary';
  }

  /**
   * Resumen agregado de permisos del role — usado en el cell de
   * "Permisos" para que el admin vea de un vistazo "5 admin / 2 write
   * / 4 read / 6 sin acceso" sin abrir el dialog.
   */
  protected permissionSummary(role: Role): string {
    const counts = { admin: 0, write: 0, read: 0, none: 0 };
    for (const p of role.permissions) {
      counts[p.level] += 1;
    }
    const accessible =
      counts.admin + counts.write + counts.read;
    const total = accessible + counts.none;
    return `${accessible}/${total} módulos`;
  }
}
