import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./layouts/main/main.component').then((m) => m.MainComponent),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./modules/overview/overview.component').then(
            (m) => m.OverviewComponent
          ),
      },
      {
        path: 'chat',
        loadComponent: () =>
          import('./modules/chat/chat.component').then((m) => m.ChatComponent),
      },
      {
        path: 'inbox',
        loadComponent: () =>
          import('./modules/inbox/inbox.component').then(
            (m) => m.InboxComponent
          ),
      },
      {
        path: 'cards',
        loadComponent: () =>
          import('./modules/cards/cards.component').then(
            (m) => m.CardsComponent
          ),
      },
      {
        path: 'customers',
        loadComponent: () =>
          import('./modules/customers/customers.component').then(
            (m) => m.CustomersComponent
          ),
      },
      {
        path: 'teams',
        loadComponent: () =>
          import('./modules/teams/teams.component').then(
            (m) => m.TeamsComponent
          ),
      },
      {
        path: 'movies',
        loadComponent: () =>
          import('./modules/movies/movies.component').then(
            (m) => m.MoviesComponent
          ),
      },
    ],
  },
];