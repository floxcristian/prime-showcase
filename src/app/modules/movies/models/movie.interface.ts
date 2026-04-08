export interface Movie {
  image: string;
  name: string;
  bookmarked: boolean;
  point: string;
  categories: string[];
}

export interface CarouselMovie extends Movie {
  watchedPercent: number;
}

export interface CarouselResponsiveOption {
  breakpoint: string;
  numVisible: number;
  numScroll: number;
}
