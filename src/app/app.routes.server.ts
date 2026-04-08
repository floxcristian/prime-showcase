import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: '',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'chat',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'inbox',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'cards',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'customers',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'movies',
    renderMode: RenderMode.Prerender,
  },
  {
    path: '**',
    renderMode: RenderMode.Server,
  },
];
