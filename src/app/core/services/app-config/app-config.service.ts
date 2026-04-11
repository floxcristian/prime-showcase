import { isPlatformBrowser } from '@angular/common';
import { effect, inject, Injectable, PLATFORM_ID, signal, DOCUMENT } from '@angular/core';
import { AppState } from './models/app-state.interface';

@Injectable({
  providedIn: 'root',
})
export class AppConfigService {
  private readonly STORAGE_KEY = 'appConfigState';

  // Dependencies — must be declared before any field that uses them
  private document = inject(DOCUMENT);
  private platformId = inject(PLATFORM_ID);

  appState = signal<AppState>(this.loadAppState());
  transitionComplete = signal<boolean>(false);

  private isFirstRun = true;

  constructor() {
    effect(() => {
      const state = this.appState();

      if (this.isFirstRun) {
        this.isFirstRun = false;
        return;
      }

      this.saveAppState(state);
      this.handleDarkModeTransition(state);
    });
  }

  private handleDarkModeTransition(state: AppState): void {
    if (isPlatformBrowser(this.platformId)) {
      if (typeof this.document.startViewTransition === 'function') {
        this.startViewTransition(state);
      } else {
        this.toggleDarkMode(state);
        this.onTransitionEnd();
      }
    }
  }

  private startViewTransition(state: AppState): void {
    const transition = this.document.startViewTransition(() => {
      this.toggleDarkMode(state);
    });

    transition.ready.then(() => this.onTransitionEnd());
  }

  private toggleDarkMode(state: AppState): void {
    if (state.darkTheme) {
      this.document.documentElement.classList.add('p-dark');
    } else {
      this.document.documentElement.classList.remove('p-dark');
    }
  }

  private onTransitionEnd() {
    this.transitionComplete.set(true);
    setTimeout(() => {
      this.transitionComplete.set(false);
    });
  }

  private loadAppState(): AppState {
    if (isPlatformBrowser(this.platformId)) {
      const storedState = localStorage.getItem(this.STORAGE_KEY);
      if (storedState) {
        try {
          return JSON.parse(storedState) as AppState;
        } catch {
          return { preset: 'Aura', primary: 'noir', surface: null, darkTheme: false };
        }
      }
    }
    return {
      preset: 'Aura',
      primary: 'noir',
      surface: null,
      darkTheme: false,
    };
  }

  private saveAppState(state: AppState): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
    }
  }
}
