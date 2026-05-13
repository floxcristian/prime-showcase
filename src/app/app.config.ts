import {
  ApplicationConfig,
  ErrorHandler,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter, withPreloading } from '@angular/router';
import {
  provideClientHydration,
  withEventReplay,
  withIncrementalHydration,
} from '@angular/platform-browser';
import { ConfirmationService, MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { routes } from './app.routes';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { AppErrorHandler } from './core/services/error-handler/app-error-handler';
import { BrowserPreloadingStrategy } from './core/strategies/browser-preloading.strategy';
import { AppConfigService } from './core/services/app-config/app-config.service';
import { provideAppLocale } from './core/locale';
import { AppPreset, PRIMENG_OPTIONS } from './app.preset';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    // Global error handling:
    //   1. `provideBrowserGlobalErrorListeners()` (Angular 21+) attaches
    //      `window.onerror` + `unhandledrejection` listeners para capturar
    //      errores que escapen del zone de Angular (setTimeout handlers,
    //      fetch promises non-awaited, addEventListener callbacks externos).
    //      Sin esto, esos errores solo viven en el console del browser y no
    //      llegan al ErrorHandler.
    //   2. Override del `ErrorHandler` default: reemplaza el `console.error`-
    //      simple por `AppErrorHandler` con logging estructurado + SSR
    //      platform-scope. En prod con backend real sustituir el console por
    //      SDK de observabilidad (Sentry, Datadog, Rollbar, NewRelic).
    provideBrowserGlobalErrorListeners(),
    { provide: ErrorHandler, useClass: AppErrorHandler },
    provideRouter(routes, withPreloading(BrowserPreloadingStrategy)),
    provideHttpClient(withFetch()),
    // Centralised feedback services — `<p-toast>` and `<p-confirmdialog>`
    // live in MainComponent's template; `MessageService` /
    // `ConfirmationService` reach them via DI. Wrapped by
    // `AppToastService` / `AppConfirmService` in `core/services/*` to
    // freeze the severity vocabulary, timing, and copy contract.
    MessageService,
    ConfirmationService,
    // Locale tokens (`APP_LOCALE`, `APP_CURRENCY`, `APP_TIME_ZONE`)
    // and the `AppLocaleService` formatter cache. Defaults to `es-CL` /
    // `CLP` / `America/Santiago`; override individual tokens after
    // this in the providers array for multi-tenant SaaS, language
    // pickers, or pseudo-localisation in CI.
    ...provideAppLocale(),
    // Incremental Hydration: el SSR sigue emitiendo HTML completo, pero los bloques
    // marcados con `@defer (hydrate on <trigger>)` posponen la hidratacion (registro
    // de event listeners + creacion de instancias de componentes) hasta que el
    // trigger se cumple. Pareo: viewport defiere hasta que IntersectionObserver
    // detecta el bloque visible. Beneficio: TTI mas bajo en rutas con contenido
    // pesado fuera de la primera mitad del viewport (chart, carousel, file upload,
    // panel lateral xl). Sin esta feature, `@defer hydrate` se trata como `@defer`
    // normal y la hidratacion ocurre eagerly. Ref: ADR-001 §10
    provideClientHydration(withEventReplay(), withIncrementalHydration()),
    // Bootstrap AppConfigService before first render so it reads the theme
    // cookie (SSR via REQUEST, browser via document.cookie) and applies the
    // `p-dark` class on <html> — which is what Angular serializes into the
    // SSR HTML. Using provideAppInitializer (not a component-level inject)
    // so the contract is: "service runs before render", independent of the
    // component tree. Ref: ADR-001 §4
    provideAppInitializer(() => {
      inject(AppConfigService);
    }),
    providePrimeNG({
      theme: {
        preset: AppPreset,
        options: PRIMENG_OPTIONS,
      },
      // Traducciones globales — PrimeNG default es inglés. El producto es
      // en español, así que sobrescribimos las strings que se renderizan
      // en componentes con UI textual built-in: filtros de tabla
      // (matchAll, contains, addRule, clear, apply...), paginator,
      // calendar, file upload, password meter, autocomplete empty/search
      // messages, etc. Lista exhaustiva basada en la interface Translation
      // de primeng/api — cubre todos los strings posibles que un usuario
      // pueda ver. Aria labels también traducidos para SR users.
      translation: {
        // Filter match modes (column filter popover)
        startsWith: 'Empieza con',
        contains: 'Contiene',
        notContains: 'No contiene',
        endsWith: 'Termina con',
        equals: 'Igual a',
        notEquals: 'Distinto a',
        noFilter: 'Sin filtro',
        lt: 'Menor que',
        lte: 'Menor o igual',
        gt: 'Mayor que',
        gte: 'Mayor o igual',
        is: 'Es',
        isNot: 'No es',
        before: 'Antes',
        after: 'Después',
        dateIs: 'Fecha es',
        dateIsNot: 'Fecha no es',
        dateBefore: 'Fecha anterior a',
        dateAfter: 'Fecha posterior a',
        // Filter buttons
        clear: 'Limpiar',
        apply: 'Aplicar',
        matchAll: 'Coincidir todos',
        matchAny: 'Coincidir alguno',
        addRule: 'Agregar regla',
        removeRule: 'Quitar regla',
        // Confirm dialog
        accept: 'Aceptar',
        reject: 'Cancelar',
        // File upload
        choose: 'Elegir',
        upload: 'Subir',
        cancel: 'Cancelar',
        completed: 'Completado',
        pending: 'Pendiente',
        fileSizeTypes: ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'],
        fileChosenMessage: '{0} archivos',
        noFileChosenMessage: 'Sin archivos seleccionados',
        // Calendar
        dayNames: [
          'domingo', 'lunes', 'martes', 'miércoles',
          'jueves', 'viernes', 'sábado',
        ],
        dayNamesShort: ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'],
        dayNamesMin: ['D', 'L', 'M', 'X', 'J', 'V', 'S'],
        monthNames: [
          'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
          'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
        ],
        monthNamesShort: [
          'ene', 'feb', 'mar', 'abr', 'may', 'jun',
          'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
        ],
        dateFormat: 'dd/mm/yy',
        firstDayOfWeek: 1, // lunes (España/LatAm convention)
        today: 'Hoy',
        weekHeader: 'Sm',
        chooseYear: 'Elegir año',
        chooseMonth: 'Elegir mes',
        chooseDate: 'Elegir fecha',
        prevDecade: 'Década anterior',
        nextDecade: 'Próxima década',
        prevYear: 'Año anterior',
        nextYear: 'Próximo año',
        prevMonth: 'Mes anterior',
        nextMonth: 'Próximo mes',
        prevHour: 'Hora anterior',
        nextHour: 'Próxima hora',
        prevMinute: 'Minuto anterior',
        nextMinute: 'Próximo minuto',
        prevSecond: 'Segundo anterior',
        nextSecond: 'Próximo segundo',
        am: 'a. m.',
        pm: 'p. m.',
        // Password meter
        weak: 'Débil',
        medium: 'Medio',
        strong: 'Fuerte',
        passwordPrompt: 'Ingresá una contraseña',
        // Autocomplete / Select
        emptyMessage: 'No hay resultados',
        emptyFilterMessage: 'No hay coincidencias',
        searchMessage: '{0} resultados disponibles',
        selectionMessage: '{0} ítems seleccionados',
        emptySelectionMessage: 'Sin selección',
        emptySearchMessage: 'No hay resultados',
        // Aria labels (screen readers)
        aria: {
          trueLabel: 'Sí',
          falseLabel: 'No',
          nullLabel: 'Sin selección',
          star: '1 estrella',
          stars: '{star} estrellas',
          selectAll: 'Seleccionar todos',
          unselectAll: 'Deseleccionar todos',
          close: 'Cerrar',
          previous: 'Anterior',
          next: 'Siguiente',
          navigation: 'Navegación',
          scrollTop: 'Ir al inicio',
          moveTop: 'Mover al inicio',
          moveUp: 'Mover arriba',
          moveDown: 'Mover abajo',
          moveBottom: 'Mover al final',
          moveToTarget: 'Mover al destino',
          moveToSource: 'Mover al origen',
          moveAllToTarget: 'Mover todo al destino',
          moveAllToSource: 'Mover todo al origen',
          pageLabel: 'Página {page}',
          firstPageLabel: 'Primera página',
          lastPageLabel: 'Última página',
          nextPageLabel: 'Página siguiente',
          previousPageLabel: 'Página anterior',
          rowsPerPageLabel: 'Filas por página',
          jumpToPageDropdownLabel: 'Ir a página',
          jumpToPageInputLabel: 'Ir a página',
          selectRow: 'Seleccionar fila',
          unselectRow: 'Deseleccionar fila',
          expandRow: 'Expandir fila',
          collapseRow: 'Colapsar fila',
          showFilterMenu: 'Abrir menú de filtros',
          hideFilterMenu: 'Cerrar menú de filtros',
          filterOperator: 'Operador de filtro',
          filterConstraint: 'Restricción de filtro',
          editRow: 'Editar fila',
          saveEdit: 'Guardar edición',
          cancelEdit: 'Cancelar edición',
          listView: 'Vista de lista',
          gridView: 'Vista de cuadrícula',
          slide: 'Diapositiva',
          slideNumber: '{slideNumber}',
          zoomImage: 'Ampliar imagen',
          zoomIn: 'Acercar',
          zoomOut: 'Alejar',
          rotateRight: 'Rotar derecha',
          rotateLeft: 'Rotar izquierda',
          listLabel: 'Lista de opciones',
          selectColor: 'Elegir color {color}',
          removeLabel: 'Quitar',
          browseFiles: 'Explorar archivos',
          maximizeLabel: 'Maximizar',
        },
      },
    }),
  ],
};
