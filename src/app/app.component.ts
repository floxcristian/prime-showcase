import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  PLATFORM_ID,
} from '@angular/core';
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

  private platformId = inject(PLATFORM_ID);
  private document = inject(DOCUMENT);

  // WCAG 2.4.1 bypass block: skip link al <main> renderizado por MainComponent.
  // Focamos explícitamente porque el default del browser tras `#hash` no es
  // consistente (Safari/Firefox varían). SSR-guarded: el servidor no tiene DOM.
  skipToMain(e: Event) {
    e.preventDefault();
    if (!isPlatformBrowser(this.platformId)) return;
    this.document.getElementById('main-content')?.focus();
  }
}
