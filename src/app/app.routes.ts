import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';

/**
 * Breadcrumb declarado por ruta.
 *
 * **Por qué en route.data y no derivado del nav-tree:**
 * El nav-tree (NAV_MODULES) declara cómo se llega a cada URL desde el menú,
 * pero múltiples leaves pueden apuntar a la misma URL (ej: `/cards` aparece
 * bajo "Adm. Clientes > Créditos Preaprobados" Y bajo "Campaña > Crear
 * campaña"). Una heurística "primera leaf que matchea" devolvía
 * arbitrariamente uno de los dos — y el contenido real de la ruta no
 * matcheaba con ninguno (la ruta `/cards` muestra "Tarjetas", no
 * "Créditos Preaprobados").
 *
 * Con `data: { breadcrumb: [...] }` cada ruta declara explícitamente su
 * cadena. Patrón Angular Material docs / Stripe Dashboard.
 *
 * **Fallback:** si una ruta no declara breadcrumb (futura ruta agregada
 * sin migrar), `NavStateService.breadcrumb` cae a la lógica de nav-tree
 * legacy. Zero breaking-change para rutas existentes.
 *
 * **Tipo:** Angular's route `data` es `Record<string, any>`. Acá tipamos
 * el shape con `as const` para safety en consumers.
 */
const ROUTE_DATA = {
  customers: {
    breadcrumb: [
      { title: 'CRM' },
      { title: 'Adm. Clientes' },
      { title: 'Clientes' },
    ],
  },
  chat: {
    breadcrumb: [
      { title: 'CRM' },
      { title: 'Comunicaciones' },
      { title: 'Chat de equipo' },
    ],
  },
  inbox: {
    breadcrumb: [
      { title: 'CRM' },
      { title: 'App de Llamados' },
      { title: 'Bandeja de llamados' },
    ],
  },
  notifications: {
    breadcrumb: [{ title: 'Notificaciones' }],
  },
  cards: {
    breadcrumb: [
      { title: 'Catálogo' },
      { title: 'Componentes' },
      { title: 'Tarjetas' },
    ],
  },
  movies: {
    breadcrumb: [
      { title: 'CMS' },
      { title: 'Contenidos' },
      { title: 'Películas' },
    ],
  },
} as const;

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
        // Home (`/`) — sin breadcrumb data: NavStateService lo special-casea
        // a `[{ title: 'Inicio' }]` para evitar derivar leaf arbitraria del
        // nav-tree (múltiples módulos apuntan a `/`).
        path: '',
        loadComponent: () =>
          import('./modules/overview/overview.component').then(
            (m) => m.OverviewComponent
          ),
      },
      {
        path: 'chat',
        data: ROUTE_DATA.chat,
        loadComponent: () =>
          import('./modules/chat/chat.component').then((m) => m.ChatComponent),
      },
      {
        path: 'inbox',
        data: ROUTE_DATA.inbox,
        loadComponent: () =>
          import('./modules/inbox/inbox.component').then(
            (m) => m.InboxComponent
          ),
      },
      {
        // Ruta fallback de notifs. Flujo primario:
        //   - Mobile bell  → abre `MobileNotificationsOverlayComponent` via
        //                    `nav.openNotifications()` (sin cambio de URL).
        //   - Desktop bell → toggle popover anclado al trigger (misma data,
        //                    sin route change).
        // Esta ruta sólo se pisa por:
        //   (a) deep-link externo (push notification, email link),
        //   (b) click en "Ver todas las notificaciones" del popover desktop.
        // Se mantiene para que ambos casos tengan un destino URL-addressable.
        // NO remover sin sustituir (a) y (b) por otro mecanismo.
        path: 'notifications',
        data: ROUTE_DATA.notifications,
        loadComponent: () =>
          import('./modules/notifications/notifications.component').then(
            (m) => m.NotificationsComponent
          ),
      },
      {
        path: 'cards',
        data: ROUTE_DATA.cards,
        loadComponent: () =>
          import('./modules/cards/cards.component').then(
            (m) => m.CardsComponent
          ),
      },
      {
        path: 'customers',
        data: ROUTE_DATA.customers,
        loadComponent: () =>
          import('./modules/customers/customers.component').then(
            (m) => m.CustomersComponent
          ),
      },
      {
        path: 'movies',
        data: ROUTE_DATA.movies,
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
