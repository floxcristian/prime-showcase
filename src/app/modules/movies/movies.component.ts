// Angular
import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Inject,
  PLATFORM_ID,
  ViewEncapsulation,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
// PrimeNG
import { SelectButton } from 'primeng/selectbutton';
//import { Slider } from 'primeng/slider';
import { AvatarModule } from 'primeng/avatar';
import { TooltipModule } from 'primeng/tooltip';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ProgressBar } from 'primeng/progressbar';
import { Carousel } from 'primeng/carousel';
import { OverlayBadgeModule } from 'primeng/overlaybadge';

const NG_MODULES = [CommonModule, FormsModule, RouterModule];
const PRIME_MODULES = [
  SelectButton,
  //Slider,
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
  search: string | undefined;

  page: number = 0;

  value: string = 'Home';

  options: string[] = [
    'Home',
    'Movies',
    'TV Shows',
    'Recently Added',
    'My List',
  ];

  responsiveOptions: any;

  carouselData: any;

  popularMovies: any;

  isBrowser: boolean;

  constructor(@Inject(PLATFORM_ID) private platformId: any) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit() {
    this.responsiveOptions = [
      {
        breakpoint: '1199px',
        numVisible: 3,
        numScroll: 1,
      },

      {
        breakpoint: '767px',
        numVisible: 2,
        numScroll: 1,
      },
      {
        breakpoint: '575px',
        numVisible: 1,
        numScroll: 1,
      },
    ];

    this.carouselData = [
      {
        image:
          'https://www.primefaces.org/cdn/primevue/images/landing/apps/movie-cover1.png',
        name: 'Heat',
        bookmarked: true,
        point: '4.7',
        watchedPercent: 80,
        categories: ['Action', 'Crime', 'Drama'],
      },
      {
        image:
          'https://www.primefaces.org/cdn/primevue/images/landing/apps/movie-cover2.png',
        name: 'Batman Begins',
        bookmarked: false,
        point: '4.8',
        watchedPercent: 45,
        categories: ['Action', 'Crime', 'Drama'],
      },
      {
        image:
          'https://www.primefaces.org/cdn/primevue/images/landing/apps/movie-cover3.png',
        name: 'Leon: The Professional',
        bookmarked: false,
        point: '4.3',
        watchedPercent: 10,
        categories: ['Action', 'Crime', 'Drama'],
      },
      {
        image:
          'https://www.primefaces.org/cdn/primevue/images/landing/apps/movie-cover4.png',
        name: 'Matrix',
        bookmarked: false,
        point: '4.9',
        watchedPercent: 50,
        categories: ['Action', 'Sci-Fi'],
      },
      {
        image:
          'https://www.primefaces.org/cdn/primevue/images/landing/apps/movie-cover5.png',
        name: 'Fight Club',
        bookmarked: false,
        point: '4.4',
        watchedPercent: 30,
        categories: ['Drama'],
      },
      {
        image:
          'https://www.primefaces.org/cdn/primevue/images/landing/apps/movie-cover6.png',
        name: 'The Big Lebowski',
        bookmarked: false,
        point: '4.7',
        watchedPercent: 40,
        categories: ['Comedy', 'Drama'],
      },
      {
        image:
          'https://www.primefaces.org/cdn/primevue/images/landing/apps/movie-cover7.png',
        name: 'Twelve Angry Men',
        bookmarked: false,
        point: '4.7',
        watchedPercent: 50,
        categories: ['Crime', 'Drama'],
      },
      {
        image:
          'https://www.primefaces.org/cdn/primevue/images/landing/apps/movie-cover8.png',
        name: 'Saving Private Ryan',
        bookmarked: true,
        point: '4.7',
        watchedPercent: 80,
        categories: ['Drama', 'War'],
      },
      {
        image:
          'https://www.primefaces.org/cdn/primevue/images/landing/apps/movie-cover9.png',
        name: 'Seven',
        bookmarked: false,
        point: '4.7',
        watchedPercent: 20,
        categories: ['Crime', 'Drama', 'Mystery'],
      },
      {
        image:
          'https://www.primefaces.org/cdn/primevue/images/landing/apps/movie-cover10.png',
        name: 'Shutter Island',
        bookmarked: false,
        point: '4.7',
        watchedPercent: 70,
        categories: ['Mystery', 'Thriller'],
      },
    ];

    this.popularMovies = [
      {
        image:
          'https://www.primefaces.org/cdn/primevue/images/landing/apps/movie-cover7.png',
        name: 'Twelve Angry Men',
        bookmarked: false,
        point: '4.6',
        categories: ['Crime', 'Drama'],
      },
      {
        image:
          'https://www.primefaces.org/cdn/primevue/images/landing/apps/movie-cover8.png',
        name: 'Saving Private Ryan',
        bookmarked: true,
        point: '4.4',
        categories: ['Drama', 'War'],
      },
      {
        image:
          'https://www.primefaces.org/cdn/primevue/images/landing/apps/movie-cover9.png',
        name: 'Seven',
        bookmarked: false,
        point: '4.3',
        categories: ['Crime', 'Drama', 'Mystery'],
      },
      {
        image:
          'https://www.primefaces.org/cdn/primevue/images/landing/apps/movie-cover10.png',
        name: 'Shutter Island',
        bookmarked: false,
        point: '4.7',
        categories: ['Mystery', 'Thriller'],
      },
      {
        image:
          'https://www.primefaces.org/cdn/primevue/images/landing/apps/movie-cover11.png',
        name: 'Basic Instinct',
        bookmarked: true,
        point: '4.3',
        categories: ['Drama', 'Mystery', 'Thriller'],
      },
      {
        image:
          'https://www.primefaces.org/cdn/primevue/images/landing/apps/movie-cover12.png',
        name: 'Big Hero 6',
        bookmarked: false,
        point: '4.7',
        categories: ['Animation', 'Action', 'Adventure'],
      },
      {
        image:
          'https://www.primefaces.org/cdn/primevue/images/landing/apps/movie-cover13.png',
        name: 'The Lord Of The Rings: Fellowship of the ring',
        bookmarked: true,
        point: '4.9',
        categories: ['Action', 'Adventure', 'Drama'],
      },
      {
        image:
          'https://www.primefaces.org/cdn/primevue/images/landing/apps/movie-cover14.png',
        name: 'Kill Bill',
        bookmarked: true,
        point: '4.5',
        categories: ['Action', 'Crime', 'Thriller'],
      },
    ];
  }

  previousPage() {
    this.page -= 1;
  }

  nextPage() {
    this.page += 1;
  }
}