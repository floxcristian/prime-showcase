// Angular
import { isPlatformBrowser } from '@angular/common';
import {
  computed,
  inject,
  Injectable,
  PLATFORM_ID,
  signal,
  type Signal,
} from '@angular/core';

/** Density mode del table — affects body/header cell padding. */
export type TableDensity = 'compact' | 'comfortable';

const DENSITY_KEY = 'customers:density';
const CMDK_RECENT_KEY = 'customers:cmdk-recent:v1';
const CMDK_RECENT_MAX = 5;

/**
 * Preferencias persistidas del módulo customers — densidad de tabla y
 * recents del Cmd+K palette. Es el ÚNICO lugar del módulo que toca
 * `localStorage`: los `try/catch` silenciosos y el guard SSR viven
 * acá, centralizados, en vez de repetirse por componente.
 *
 * Root-scoped: la preferencia sobrevive navegaciones dentro de la SPA
 * (el componente customers se destruye/recrea por ruta) y la misma
 * instancia sirve al container y a los subcomponentes (cmdk).
 */
@Injectable({ providedIn: 'root' })
export class CustomersPreferencesService {
  /** Guard SSR canónico del repo (ver .claude/rules/ssr-and-runtime.md).
   * Debe declararse ANTES de cualquier field initializer que lo lea
   * (`_density`, `_cmdkRecentIds`). */
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  // ── Density toggle (Compact/Comfortable) ───────────────────────────
  //
  // Patrón Cloudscape/MUI/Material-React-Table: usuario elige densidad
  // del table para maximizar info-per-screen (Compact: 8 rows visible
  // en lugar de 6) o legibilidad (Comfortable: padding generoso, ideal
  // para data entry largo). Persist en localStorage para que la
  // preferencia sobreviva sessions.

  private readonly _density = signal<TableDensity>(
    this.readDensityFromStorage(),
  );

  readonly density: Signal<TableDensity> = this._density.asReadonly();

  /**
   * PrimeNG design tokens dinámicos para `<p-table>` según densidad.
   * Bind via `[dt]="prefs.densityDt()"` — PrimeNG aplica padding/font
   * tokens al table runtime sin necesidad de CSS custom.
   *
   * Valores calibrados por measurement de row floor:
   *   - El row floor estaba dominado por el botón ··· (40px) → reducir
   *     solo cell padding daba 8px ahorro (~12%), imperceptible.
   *   - Linear/Stripe/Notion compact: row ~36-40px (vs ~56-64px normal).
   *     Para llegar ahí necesitamos reducir padding Y escalar el row
   *     content (··· button → h-7, font-size, line-height).
   *   - El scaling extra del row content vive en `styles.scss` bajo
   *     `.customers-table--compact` (descendant selectors). El padding
   *     vive acá vía dt tokens.
   *
   * Comfortable: padding default de PrimeNG (0.75rem 1rem) — row ~56px.
   * Compact: padding agresivo (0.25rem 0.75rem) + row content scaled
   * via class → row ~36px. ~36% reducción, claramente visible.
   */
  readonly densityDt: Signal<Record<string, unknown>> = computed(() => {
    const d = this._density();
    if (d === 'compact') {
      return {
        bodyCell: { padding: '0.25rem 0.75rem' },
        headerCell: { padding: '0.375rem 0.75rem' },
      };
    }
    // Comfortable — PrimeNG default padding (0.75rem 1rem)
    return {};
  });

  setDensity(value: TableDensity): void {
    this._density.set(value);
    if (this.isBrowser) {
      try {
        localStorage.setItem(DENSITY_KEY, value);
      } catch {
        // ignore
      }
    }
  }

  /**
   * Density binary toggle — cicla entre Compacto y Cómodo en un solo
   * click. Reemplaza al `<p-popover>` de 2 opciones que tenía:
   *
   *   1. **UX problem**: un popover con 2 botones para alternar entre
   *      2 estados es overkill. Linear/Notion/Vercel resuelven density
   *      como toggle directo (1 click), no submenú.
   *   2. **Trigger race**: `popover.toggle($event)` choca con el
   *      outside-click handler de PrimeNG. Mousedown del trigger
   *      cierra el popover (lo considera "fuera del overlay"), después
   *      el click event ve estado=cerrado y re-abre. Resultado: click
   *      sobre trigger nunca cierra. Reproducido empíricamente con 6
   *      clicks consecutivos — todos open=true.
   *   3. **Flex gap fantasma**: el `<p-popover>` como sibling en el
   *      flex toolbar consumía 12px (gap-3) extra antes y después,
   *      desbalanceando el ritmo entre density-button y "Crear cliente"
   *      (24px vs 12px del resto).
   *
   * Convención del icon: muestra el NEXT state — mismo patrón que el
   * dark-mode toggle del toolbar global (fa-sun cuando dark, fa-moon
   * cuando light). Click → me llevará a ese estado.
   */
  toggleDensity(): void {
    this.setDensity(this._density() === 'compact' ? 'comfortable' : 'compact');
  }

  /** Icon que representa el NEXT state — patrón forward-affordance. */
  readonly densityToggleIcon: Signal<string> = computed(() =>
    this._density() === 'compact'
      ? 'fa-sharp fa-regular fa-table-rows'
      : 'fa-sharp fa-regular fa-bars',
  );

  /** Tooltip descriptivo: estado actual + acción del click. Patrón
   * Linear/Stripe — el usuario sabe dónde está y a dónde va. */
  readonly densityToggleTooltip: Signal<string> = computed(() =>
    this._density() === 'compact'
      ? 'Densidad compacta · clic para vista cómoda'
      : 'Densidad cómoda · clic para vista compacta',
  );

  private readDensityFromStorage(): TableDensity {
    if (!this.isBrowser) return 'comfortable';
    try {
      const raw = localStorage.getItem(DENSITY_KEY);
      if (raw === 'compact' || raw === 'comfortable') {
        return raw;
      }
    } catch {
      // ignore
    }
    return 'comfortable';
  }

  // ── Cmd+K recents ──────────────────────────────────────────────────

  /** Recent search hits — top customers IDs visitados via Cmd+K.
   * Surfaced en el palette cuando el query está vacío. Patrón Raycast/
   * Linear: frecency context replaces "empty state". Los IDs de
   * `Customer` son `number`. */
  private readonly _cmdkRecentIds = signal<readonly number[]>(
    this.readCmdkRecent(),
  );

  readonly cmdkRecentIds: Signal<readonly number[]> =
    this._cmdkRecentIds.asReadonly();

  pushCmdkRecent(id: number): void {
    if (!this.isBrowser) return;
    const current = this._cmdkRecentIds().filter((x) => x !== id);
    const updated = [id, ...current].slice(0, CMDK_RECENT_MAX);
    this._cmdkRecentIds.set(updated);
    try {
      localStorage.setItem(CMDK_RECENT_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
  }

  private readCmdkRecent(): readonly number[] {
    if (!this.isBrowser) return [];
    try {
      const raw = localStorage.getItem(CMDK_RECENT_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((id): id is number => typeof id === 'number');
    } catch {
      return [];
    }
  }
}
