import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';

/**
 * Back arrow button del chrome mobile. Look idéntico a los otros botones
 * ghost blancos del toolbar/overlays (w-11 h-11, bg transparente, hover sutil
 * oscuro) con icono `fa-arrow-left` y aria-label configurable.
 *
 * Consumer binds `(pressed)` al handler apropiado — `nav.goBack()` para
 * rutas, `close()` del overlay propio para surfaces no-ruta. No hardcodeamos
 * la acción aquí porque el mismo chrome cubre ambos casos (ver el diff entre
 * toolbar.html back en rutas vs. overlays en primary-title-toolbar).
 *
 * Proyectable vía atributo `leading` al slot del primary-title-toolbar:
 *
 *   <app-primary-title-toolbar title="Mi cuenta">
 *     <app-back-button leading (pressed)="close()" />
 *   </app-primary-title-toolbar>
 */
@Component({
  selector: 'app-back-button',
  template: `
    <button
      type="button"
      (click)="pressed.emit()"
      [attr.aria-label]="label()"
      class="w-11 h-11 rounded-lg flex items-center justify-center text-surface-0 bg-transparent hover:bg-surface-950/25 cursor-pointer transition-colors select-none shrink-0"
    >
      <i
        class="fa-sharp fa-regular fa-arrow-left text-xl"
        aria-hidden="true"
      ></i>
    </button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
})
export class BackButtonComponent {
  readonly label = input<string>('Volver');
  readonly pressed = output<void>();
}
