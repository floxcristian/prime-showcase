import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  title = 'prime-showcase';

  // WCAG 2.4.1 bypass block: skip link al <main> renderizado por MainComponent.
  // El default del browser tras `#hash` es scrollear pero no focar consistentemente
  // (Safari/Firefox varian). Focamos explicitamente para portabilidad.
  skipToMain(e: Event) {
    e.preventDefault();
    document.getElementById('main-content')?.focus();
  }
}
