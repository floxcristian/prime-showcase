import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { PreloadingStrategy, Route } from '@angular/router';
import { Observable, of } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class BrowserPreloadingStrategy implements PreloadingStrategy {
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  preload(_route: Route, load: () => Observable<unknown>): Observable<unknown> {
    return this.isBrowser ? load() : of(null);
  }
}
