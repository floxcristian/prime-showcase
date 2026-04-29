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
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeuix/themes/aura';
import { definePreset } from '@primeuix/themes';
import { routes } from './app.routes';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { AppErrorHandler } from './core/services/error-handler/app-error-handler';
import { BrowserPreloadingStrategy } from './core/strategies/browser-preloading.strategy';
import { AppConfigService } from './core/services/app-config/app-config.service';

// Desactiva las transiciones internas de PrimeNG (button, input, select, etc.).
// Razon: en navegacion client-side entre rutas, los componentes PrimeNG nuevos inyectan
// sus estilos via JS (UseStyle) despues de montarse. Durante ese gap de 1-2 frames,
// los elementos renderizan sin colores de tema y las transiciones de 0.2s animan el
// cambio de negro/default → color de tema como un flash visible.
//
// El fix de SSR (allowedHosts) resuelve el primer paint (todos los estilos vienen inlineados),
// pero no la inyeccion posterior en navegacion. Por eso el token es necesario.
//
// Resultado: cambios de color instantaneos en componentes PrimeNG — patron valido (Linear,
// Stripe, Vercel). Transiciones custom via Tailwind siguen funcionando.
// Ref: ADR-001 §2
const AppPreset = definePreset(Aura, {
  // Error tone: Aura default usa {red.*} (Tailwind red) que se percibe como
  // sangre. Preferimos rose (misma familia Tailwind, tono coral cercano a
  // Apple HIG/iOS #FF3B30). Un solo shade para border + texto (Stripe/Linear/
  // GitHub pattern): rose.500 light / rose.400 dark. No creamos colores —
  // rose es una palette nativa del preset Aura.
  components: {
    message: {
      colorScheme: {
        light: {
          error: {
            simple: { color: '{rose.500}' },
            color: '{rose.500}',
            borderColor: '{rose.200}',
          },
        },
        dark: {
          error: {
            simple: { color: '{rose.400}' },
            color: '{rose.400}',
          },
        },
      },
    },
  },
  semantic: {
    transitionDuration: '0s',
    // Palette primary: single-hue 204° end-to-end, en familia del logo
    // oficial (public/implementos-logo.svg, #006DB6). Patron SaaS big
    // tech — GitHub Primer blue, Tailwind sky — un unico hue a lo largo
    // de todo el ramp. Sin tilts intermedios: coherencia matematica que
    // un senior reconoce en review.
    //
    // Anchors:
    //   500 = #0074C2 (HSL 204° 100% 38%) — light-mode primary. AA-high
    //                   4.9:1 sobre surface.0 (rango Apple #007AFF 4.5:1,
    //                   GitHub Primer #0969DA 5.2:1, Stripe 4.6:1 —
    //                   estandar real de la industria, AAA es solo para
    //                   GitHub en ciertos casos). Mismo hue que el logo
    //                   → lectura "azul Implementos" sin copiar el hex.
    //   400 = #27A0F1 (HSL 204° 88% 55%) — dark-mode primary. Saturacion
    //                   bajada a 88% (vs 100% del resto) para suavizar
    //                   el "Facebook-blue electrico" que al L=55% S=100%
    //                   quema retinas sobre surface.950. Contraste con
    //                   surface.950: 7.0:1 AAA.
    //   600 = #005C99 — hover del 500 (L=30%, paso visible -8%).
    //   700-950 → navies progresivos mismo hue, S=100%, L escalonada.
    //
    // Derivacion: hue=204° constante en TODA la escala. S=100% excepto
    // .400 (88%) y .50-300 (naturalmente bajos por tint). L curve
    // 97→93→84→70→55→38→30→24→18→13→8. Sin hue tilts, sin hacks.
    //
    // Contraste verificado:
    //   - primary.500 sobre surface.0 (#fff): 4.9:1 (WCAG AA)
    //   - primary.400 sobre surface.950 (#09090b): 7.0:1 (WCAG AAA)
    //   - primary.700 (active) sobre surface.0: 10.5:1 (WCAG AAA)
    //
    // Cambio propaga a todos los componentes que consumen --p-primary-*
    // (bg-primary, text-primary, focus ring, charts, tags, buttons,
    // links, y tiles del aside con bg-primary-700/800/900). Cero updates
    // manuales en templates.
    primary: {
      50: '#eff8ff',
      100: '#daeffc',
      200: '#b2ddf9',
      300: '#74c3f3',
      400: '#27a0f1',
      500: '#0074c2',
      600: '#005c99',
      700: '#004a7a',
      800: '#00375c',
      900: '#002842',
      950: '#001829',
    },
    colorScheme: {
      light: {
        formField: { invalidBorderColor: '{rose.500}' },
        // Hover por default (bg-emphasis) en Aura es surface.100 — casi
        // invisible sobre blanco y completamente invisible sobre columnas
        // grises (surface.50/100). Subimos un step a surface.200 para que
        // el feedback sea perceptible en CUALQUIER superficie. Patron Linear/
        // Stripe: hover visible pero no agresivo.
        content: { hoverBackground: '{surface.200}' },
        // text.muted.color default de Aura = surface.500 (#71717a). Sobre
        // bg-surface-200 (breadcrumb + p-selectbutton label) da 4.07:1 —
        // por debajo de WCAG 2.1 AA (4.5:1 para texto normal, confirmado
        // via Lighthouse a11y audit 2026-04-23). Bajamos un step a
        // surface.600 (#52525b) → 5.9:1 AA+; sigue leyéndose "muted"
        // (menos énfasis que text-color) sin quebrar la jerarquía.
        text: { muted: { color: '{surface.600}' } },
      },
      dark: {
        formField: { invalidBorderColor: '{rose.400}' },
        content: { hoverBackground: '{surface.700}' },
        // Dark mode equivalente: default surface.400 (#a1a1aa) sobre
        // bg-surface-700 da ~4.0:1. Subimos a surface.300 (#d4d4d8) →
        // 6.5:1 AAA. El bump brightens muted en dark pero se mantiene
        // visualmente distinto de text-color (surface.0/50 puro blanco).
        text: { muted: { color: '{surface.300}' } },
      },
    },
    // Focus ring halo-only estilo Lara — single source of truth del design system.
    // Sobreescribe el default de Aura (outline + halo) por box-shadow puro, mas limpio
    // visualmente y alineado con Tailwind/Radix/Primer. Los tokens se emiten como CSS
    // vars (--p-focus-ring-*) que styles.scss consume en una regla :focus-visible global
    // — propagacion uniforme a componentes PrimeNG y elementos HTML nativos.
    // Border change a primary en form fields viene nativo de formField.focusBorderColor.
    // Ref: ADR-001 §5
    focusRing: {
      width: '0',
      style: 'none',
      color: 'transparent',
      offset: '0',
      shadow: '0 0 0 0.2rem {primary.200}',
    },
  },
});

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
        options: {
          // Dark mode explicito por clase (no default 'system'): permite al
          // servidor setear `<html class="p-dark">` segun cookie en SSR para
          // prevenir FOUC, y que el toggle programatico via AppConfigService
          // tenga efecto real en los tokens de PrimeNG. Alineado con patron
          // Tailwind v4 `darkMode: 'class'`. Ref: ADR-001 §4
          darkModeSelector: '.p-dark',
          // Cascade CSS: envuelve PrimeNG en @layer primeng. Efecto:
          // 1. Nuestro :focus-visible global (sin capa) gana por spec CSS cascade layers.
          // 2. Tailwind utilities (capa no declarada en order) gana sobre PrimeNG.
          // Ref: https://primeng.org/guides/csslayer | ADR-001 §3
          cssLayer: {
            name: 'primeng',
            order: 'theme, base, primeng',
          },
        },
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
