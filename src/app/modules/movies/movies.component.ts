// Angular
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
// PrimeNG
import { SelectButton } from 'primeng/selectbutton';
import { AvatarModule } from 'primeng/avatar';
import { TooltipModule } from 'primeng/tooltip';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ProgressBar } from 'primeng/progressbar';
import { Carousel } from 'primeng/carousel';
import { OverlayBadgeModule } from 'primeng/overlaybadge';
import { Movie, CarouselMovie, CarouselResponsiveOption } from './models/movie.interface';
import {
  CAROUSEL_NUM_VISIBLE,
  CAROUSEL_NUM_SCROLL,
  CAROUSEL_RESPONSIVE_OPTIONS,
  CAROUSEL_MOVIES,
  POPULAR_MOVIES,
} from './constants/movies-data';

const NG_MODULES = [FormsModule, RouterModule];
const PRIME_MODULES = [
  SelectButton,
  AvatarModule,
  TooltipModule,
  IconField,
  InputIcon,
  ButtonModule,
  InputTextModule,
  ProgressBar,
  Carousel,
  OverlayBadgeModule,
];
@Component({
  selector: 'app-movies',
  imports: [NG_MODULES, PRIME_MODULES],
  templateUrl: './movies.component.html',
  styleUrl: './movies.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'flex-1 flex flex-col gap-6 p-6 h-full overflow-y-auto overflow-x-clip overflow-hidden border border-surface rounded-2xl',
  },
})
export class MoviesComponent {
  private destroyRef = inject(DestroyRef);

  search: string | undefined;
  page = signal(0);
  value: string = 'Inicio';
  options: string[] = [
    'Inicio',
    'Películas',
    'Series',
    'Recientes',
    'Mi Lista',
  ];
  responsiveOptions: CarouselResponsiveOption[] = CAROUSEL_RESPONSIVE_OPTIONS;
  carouselData: CarouselMovie[] = CAROUSEL_MOVIES;
  popularMovies: Movie[] = POPULAR_MOVIES;

  numVisible = signal(CAROUSEL_NUM_VISIBLE);

  maxPage = computed(() =>
    Math.max(0, Math.ceil((this.carouselData.length - this.numVisible()) / CAROUSEL_NUM_SCROLL))
  );

  constructor() {
    afterNextRender(() => this.initBreakpointListeners());
  }

  previousPage(): void {
    this.page.update(p => Math.max(0, p - 1));
  }

  nextPage(): void {
    this.page.update(p => Math.min(this.maxPage(), p + 1));
  }

  private initBreakpointListeners(): void {
    // Sort ascending so we match the most specific (smallest) breakpoint first
    const sorted = [...this.responsiveOptions]
      .sort((a, b) => parseInt(a.breakpoint) - parseInt(b.breakpoint));

    const mediaQueries = sorted.map(opt => ({
      mql: window.matchMedia(`(max-width: ${opt.breakpoint})`),
      numVisible: opt.numVisible,
    }));

    const update = () => {
      const match = mediaQueries.find(mq => mq.mql.matches);
      this.numVisible.set(match ? match.numVisible : CAROUSEL_NUM_VISIBLE);

      // Clamp page if it exceeds the new maxPage after viewport change
      const max = this.maxPage();
      if (this.page() > max) {
        this.page.set(max);
      }
    };

    mediaQueries.forEach(mq => mq.mql.addEventListener('change', update));
    this.destroyRef.onDestroy(() =>
      mediaQueries.forEach(mq => mq.mql.removeEventListener('change', update))
    );

    update();
  }
}
