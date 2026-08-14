import type { Popover } from 'primeng/popover';

/**
 * Delay artificial del ciclo hide-then-show de un popover contextual
 * de fila para que PrimeNG re-attachee correctamente tras un click
 * rápido en otra fila. Sin el delay, el `show()` inmediato después del
 * `hide()` puede quedar apuntando al anchor viejo.
 */
export const POPOVER_REOPEN_DELAY_MS = 150;

/**
 * Reposiciona un popover contextual de fila sobre un nuevo target:
 * `hide()` inmediato + `show(event)` diferido {@link POPOVER_REOPEN_DELAY_MS}.
 * Patrón canónico para popovers de row actions con instancia única
 * reusable per row (users / roles / customers).
 *
 * **Zoneless/SSR**: el `setTimeout` solo corre tras interacción del
 * usuario (browser-only por definición — un MouseEvent no existe en
 * server), así que no necesita guard de plataforma. El `show()` dentro
 * del callback dispara CD vía los mecanismos internos de PrimeNG.
 *
 * @returns el handle del `setTimeout`, para que el componente pueda
 *   cancelarlo en su destroy (`DestroyRef.onDestroy`) y evitar un
 *   `show()` sobre un popover ya destruido si el usuario navega en la
 *   ventana de 150ms.
 */
export function reopenPopover(
  event: MouseEvent,
  popover: Popover,
): ReturnType<typeof setTimeout> {
  popover.hide();
  return setTimeout(() => {
    popover.show(event);
  }, POPOVER_REOPEN_DELAY_MS);
}
