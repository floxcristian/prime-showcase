import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  PLATFORM_ID,
  signal,
  ViewChild,
} from '@angular/core';

import { ButtonModule } from 'primeng/button';
import { Popover, PopoverModule } from 'primeng/popover';
import { Tag } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';

import { TooltipDismissOnClickDirective } from '../../directives/tooltip-dismiss-on-click.directive';
import { ColumnHelpInstance, ColumnHelpService } from './column-help.service';

/**
 * Entry para una leyenda de columna codificada. `code` es el valor
 * mostrado en el cell (ej. "A1"), `label` es el nombre legible
 * ("Excelente"), `description` es una glosa de 1 línea.
 *
 * `severity` matchea el del `<p-tag>` para renderizar el chip de
 * referencia con el mismo color que aparece en la celda.
 */
export interface ColumnHelpEntry {
  code: string;
  label: string;
  description?: string;
  severity?: 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast';
}

/**
 * Help icon (`ⓘ`) que se planta junto al header de una columna y abre
 * un popover con la legend completa de los valores codificados.
 *
 * **Trigger híbrido (patrón bigtech)**:
 *   - Desktop (`hover: hover`): hover muestra el popover, mouse leave
 *     lo cierra (con delay de 200ms para permitir moverse al
 *     contenido). Click sigue funcionando como toggle "sticky open".
 *   - Touch (`hover: none`): click toggle, hover ignorado.
 *
 * **Single instance**: vía `ColumnHelpService` — abrir un popover
 * cierra automáticamente cualquier otro abierto. Evita el visual
 * mess de múltiples leyendas simultáneas.
 *
 * **Click outside**: PrimeNG `dismissable=true` (default) cierra
 * cuando el user clickea fuera del popover.
 */
@Component({
  selector: 'app-column-help',
  imports: [ButtonModule, PopoverModule, Tag, TooltipModule, TooltipDismissOnClickDirective],
  template: `
    <!--
      Span wrapper con pTooltip para satisfacer
      no-icon-button-without-tooltip (icon-only buttons requieren
      label visible). p-button no expone pTooltipDisabled como input
      forward — wrapping en span da control completo sobre la
      directive de tooltip. [pTooltipDisabled]="isOpen()" oculta el
      tooltip mientras el popover está visible — sino "Ver leyenda"
      flotaría sobre la legend que ya se está mostrando.
    -->
    <span #trigger class="inline-flex" pTooltip="Ver leyenda" [tooltipDisabled]="isOpen()" tooltipPosition="top">
      <p-button
        icon="fa-sharp fa-regular fa-circle-info"
        severity="secondary"
        [text]="true"
        [rounded]="true"
        ariaLabel="Ver leyenda"
        (onClick)="onTriggerClick($event)"
        (mouseenter)="onTriggerEnter($event)"
        (mouseleave)="onTriggerLeave()"
      />
    </span>
    <p-popover
      #op
      appendTo="body"
      styleClass="column-help-popover"
      (onShow)="onPopoverShow()"
      (onHide)="onPopoverHide()"
    >
      <ng-template #content>
        <!--
          w-96 (384px) es el ancho bigtech estándar para column help
          popovers (Stripe ~360-400, Linear ~360, GitHub ~320,
          Datadog ~400). Multi-line layout (label en bold sobre línea
          propia, descripción muted debajo) — patrón canónico cuando
          hay descripción rica: hierarquía visual clara, no requiere
          truncation, popover compacto en horizontal.
        -->
        <div class="w-96 max-w-[calc(100vw-2rem)]" (mouseenter)="onContentEnter()" (mouseleave)="onContentLeave()">
          <h3 class="text-color font-bold leading-6 mb-1">
            {{ title() }}
          </h3>
          @if (description(); as desc) {
            <p class="text-muted-color text-sm leading-5 mb-2">{{ desc }}</p>
          }
          <!--
            Multi-line layout: label en bold ocupa una línea completa,
            descripción muted debajo. Patrón canónico bigtech (Linear,
            Stripe Sigma, GitHub) cuando hay descripción rica — la
            hierarquía visual de 3 niveles (tag > label > description)
            se lee inmediatamente.

            Por qué CSS Grid en lugar de flex per-row: con
            grid-cols-[auto_1fr] la columna 1 (chips) se dimensiona
            al max-content de TODOS los rows, así que chips de ancho
            variable (RECURRENTE / FUGADO / PELIGRO FUGA en lifecycle)
            renderizan todos al mismo width = el del más ancho. Los
            labels arrancan a la misma x-position cross-row → alineación
            perfecta sin medición JS ni min-w hardcodeado por legend.
            Tailwind class="contents" en li preserva HTML semántico
            (ul/li) mientras los hijos se convierten en grid items
            directos del ul.

            Template ref #legendList permite aplicar maxHeight
            dinámicamente desde positionPopover() cuando el contenido
            excede el espacio disponible debajo del trigger. Al ser
            scroll interno SOLO al ul (no al popover root), el arrow
            ::before del popover se mantiene visible.
          -->
          <ul #legendList class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2" [class.mt-2]="!description()">
            @for (entry of entries(); track entry.code) {
              <li class="contents">
                <p-tag
                  [severity]="entry.severity"
                  [value]="entry.code"
                  class="font-medium mt-0.5 min-w-10 justify-center self-start"
                />
                <div class="min-w-0">
                  <div class="text-color font-medium leading-6">
                    {{ entry.label }}
                  </div>
                  @if (entry.description) {
                    <div class="text-muted-color text-sm leading-5">
                      {{ entry.description }}
                    </div>
                  }
                </div>
              </li>
            }
          </ul>
        </div>
      </ng-template>
    </p-popover>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ColumnHelpComponent implements ColumnHelpInstance {
  private platformId = inject(PLATFORM_ID);
  private helpService = inject(ColumnHelpService);
  private hostEl = inject(ElementRef<HTMLElement>);

  readonly title = input.required<string>();
  readonly description = input<string | undefined>(undefined);
  readonly entries = input.required<readonly ColumnHelpEntry[]>();

  @ViewChild('op') private popover!: Popover;
  @ViewChild('trigger', { read: ElementRef })
  private triggerEl!: ElementRef<HTMLElement>;

  /**
   * `true` si el dispositivo soporta hover real (mouse). Detectado
   * vía `matchMedia('(hover: hover)')` — la API estándar para
   * distinguir dispositivos hover-capable de touch-only.
   *
   * En SSR `window` no existe, por eso el guard `isPlatformBrowser`
   * y default `false` (touch) — el browser hidrata después con el
   * valor real.
   */
  private readonly canHover = signal(false);

  /**
   * Timer del hide diferido. Cancelable cuando el user mueve el mouse
   * al contenido del popover (para que no se cierre mientras lee).
   * 200ms es el sweet spot bigtech: suficiente para cruzar el gap
   * entre button y popover, no tanto que sienta lag.
   */
  private hideTimer?: ReturnType<typeof setTimeout>;
  private static readonly HIDE_DELAY_MS = 200;

  /**
   * Tracking del estado open. Signal para que el template lo lea
   * reactivamente — `[pTooltipDisabled]="isOpen()"` desactiva el
   * tooltip de "Ver leyenda" mientras el popover está visible.
   */
  protected readonly isOpen = signal(false);

  constructor() {
    // Solo browser real: `isPlatformBrowser` es true tanto en producción
    // como en jsdom (vitest), pero jsdom NO implementa `matchMedia`. El
    // typeof check distingue ambos sin shimear matchMedia globalmente
    // (un mock en setup contaminaría cualquier futuro consumer que sí
    // dependa del valor real). En jsdom el componente se monta con
    // `canHover = false` (touch-style), que es el comportamiento safe
    // por default para tests.
    if (
      isPlatformBrowser(this.platformId) &&
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function'
    ) {
      this.canHover.set(window.matchMedia('(hover: hover)').matches);
    }
  }

  // ── Click trigger (universal: desktop + touch) ────────────────────

  protected onTriggerClick(event: Event): void {
    // stopPropagation evita que el click burbujee al `<th>` con
    // pSortableColumn — sin esto, abrir la legend también triggerea
    // sort de la columna.
    event.stopPropagation();
    this.cancelHide();
    if (this.isOpen()) {
      this.popover.hide();
    } else {
      this.open(event);
    }
  }

  // ── Hover triggers (solo desktop con mouse) ───────────────────────

  protected onTriggerEnter(event: Event): void {
    if (!this.canHover()) return;
    this.cancelHide();
    if (!this.isOpen()) {
      this.open(event);
    }
  }

  protected onTriggerLeave(): void {
    if (!this.canHover()) return;
    this.scheduleHide();
  }

  protected onContentEnter(): void {
    // Always cancel hide cuando entra al popover, incluso en touch
    // (defensive: si por algún motivo el hover registró, no debe
    // cerrar mientras el user está leyendo).
    this.cancelHide();
  }

  protected onContentLeave(): void {
    if (!this.canHover()) return;
    this.scheduleHide();
  }

  // ── Popover lifecycle ─────────────────────────────────────────────

  /**
   * Override del positioning de PrimeNG en `(onShow)` para
   * garantizar que el arrow SIEMPRE apunte al centro del trigger ⓘ,
   * sea que el popover quede abajo (preferido) o arriba (fallback
   * cuando no entra abajo). PrimeNG calcula posición + flip auto
   * pero su arrow.left puede quedar desalineado en edge cases.
   *
   * **Estrategia smart positioning** (patrón Linear / Stripe / GitHub):
   *   1. Si el popover entra debajo → abajo (preferido).
   *   2. Si no entra abajo y entra arriba → arriba (flipped).
   *   3. Si no entra en ninguno → el lado con más espacio.
   *
   * Forzar siempre-abajo causaba overflow vertical y doble scrollbar
   * cuando el trigger estaba cerca del bottom del viewport.
   *
   * Se ejecuta en `requestAnimationFrame` después del onShow para
   * que PrimeNG ya haya posicionado el container — luego se override
   * con cálculo manual basado en el bounding rect del trigger.
   */
  protected onPopoverShow(): void {
    requestAnimationFrame(() => this.positionPopover());
  }

  protected onPopoverHide(): void {
    this.isOpen.set(false);
    this.helpService.notifyClose(this);
  }

  /**
   * Implementación de `ColumnHelpInstance` — usado por el service
   * para cerrar esta instancia cuando otra se abre.
   *
   * **Hide instantáneo (no animado):** PrimeNG popover.hide() tiene
   * una animación de ~250ms (opacity + scale fade-out). Si el user
   * clickea button B mientras A está visible, A's hide animation
   * todavía está corriendo cuando B abre → ambos popovers visibles
   * simultáneamente por ~250ms → UX confuso ("¿cuál estoy viendo?").
   *
   * Override: setear opacity=0 + visibility=hidden + display=none
   * inmediatamente en el container, luego llamar hide() para que
   * PrimeNG actualice su estado interno y limpie el DOM.
   */
  forceHide(): void {
    this.cancelHide();
    if (this.isOpen()) {
      const container = (this.popover as { container?: HTMLElement }).container;
      if (container) {
        container.style.transition = 'none';
        container.style.animation = 'none';
        container.style.opacity = '0';
        container.style.visibility = 'hidden';
      }
      this.popover.hide();
    }
  }

  // ── Internal ──────────────────────────────────────────────────────

  /**
   * `event.target` debe ser el button del trigger para que PrimeNG
   * calcule la posición correcta del popover. Si el event viene de
   * mouseenter en el host, target es el host element — funciona
   * porque PrimeNG anchora al bounding box del target.
   */
  private open(event: Event): void {
    this.helpService.notifyOpen(this);
    this.popover.show(event);
    this.isOpen.set(true);
  }

  private scheduleHide(): void {
    this.cancelHide();
    this.hideTimer = setTimeout(() => {
      if (this.isOpen()) {
        this.popover.hide();
      }
    }, ColumnHelpComponent.HIDE_DELAY_MS);
  }

  private cancelHide(): void {
    if (this.hideTimer !== undefined) {
      clearTimeout(this.hideTimer);
      this.hideTimer = undefined;
    }
  }

  /**
   * Always-below positioning con maxHeight dinámico al `<ul>` interno.
   *
   * **Por qué scroll en el ul (no en el popover root):** el arrow
   * `::before` del popover renderiza en `bottom: 100%`, fuera del
   * content box. Si pongo `overflow:auto` en `.p-popover`, el arrow
   * se clippea → invisible. Aplicando `maxHeight + overflow:auto`
   * SOLO al `<ul>` interno, el popover root mantiene
   * `overflow: visible` y el arrow renders correctamente.
   *
   * **Por qué dinámico (no fijo)**: si el contenido cabe naturalmente
   * (legends de 4-5 entries), no aplicamos maxHeight → no scrollbar.
   * Si excede el espacio disponible debajo del trigger (legend de 7
   * entries con multi-line layout), el ul recibe maxHeight calculado
   * para que el popover entero quede dentro del viewport, header
   * (title + description) siempre visible arriba, scroll en la lista.
   *
   * **Arrow clamped:** previene horizontal overflow cuando el
   * trigger está offscreen (table scrolled).
   */
  private positionPopover(): void {
    const popoverEl = (this.popover as { container?: HTMLElement }).container;
    const triggerEl = this.triggerEl?.nativeElement;
    if (!popoverEl || !triggerEl) return;

    // querySelector dentro del popover container — más robusto que
    // @ViewChild para elementos dentro del ng-template del popover
    // (ViewChild no siempre resuelve refs dentro de templates de
    // componentes externos como p-popover).
    const ulEl = popoverEl.querySelector('ul') as HTMLElement | null;

    // Reset previous maxHeight/overflow del ul (si quedaron de un
    // render anterior con content tall, ahora podría ser short).
    if (ulEl) {
      ulEl.style.maxHeight = '';
      ulEl.style.overflowY = '';
    }

    const triggerRect = triggerEl.getBoundingClientRect();
    const popoverWidth = popoverEl.offsetWidth;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const margin = 16;
    const gutter = 10;

    const top = triggerRect.bottom + window.scrollY + gutter;

    // Horizontal: alinear con trigger left, clamp a viewport bounds.
    let left = triggerRect.left + window.scrollX;
    const maxLeft = window.scrollX + viewportWidth - popoverWidth - margin;
    if (left > maxLeft) left = maxLeft;
    if (left < margin) left = margin;

    popoverEl.style.top = `${top}px`;
    popoverEl.style.left = `${left}px`;

    // SIEMPRE debajo — remover flipped class si PrimeNG la había
    // agregado (puede haberlo hecho en su pre-positioning).
    popoverEl.classList.remove('p-popover-flipped');
    popoverEl.removeAttribute('data-p-popover-flipped');

    // Arrow clampado a popover bounds. Cuando el trigger está
    // offscreen (table scrolled horizontalmente), el arrow ideal
    // apuntaría a un X fuera del popover y extendería
    // document.scrollWidth → scrollbar horizontal extra. Clamp
    // mantiene arrow dentro: [0, popoverWidth-40] cubre todo el
    // ancho del popover con margin.
    const triggerCenter = triggerRect.left + window.scrollX + triggerRect.width / 2;
    const arrowOffset = 20;
    const idealArrowLeft = triggerCenter - left - arrowOffset;
    const minArrowLeft = 0;
    const maxArrowLeft = popoverWidth - 40;
    const arrowLeft = Math.max(minArrowLeft, Math.min(maxArrowLeft, idealArrowLeft));
    popoverEl.style.setProperty('--p-popover-arrow-left', `${arrowLeft}px`);

    // Dynamic maxHeight on the inner <ul> ONLY si el popover excede
    // el viewport bottom. Header (title + description del popover)
    // siempre visible — solo la lista de entries scrollea cuando
    // el contenido es demasiado tall (caso 7 entries Clasif. crédito
    // con layout multi-line). Si content cabe naturalmente (legends
    // de 4-5 entries), no aplicamos maxHeight → no scrollbar.
    if (ulEl) {
      const popoverBottom = top + popoverEl.offsetHeight;
      const viewportBottomLimit = window.scrollY + viewportHeight - margin;
      if (popoverBottom > viewportBottomLimit) {
        const overflow = popoverBottom - viewportBottomLimit;
        const ulCurrentHeight = ulEl.offsetHeight;
        const ulNewMaxHeight = Math.max(80, ulCurrentHeight - overflow);
        ulEl.style.maxHeight = `${ulNewMaxHeight}px`;
        ulEl.style.overflowY = 'auto';
      }
    }
  }
}
