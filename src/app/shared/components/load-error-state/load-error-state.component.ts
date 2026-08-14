import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';

import { EmptyStateComponent } from '../empty-state/empty-state.component';

/**
 * Empty-state de error de carga — compone `<app-empty-state>` con el
 * copy fijo que compartían 9 vistas (users / roles / customers /
 * obs-services / obs-alerts / obs-inbox / obs-alert-detail /
 * obs-service-detail / obs-uptime): icono triangle-exclamation,
 * descripción "Hubo un problema al obtener los datos…" y CTA
 * "Reintentar".
 *
 * Solo varía el título por entidad ("No pudimos cargar los usuarios" /
 * "…tu inbox" / etc.) — se pasa completo vía `title` para no adivinar
 * género/artículo desde un nombre de entidad.
 *
 * Aplica al caso "falló el fetch y NO hay data previa que mostrar".
 * Para reload fallido con data stale visible usar
 * `<app-stale-data-banner>`.
 *
 * Usa `size="compact"` del `<app-empty-state>`: este componente vive en
 * celdas y contenedores densos (`max-w-sm`) de 9 vistas — con la escala
 * hero (`text-2xl`) el título de error quedaba del mismo tamaño que el
 * `h1` de la página (jerarquía invertida).
 */
@Component({
  selector: 'app-load-error-state',
  imports: [EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-empty-state
      icon="fa-triangle-exclamation"
      [title]="title()"
      description="Hubo un problema al obtener los datos. Reintentalo en unos segundos."
      [bordered]="true"
      size="compact"
      actionLabel="Reintentar"
      actionIcon="fa-sharp fa-regular fa-arrows-rotate"
      (actionClick)="retry.emit()"
    />
  `,
})
export class LoadErrorStateComponent {
  /** Título completo del error (ej: "No pudimos cargar los usuarios"). */
  readonly title = input.required<string>();
  readonly retry = output<void>();
}
