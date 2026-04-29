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
import { Select } from 'primeng/select';
import { Tag } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';

import { TooltipDismissOnClickDirective } from '../../../../shared/directives/tooltip-dismiss-on-click.directive';
import { PERMISSION_MODULES } from '../../mocks/permission-modules';
import type {
  AccessLevel,
  ModulePermission,
  Role,
} from '../../models/role.interface';
import { RolesMockService } from '../../services/roles-mock.service';

const NG_MODULES = [CommonModule, FormsModule];
const PRIME_MODULES = [ButtonModule, Dialog, Select, Tag, TooltipModule];

interface LevelOption {
  label: string;
  value: AccessLevel;
}

/**
 * Dialog editor de permisos de un role. Muestra la lista de módulos del
 * dashboard con un selector de nivel por cada uno. El estado pendiente
 * vive en un `Map<moduleId, level>` interno hasta que el admin clickea
 * "Guardar" — sin save, los cambios no persisten (cancel los descarta).
 *
 * Patrón AWS IAM editor / GitHub team permissions: lista de recursos
 * scrolleable con selector compacto por fila. La granularidad es por
 * módulo (no por acción individual) — modelo jerárquico inclusivo
 * de 4 niveles (`none → read → write → admin`).
 */
@Component({
  selector: 'app-role-permissions-dialog',
  imports: [NG_MODULES, PRIME_MODULES, TooltipDismissOnClickDirective],
  templateUrl: './role-permissions-dialog.component.html',
  styleUrl: './role-permissions-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RolePermissionsDialogComponent {
  private api = inject(RolesMockService);

  readonly role = input<Role | null>(null);
  readonly visible = model<boolean>(false);

  protected readonly modules = PERMISSION_MODULES;

  /**
   * Opciones del dropdown por módulo. Labels en español, values
   * matchean el `AccessLevel` union — typed-safe end-to-end.
   */
  protected readonly levelOptions: LevelOption[] = [
    { label: 'Sin acceso', value: 'none' },
    { label: 'Lectura', value: 'read' },
    { label: 'Escritura', value: 'write' },
    { label: 'Administrador', value: 'admin' },
  ];

  /**
   * State pendiente de la edición — Map para lookup O(1) por moduleId.
   * Se sembra desde `role.permissions` cuando el dialog abre. El admin
   * puede cambiar valores; sólo "Guardar" persiste al service.
   *
   * Map en lugar de array de ModulePermission porque el editor pide
   * lookups y updates por moduleId — Map es la estructura natural.
   * Convertimos a array al guardar.
   */
  protected readonly pendingLevels = signal<Map<string, AccessLevel>>(
    new Map(),
  );

  /** True cuando hay diferencias pendientes vs el state original. */
  protected readonly isDirty = computed(() => {
    const r = this.role();
    if (!r) return false;
    const pending = this.pendingLevels();
    for (const p of r.permissions) {
      const pendingLevel = pending.get(p.moduleId);
      if (pendingLevel !== undefined && pendingLevel !== p.level) return true;
    }
    return false;
  });

  /**
   * Resumen de niveles concedidos — chips informativos arriba del editor.
   * Útil para que el admin vea de un vistazo "este role tiene 5 módulos
   * con admin, 3 con write, 2 con read, 7 sin acceso" antes de scrollear
   * la lista entera.
   */
  protected readonly levelCounts = computed(() => {
    const pending = this.pendingLevels();
    const counts: Record<AccessLevel, number> = {
      none: 0,
      read: 0,
      write: 0,
      admin: 0,
    };
    for (const moduleId of this.modules.map((m) => m.id)) {
      const level = pending.get(moduleId) ?? 'none';
      counts[level] += 1;
    }
    return counts;
  });

  protected readonly saving = signal(false);

  constructor() {
    // Seed del state pendiente cuando el dialog abre con un role válido.
    // Sin esto, abrir el dialog mostraría el último set editado en lugar
    // del state actual del role.
    effect(() => {
      const r = this.role();
      const isOpen = this.visible();
      if (isOpen && r) {
        const map = new Map<string, AccessLevel>();
        for (const p of r.permissions) {
          map.set(p.moduleId, p.level);
        }
        // Garantizar entry para cada módulo aunque el role no lo declare
        // (defensivo contra mocks viejos / drift entre catálogo y data).
        for (const m of this.modules) {
          if (!map.has(m.id)) map.set(m.id, 'none');
        }
        this.pendingLevels.set(map);
      }
    });
  }

  /**
   * Lee el nivel pendiente para un módulo. Default a 'none' si no hay
   * entry (no debería pasar después del seed, pero defensive).
   */
  protected levelFor(moduleId: string): AccessLevel {
    return this.pendingLevels().get(moduleId) ?? 'none';
  }

  protected setLevel(moduleId: string, level: AccessLevel): void {
    this.pendingLevels.update((prev) => {
      const next = new Map(prev);
      next.set(moduleId, level);
      return next;
    });
  }

  /**
   * Bulk: aplica un nivel a TODOS los módulos. Útil para "Conceder
   * lectura completa" o "Revocar todo" en un solo click. Patrón AWS IAM
   * "Set all to" — gobernanza simplificada para roles built-in.
   */
  protected setAll(level: AccessLevel): void {
    this.pendingLevels.update(() => {
      const next = new Map<string, AccessLevel>();
      for (const m of this.modules) {
        next.set(m.id, level);
      }
      return next;
    });
  }

  protected save(): void {
    const r = this.role();
    if (!r || this.saving()) return;
    this.saving.set(true);
    const permissions: ModulePermission[] = this.modules.map((m) => ({
      moduleId: m.id,
      level: this.levelFor(m.id),
    }));
    this.api.updatePermissions(r.id, permissions).subscribe(() => {
      this.saving.set(false);
      this.visible.set(false);
    });
  }

  protected cancel(): void {
    if (this.saving()) return;
    this.visible.set(false);
  }

  protected levelTagSeverity(
    level: AccessLevel,
  ): 'success' | 'info' | 'warn' | 'secondary' {
    if (level === 'admin') return 'warn';
    if (level === 'write') return 'success';
    if (level === 'read') return 'info';
    return 'secondary';
  }

  protected levelLabel(level: AccessLevel): string {
    return (
      this.levelOptions.find((o) => o.value === level)?.label ?? 'Sin acceso'
    );
  }
}
