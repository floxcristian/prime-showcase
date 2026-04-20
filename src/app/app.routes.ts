import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./modules/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'forgot-password',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./modules/forgot-password/forgot-password.component').then(
        (m) => m.ForgotPasswordComponent
      ),
  },
  {
    path: '',
    canActivate: [authGuard],
    canActivateChild: [authGuard],
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
        path: 'movies',
        loadComponent: () =>
          import('./modules/movies/movies.component').then(
            (m) => m.MoviesComponent
          ),
      },
      {
        path: '**',
        redirectTo: '',
      },
    ],
  },
];
