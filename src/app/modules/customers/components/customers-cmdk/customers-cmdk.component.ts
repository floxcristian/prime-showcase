// Angular
import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  linkedSignal,
  model,
  output,
  PLATFORM_ID,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
// PrimeNG
import { Dialog } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { Tag } from 'primeng/tag';
// Local
import type { Customer } from '../../models/customer.interface';
import { CustomersPreferencesService } from '../../services/customers-preferences.service';
import { typeSeverity } from '../../utils/customers-format.util';

const NG_MODULES = [CommonModule, FormsModule];
const PRIME_MODULES = [Dialog, InputTextModule, Tag];

/** Cmd+K result group — sections rendered en el palette
 * (Recientes / Clientes / Acciones). Patrón Linear/Stripe/Notion:
 * categorical grouping aumenta scanability del listbox. */
export interface CmdkResultGroup {
  label: string;
  icon: string;
  items: Customer[];
}

/**
 * Cmd+K command palette — search-first surface canónico bigtech
 * (Linear, Stripe, Notion, Slack). Input al top, results live-filtered
 * abajo, ↑/↓ navega, Enter selecciona. v1: limitado a búsqueda de
 * clientes (top 8 by name/RUT/email match).
 *
 * **Qué vive acá**: query, active index, ranking, arrow-nav, scroll
 * into view y el focus del input al abrir — todo estado interno del
 * palette que el container no necesita conocer. Los recents persisten
 * en `CustomersPreferencesService` (root, único touchpoint de
 * localStorage del módulo) — este componente NO duplica esa lógica.
 *
 * **Qué NO vive acá**: `cmdkVisible` + el atajo `cmd+k` + la cascada
 * de `escape` quedan en el container (dueño de los shortcuts). El
 * container abre vía `open()` (ver JSDoc) y este componente cierra
 * escribiendo el model `visible` — two-way sync en ambos sentidos.
 */
@Component({
  selector: 'app-customers-cmdk',
  imports: [NG_MODULES, PRIME_MODULES],
  templateUrl: './customers-cmdk.component.html',
  styleUrl: './customers-cmdk.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomersCmdkComponent {
  private readonly prefs = inject(CustomersPreferencesService);
  private readonly injector = inject(Injector);
  /** Guard SSR canónico del repo (ver .claude/rules/ssr-and-runtime.md). */
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Dataset donde buscar — el container pasa `tableData()`. */
  readonly customers = input<readonly Customer[]>([]);

  /** Two-way con el container: `cmd+k`/`escape` lo escriben desde
   * afuera; seleccionar un resultado lo escribe desde adentro. */
  readonly visible = model<boolean>(false);

  /** Resultado elegido (click o Enter) — el container abre el detail
   * drawer (`openDetail`, que además escribe `?detail` en la URL). */
  readonly customerSelected = output<Customer>();

  /** Footer "Ver todos los atajos" — el container cierra el palette y
   * abre el help overlay (en ese orden, igual que antes del split). */
  readonly helpRequested = output<void>();

  protected readonly cmdkQuery = signal('');

  /** Active index dentro de cmdkResults — driven by arrow keys.
   * Patrón canónico bigtech (Linear/Stripe/Notion Cmd+K): ↑↓ navega,
   * Enter confirma. Sin esto el palette funciona como search box, no
   * como command palette.
   *
   * `linkedSignal` keyed en `cmdkQuery`: cada cambio del query resetea
   * el índice a 0 — sino el index puede quedar fuera de bounds tras
   * filtrar (ej: estaba en index=5, user tipea hasta dejar 2 results).
   * Mismo patrón que `page` en movies.component; sigue siendo writable
   * para arrow nav. */
  protected readonly cmdkActiveIndex = linkedSignal<string, number>({
    source: this.cmdkQuery,
    computation: () => 0,
  });

  /** ViewChild reactivo al `<input #cmdkInput>` del command palette.
   * Usado por effect que focusea el input cuando el dialog abre —
   * patrón a11y-friendly (no `autofocus` attribute, que la regla
   * `accessibility-no-positive-tabindex` y mejores prácticas WCAG
   * desaconsejan por interferir con screen reader announcements). */
  private readonly cmdkInputRef =
    viewChild<ElementRef<HTMLInputElement>>('cmdkInput');

  /** Listbox de resultados ref para scroll-into-view del active item. */
  private readonly cmdkListRef =
    viewChild<ElementRef<HTMLElement>>('cmdkList');

  /** Severity del tag de tipo — re-expuesto del util para que el
   * template movido no cambie. */
  protected readonly typeSeverity = typeSeverity;

  /**
   * Filtered customers para el Cmd+K palette — busca por nombre, RUT,
   * email. Case-insensitive, substring match con ranking:
   *   1. Exact match prefix > substring (Linear-style "starts with" boost)
   *   2. Recent hits first cuando query empty (Raycast frecency)
   * Top 8 para mantener UI manageable (Linear/Stripe limit similar).
   */
  protected readonly cmdkResults = computed<readonly CmdkResultGroup[]>(() => {
    const q = this.cmdkQuery().toLowerCase().trim();
    const data = this.customers();
    if (!q) {
      // Empty state — surface recent searches first, then top 5 más
      // recientes/relevantes del dataset. Los recents persisten en
      // `CustomersPreferencesService` (localStorage).
      const recentIds = this.prefs.cmdkRecentIds();
      const recent = recentIds
        .map((id) => data.find((c) => c.id === id))
        .filter((c): c is Customer => c != null)
        .slice(0, 5);
      const otherCustomers = data.filter((c) => !recentIds.includes(c.id)).slice(0, 8 - recent.length);
      const groups: CmdkResultGroup[] = [];
      if (recent.length > 0) {
        groups.push({ label: 'Recientes', icon: 'fa-clock-rotate-left', items: recent });
      }
      if (otherCustomers.length > 0) {
        groups.push({ label: 'Clientes', icon: 'fa-user', items: otherCustomers });
      }
      return groups;
    }

    const matches = data
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.rut.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q),
      )
      .map((c) => {
        // Ranking score: 100 si starts-with name, 50 si starts-with rut/email,
        // 10 si substring (default include). Higher = better.
        const name = c.name.toLowerCase();
        const rut = c.rut.toLowerCase();
        const email = c.email.toLowerCase();
        let score = 10;
        if (name.startsWith(q)) score = 100;
        else if (rut.startsWith(q) || email.startsWith(q)) score = 50;
        return { customer: c, score };
      })
      .sort((a, b) => b.score - a.score)
      .map((r) => r.customer)
      .slice(0, 8);

    if (matches.length === 0) return [];
    return [{ label: 'Clientes', icon: 'fa-user', items: matches }];
  });

  /** Flat list de items para arrow-key navigation. Combina todos los
   * grupos en un single linear sequence (matches el visual top-to-bottom
   * order). Used by `cmdkActiveIndex` para arrow nav + Enter select. */
  protected readonly cmdkFlatResults = computed<readonly Customer[]>(() =>
    this.cmdkResults().flatMap((g) => g.items),
  );

  constructor() {
    // Focus programático del input del Cmd+K palette al abrir. Patrón
    // a11y-correct vs `autofocus` attribute (que rompe screen reader
    // announcements y crea jumpy initial focus).
    //
    // `afterNextRender` reemplaza al `setTimeout(50)` mágico anterior:
    // Angular garantiza que corre DESPUÉS del próximo render del
    // browser, sin números arbitrarios. Si el user spamea Cmd+K, cada
    // toggle re-schedula el callback contra el siguiente frame; nunca
    // se acumulan timers en memoria. Patrón Angular 17+. El `Injector`
    // es el de ESTE componente — el contenido del `p-dialog` se crea
    // al abrir, por eso el effect sobre `visible()` (un
    // `afterNextRender` de constructor pelado correría antes de que
    // el input exista).
    effect(() => {
      if (!this.visible()) return;
      const ref = this.cmdkInputRef();
      if (!ref) return;
      afterNextRender(() => ref.nativeElement.focus(), {
        injector: this.injector,
      });
    });
  }

  /**
   * API imperativa mínima para el atajo `cmd+k` del container: resetea
   * query + índice ANTES de abrir — mismo orden que el `openCmdK`
   * original. Un reset via effect de apertura/cierre no replicaría el
   * caso "cmd+k con el palette YA abierto" (hoy re-limpia el query
   * sin cerrar); por eso el reset viaja con el open imperativo.
   */
  open(): void {
    this.cmdkQuery.set('');
    this.cmdkActiveIndex.set(0);
    this.visible.set(true);
  }

  /** Selección de un resultado — preserva el orden original: persistir
   * recent → abrir detail (via output) → cerrar palette. */
  protected selectCmdKResult(customer: Customer): void {
    this.prefs.pushCmdkRecent(customer.id);
    this.customerSelected.emit(customer);
    this.visible.set(false);
  }

  /** Arrow key nav handler. ↓ avanza, ↑ retrocede, wraps at edges
   * (patrón Linear: circular nav vs Stripe: stop at edges — pick
   * circular for fewer dead-end interactions). */
  protected onCmdkKeyDown(event: KeyboardEvent): void {
    const total = this.cmdkFlatResults().length;
    if (total === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.cmdkActiveIndex.update((i) => (i + 1) % total);
      this.scrollCmdkActiveIntoView();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.cmdkActiveIndex.update((i) => (i - 1 + total) % total);
      this.scrollCmdkActiveIntoView();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const customer = this.cmdkFlatResults()[this.cmdkActiveIndex()];
      if (customer) this.selectCmdKResult(customer);
    }
  }

  /** Scroll programático al active item — keep it visible mientras
   * user navega con flechas. Patrón Linear: smooth scroll dentro del
   * listbox, no afecta el outer scroll. */
  private scrollCmdkActiveIntoView(): void {
    if (!this.isBrowser) return;
    queueMicrotask(() => {
      const list = this.cmdkListRef()?.nativeElement;
      if (!list) return;
      const active = list.querySelector('[data-cmdk-active="true"]');
      if (active && 'scrollIntoView' in active) {
        (active as HTMLElement).scrollIntoView({
          block: 'nearest',
          behavior: 'smooth',
        });
      }
    });
  }
}
