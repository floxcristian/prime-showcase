// Angular
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  output,
  PLATFORM_ID,
  signal,
} from '@angular/core';
// PrimeNG
import { ButtonModule } from 'primeng/button';

const PRIME_MODULES = [ButtonModule];

/** Threshold del FAB scroll listener — micro-jitter en touch scroll
 * (< 24px) no debe flippear el extended/collapsed state. */
const FAB_SCROLL_THRESHOLD_PX = 24;
/** Y-scroll bajo este threshold = "near top", FAB siempre extended
 * independientemente de dirección. */
const FAB_NEAR_TOP_PX = 50;

/**
 * Mobile FAB "Crear cliente" — Material 3 Extended FAB con
 * scroll-aware collapse (extended near top / scrolling up, icon-only
 * scrolling down). El listener de scroll, su threshold y su teardown
 * viven acá: es estado 100% presentacional del FAB que el container no
 * necesita conocer.
 *
 * `host: contents` — el host no genera caja; las clases de posición
 * (`fixed right-4 z-10` + safe-area bottom) viven en el `p-button`
 * mismo, así el pixel no cambia respecto de cuando el botón era hijo
 * directo del template del container.
 *
 * La acción (`onCreateCustomer`) queda en el container — la comparte
 * el CTA desktop del header y el atajo `c`.
 */
@Component({
  selector: 'app-customers-fab',
  imports: [PRIME_MODULES],
  templateUrl: './customers-fab.component.html',
  styleUrl: './customers-fab.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
})
export class CustomersFabComponent {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  /** Guard SSR canónico del repo (ver .claude/rules/ssr-and-runtime.md). */
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Tap del FAB — el container responde con `onCreateCustomer()`. */
  readonly createRequested = output<void>();

  // ── FAB scroll-aware collapse (Material 3) ────────────────────────
  //
  // Patrón Material 3 / Google Tasks/Calendar/Gmail mobile: Extended
  // FAB **collapses to icon-only** on scroll down (recede para no
  // ocultar contenido), re-extends on scroll up (forward-affordance).
  // Detección via scroll listener con threshold 24px delta.

  protected readonly fabExtended = signal(true);
  private lastScrollY = 0;
  private fabScrollListener?: () => void;

  constructor() {
    this.initFabScrollBehavior();
  }

  /**
   * Init del scroll listener para FAB collapse. Tear-down vía
   * destroyRef hook auto-llamado al destruirse el componente.
   * Threshold de 24px evita flicker en jitter scroll de touch.
   */
  private initFabScrollBehavior(): void {
    if (!this.isBrowser) return;
    const onScroll = () => {
      const current = window.scrollY;
      const delta = current - this.lastScrollY;
      if (Math.abs(delta) < FAB_SCROLL_THRESHOLD_PX) return; // micro-jitter
      if (current < FAB_NEAR_TOP_PX) {
        // Near top — always extended
        this.fabExtended.set(true);
      } else if (delta > 0) {
        // Scrolling down → collapse
        this.fabExtended.set(false);
      } else {
        // Scrolling up → extend
        this.fabExtended.set(true);
      }
      this.lastScrollY = current;
    };
    // Find the scrollable container. El layout wrap usa `<main>` con
    // overflow-y-auto (window scroll no aplica). DOM access via DI'd
    // `DOCUMENT` token vs `document` global — más testable + SSR-safe
    // por convención del proyecto. Acoplamiento al layout sigue ahí
    // (la query asume que existe un `<main>`) pero al menos es
    // explícito. Migrar a un `ScrollContainerService` requeriría
    // refactor del layout — fuera de scope.
    const scrollEl = this.document.querySelector('main');
    if (scrollEl) {
      scrollEl.addEventListener('scroll', onScroll, { passive: true });
      this.fabScrollListener = () =>
        scrollEl.removeEventListener('scroll', onScroll);
    } else {
      window.addEventListener('scroll', onScroll, { passive: true });
      this.fabScrollListener = () =>
        window.removeEventListener('scroll', onScroll);
    }
    this.destroyRef.onDestroy(() => this.fabScrollListener?.());
  }
}
