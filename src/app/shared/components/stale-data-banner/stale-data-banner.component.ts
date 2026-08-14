import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { ButtonModule } from 'primeng/button';

/**
 * Banner inline "no pudimos refrescar" — se muestra encima de la tabla
 * cuando un reload falla PERO hay data previa visible
 * (stale-while-revalidate UX). El `[loading]` de p-table no comunica
 * failure — solo "trabajando" — por eso el banner existe aparte del
 * error empty-state (que cubre el caso sin data alguna, ver
 * `<app-load-error-state>`).
 *
 * `role="alert"` en el host: screen readers anuncian el fallo sin
 * interacción. Antes vivía copy-pasteado verbatim en users / roles /
 * customers / obs-uptime.
 */
@Component({
  selector: 'app-stale-data-banner',
  imports: [ButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <i
      class="fa-sharp fa-regular fa-triangle-exclamation text-color"
      aria-hidden="true"
    ></i>
    <span class="flex-1 text-muted-color leading-5">{{ message() }}</span>
    <p-button
      label="Reintentar"
      severity="secondary"
      size="small"
      [text]="true"
      icon="fa-sharp fa-regular fa-arrows-rotate"
      (onClick)="retry.emit()"
    />
  `,
  host: {
    class:
      'border border-surface rounded-lg p-3 mb-2 flex items-center gap-3 text-sm',
    role: 'alert',
  },
})
export class StaleDataBannerComponent {
  /** Mensaje del banner — default cubre el caso genérico de refresh fallido. */
  readonly message = input<string>(
    'No pudimos refrescar los datos. Estás viendo la última versión disponible.',
  );
  readonly retry = output<void>();
}
