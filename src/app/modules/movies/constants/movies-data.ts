import { Movie, CarouselMovie, CarouselResponsiveOption } from '../models/movie.interface';

export const CAROUSEL_NUM_VISIBLE = 5;
export const CAROUSEL_NUM_SCROLL = 1;

export const CAROUSEL_RESPONSIVE_OPTIONS: CarouselResponsiveOption[] = [
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

export const CAROUSEL_MOVIES: CarouselMovie[] = [
  {
    image: 'https://www.primefaces.org/cdn/primevue/images/landing/apps/movie-cover1.png',
    name: 'Heat',
    bookmarked: true,
    point: '4.7',
    watchedPercent: 80,
    categories: ['Acci\u00f3n', 'Crimen', 'Drama'],
  },
  {
    image: 'https://www.primefaces.org/cdn/primevue/images/landing/apps/movie-cover2.png',
    name: 'Batman Begins',
    bookmarked: false,
    point: '4.8',
    watchedPercent: 45,
    categories: ['Acci\u00f3n', 'Crimen', 'Drama'],
  },
  {
    image: 'https://www.primefaces.org/cdn/primevue/images/landing/apps/movie-cover3.png',
    name: 'Leon: The Professional',
    bookmarked: false,
    point: '4.3',
    watchedPercent: 10,
    categories: ['Acci\u00f3n', 'Crimen', 'Drama'],
  },
  {
    image: 'https://www.primefaces.org/cdn/primevue/images/landing/apps/movie-cover4.png',
    name: 'Matrix',
    bookmarked: false,
    point: '4.9',
    watchedPercent: 50,
    categories: ['Acci\u00f3n', 'Ciencia ficci\u00f3n'],
  },
  {
    image: 'https://www.primefaces.org/cdn/primevue/images/landing/apps/movie-cover5.png',
    name: 'Fight Club',
    bookmarked: false,
    point: '4.4',
    watchedPercent: 30,
    categories: ['Drama'],
  },
  {
    image: 'https://www.primefaces.org/cdn/primevue/images/landing/apps/movie-cover6.png',
    name: 'The Big Lebowski',
    bookmarked: false,
    point: '4.7',
    watchedPercent: 40,
    categories: ['Comedia', 'Drama'],
  },
  {
    image: 'https://www.primefaces.org/cdn/primevue/images/landing/apps/movie-cover7.png',
    name: 'Twelve Angry Men',
    bookmarked: false,
    point: '4.7',
    watchedPercent: 50,
    categories: ['Crime', 'Drama'],
  },
  {
    image: 'https://www.primefaces.org/cdn/primevue/images/landing/apps/movie-cover8.png',
    name: 'Saving Private Ryan',
    bookmarked: true,
    point: '4.7',
    watchedPercent: 80,
    categories: ['Drama', 'B\u00e9lica'],
  },
  {
    image: 'https://www.primefaces.org/cdn/primevue/images/landing/apps/movie-cover9.png',
    name: 'Seven',
    bookmarked: false,
    point: '4.7',
    watchedPercent: 20,
    categories: ['Crimen', 'Drama', 'Misterio'],
  },
  {
    image: 'https://www.primefaces.org/cdn/primevue/images/landing/apps/movie-cover10.png',
    name: 'Shutter Island',
    bookmarked: false,
    point: '4.7',
    watchedPercent: 70,
    categories: ['Misterio', 'Suspenso'],
  },
];

export const POPULAR_MOVIES: Movie[] = [
  {
    image: 'https://www.primefaces.org/cdn/primevue/images/landing/apps/movie-cover7.png',
    name: 'Twelve Angry Men',
    bookmarked: false,
    point: '4.6',
    categories: ['Crime', 'Drama'],
  },
  {
    image: 'https://www.primefaces.org/cdn/primevue/images/landing/apps/movie-cover8.png',
    name: 'Saving Private Ryan',
    bookmarked: true,
    point: '4.4',
    categories: ['Drama', 'B\u00e9lica'],
  },
  {
    image: 'https://www.primefaces.org/cdn/primevue/images/landing/apps/movie-cover9.png',
    name: 'Seven',
    bookmarked: false,
    point: '4.3',
    categories: ['Crimen', 'Drama', 'Misterio'],
  },
  {
    image: 'https://www.primefaces.org/cdn/primevue/images/landing/apps/movie-cover10.png',
    name: 'Shutter Island',
    bookmarked: false,
    point: '4.7',
    categories: ['Misterio', 'Suspenso'],
  },
  {
    image: 'https://www.primefaces.org/cdn/primevue/images/landing/apps/movie-cover11.png',
    name: 'Basic Instinct',
    bookmarked: true,
    point: '4.3',
    categories: ['Drama', 'Misterio', 'Suspenso'],
  },
  {
    image: 'https://www.primefaces.org/cdn/primevue/images/landing/apps/movie-cover12.png',
    name: 'Big Hero 6',
    bookmarked: false,
    point: '4.7',
    categories: ['Animaci\u00f3n', 'Acci\u00f3n', 'Aventura'],
  },
  {
    image: 'https://www.primefaces.org/cdn/primevue/images/landing/apps/movie-cover13.png',
    name: 'The Lord Of The Rings: Fellowship of the ring',
    bookmarked: true,
    point: '4.9',
    categories: ['Acci\u00f3n', 'Aventura', 'Drama'],
  },
  {
    image: 'https://www.primefaces.org/cdn/primevue/images/landing/apps/movie-cover14.png',
    name: 'Kill Bill',
    bookmarked: true,
    point: '4.5',
    categories: ['Acci\u00f3n', 'Crimen', 'Suspenso'],
  },
];
