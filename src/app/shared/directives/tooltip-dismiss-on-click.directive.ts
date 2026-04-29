import { Directive, HostListener, inject } from '@angular/core';

import { Tooltip } from 'primeng/tooltip';

/**
 * Auto-hide del tooltip cuando el host es clickeado.
 *
 * **Por qué**: cuando el user clickea un trigger con tooltip, la
 * acción ya fue tomada — el tooltip queda como ruido visual sobre
 * el popover/dropdown/dialog que acaba de aparecer. Patrón unánime
 * bigtech: Stripe, Linear, GitHub, Datadog, Notion — todos ocultan
 * el tooltip on click.
 *
 * **Por qué no viene built-in**: PrimeNG `[pTooltip]` solo registra
 * mouseenter/mouseleave/focus/blur como triggers. Click no está en
 * el set default de hide events. Esta directive complementa el
 * comportamiento de PrimeNG sin reemplazarlo — coexisten en el mismo
 * elemento.
 *
 * **Selector permisivo `[pTooltip]`**: aplica globalmente a cualquier
 * elemento con la directive de tooltip. No discrimina por tipo de
 * elemento (button, span, p-button) porque el comportamiento "click
 * → dismiss" es deseado en todos los casos donde haya tooltip — los
 * spans wrapping de filter buttons, los icon-only buttons, los chips
 * con label, todos.
 *
 * **`optional: true` en el inject**: defensive — si por alguna razón
 * la directive de PrimeNG no se hubiera instanciado (cosa rara),
 * esta directive deja de hacer nada en lugar de tirar runtime error.
 *
 * **Cómo usar**: importar este directive en cada componente que use
 * `[pTooltip]` para que la regla aplique en sus templates. Como
 * directive standalone, no requiere módulo intermedio.
 */
@Directive({
  selector: '[pTooltip]',
  standalone: true,
})
export class TooltipDismissOnClickDirective {
  private tooltip = inject(Tooltip, { self: true, optional: true });

  @HostListener('click') onClick(): void {
    this.tooltip?.deactivate();
  }
}
