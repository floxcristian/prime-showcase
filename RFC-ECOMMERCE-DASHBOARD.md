# RFC: Transformación a Dashboard E-commerce — implementos.cl

**Fecha:** 2026-04-08
**Estado:** Borrador
**Autor:** Cristian Flores

---

## Tabla de contenidos

| # | Sección | Descripción |
|---|---------|-------------|
| 1 | [Contexto](#1-contexto) | Stack actual, deuda técnica, gaps estructurales |
| 2 | [Arquitectura propuesta](#2-arquitectura-propuesta) | Estructura de carpetas con origen de cada módulo |
| 3 | [Mapeo módulos](#3-mapeo-módulos-actuales--módulos-nuevos) | Tabla resumen de adaptación por módulo |
| 4 | [Detalle de módulos](#4-detalle-de-módulos) | Especificación de cada módulo (4.1–4.9) |
| 5 | [Layout, navegación y routing](#5-layout-navegación-y-routing) | Topbar, mobile, sidebar, breadcrumbs, rutas |
| 6 | [Consideraciones técnicas](#6-consideraciones-técnicas) | Forms, servicios, auth, API, performance, pipes |
| 7 | [Fases de implementación](#7-fases-de-implementación) | 6 fases con tareas detalladas |
| 8 | [Matriz PrimeNG](#8-matriz-de-reutilización-de-componentes-primeng) | Componentes existentes → destino + nuevos a agregar |
| 9 | [Riesgos](#9-riesgos-y-mitigación) | 10 riesgos con mitigación |
| 10 | [Testing](#10-estrategia-de-testing) | Qué testear, tipo, prioridad |
| 11 | [Decisiones abiertas](#11-decisiones-abiertas) | 10 decisiones pendientes con recomendación |
| 12 | [Modelo de dominio](#12-modelo-de-dominio) | Interfaces TypeScript de todas las entidades |
| 13 | [Permisos por rol](#13-matriz-de-permisos-por-rol) | 6 roles × 13 módulos |
| 14 | [Búsqueda, notificaciones, audit](#14-búsqueda-global-notificaciones-y-audit-trail) | Sistemas transversales |
| 15 | [Almacenamiento archivos](#15-almacenamiento-de-archivos-e-imágenes) | Estrategia de storage |
| 16 | [Contexto implementos.cl](#16-contexto-implementoscl) | Preguntas de dominio pendientes |
| 17 | [Ambientes y CI/CD](#17-ambientes-y-cicd) | Environments, pipeline |
| 18 | [Impresión y emails](#18-impresión-y-emails-transaccionales) | PDFs, etiquetas, emails automáticos |
| 19 | [Evolución AppConfigService](#19-evolución-de-appconfigservice) | Limpieza de estado legacy |
| 20 | [Fuera de alcance](#20-fuera-de-alcance-por-ahora) | Lo que no se incluye en este RFC |

---

## 1. Contexto

El proyecto actual (`prime-showcase`) es un demo de PrimeNG v19 con Angular v19 que incluye módulos genéricos: overview, chat, inbox, cards, customers y movies. El objetivo es transformarlo en un **dashboard administrativo para el e-commerce de implementos.cl**.

### Stack actual
- Angular 19.2 (standalone components, SSR, lazy loading, OnPush)
- PrimeNG 19.1 (tema Aura) + PrimeIcons 7
- Tailwind CSS 4 + tailwindcss-primeui 0.6
- Chart.js 4.5
- Express 4.18 (SSR)

### Qué ya funciona bien (mantener tal cual)
- **OnPush** en todos los componentes — no cambiar
- **Lazy loading** por ruta — ya configurado
- **Tema Aura** con dark mode funcional (AppConfigService + CSS variables)
- **Standalone components** — sin NgModules, patrón moderno
- **Tailwind + PrimeUI** — sistema de diseño integrado (bg-surface-0, text-muted-color, etc.)

### Deuda técnica actual a resolver
- Datos mock hardcodeados en los `.ts` de cada componente (excepto chat que usa `/mocks/`)
- Template-driven forms (`ngModel`) en todos lados — migrar a **reactive forms** para validación
- `DomSanitizer.bypassSecurityTrustHtml()` en customers para SVGs — reemplazar por componentes SVG
- `ChartModule` importado pero sin usar en customers y chat
- `MessageService` en providers locales de cards — mover a global
- Sin interceptors HTTP ni manejo de errores
- Sin guards de ruta

### Gaps estructurales detectados en el layout actual

| Gap | Estado actual | Impacto |
|-----|---------------|---------|
| **No hay topbar/header global** | Cada módulo implementa su propio header (overview tiene search + bell, otros no). No hay componente compartido | Alto — inconsistencia UX, duplicación |
| **Menú mobile inexistente** | `side-menu` tiene `hidden lg:block`, en mobile desaparece sin alternativa (no hay hamburger ni drawer) | Alto — inutilizable en tablet/mobile |
| **Sidebar no soporta submenús** | Interface `SidebarNavItem` solo tiene `{ icon, title, url }`. Sin `children`, `badge`, `disabled`, `visible` | Alto — el RFC propone navegación con 2 niveles |
| **Sin rutas dinámicas** | `app.routes.ts` es plano, sin `:id` ni rutas hijas. No hay ruta 404/wildcard | Medio — necesario para `/products/:id/edit`, `/orders/:id` |
| **Sin breadcrumbs** | No existe componente ni lógica de breadcrumbs | Medio — necesario con navegación profunda |
| **Tests 100% boilerplate** | Todos los `.spec.ts` solo tienen `should create` sin lógica real | Medio — sin red de seguridad para refactoring |
| **DesignerService vacío** | Importa HttpClient, signal, Aura preset pero no implementa nada | Bajo — eliminar o reproponer |
| **CSS layers deshabilitado** | `app.config.ts` tiene `cssLayer` comentado, posible conflicto Tailwind↔PrimeNG | Bajo — evaluar si causa problemas de especificidad |
| **Sin estados UI globales** | No hay loading states, empty states, ni error boundaries | Medio — UX incompleta |
| **AppConfigService.appState inicializado como `{} as AppState`** | Cast inseguro, puede causar errores en runtime si se accede antes de cargar localStorage | Bajo |

---

## 2. Arquitectura propuesta

```
src/app/
├── core/
│   ├── guards/            # auth.guard, role.guard
│   ├── interceptors/      # auth.interceptor, error.interceptor
│   ├── services/          # auth, app-config, notification
│   └── models/            # interfaces globales (User, ApiResponse, Pagination)
├── layouts/
│   ├── main/              # (refactorizar) agregar topbar global + mobile drawer
│   ├── topbar/            # (NUEVO) header global: búsqueda, notificaciones, usuario, breadcrumb
│   └── side-menu/         # (adaptar) extender interface + navegación agrupada con hijos
├── shared/
│   ├── components/        # breadcrumb, confirm-dialog, status-tag, data-table-wrapper,
│   │                      # empty-state, loading-skeleton, error-boundary
│   ├── pipes/             # currency-clp, rut-format, date-relative
│   └── directives/        # permission, click-outside
└── modules/
    ├── auth/              # (NUEVO) login, forgot-password, reset-password
    ├── dashboard/         # ← overview (adaptar KPIs y métricas)
    ├── catalog/           # ← cards (adaptar a productos, categorías, marcas)
    ├── orders/            # ← inbox (adaptar a pedidos, despachos, devoluciones)
    ├── customers/         # ← customers (extender con RUT, segmentación, historial)
    ├── crm/               # ← chat (adaptar a leads, seguimiento, cotizaciones)
    ├── cms/               # ← movies (adaptar a páginas, banners, blog)
    ├── marketing/         # cupones, promociones, campañas (nuevo + partes de movies/cards)
    ├── reports/           # ventas, inventario, clientes, financiero (nuevo)
    └── settings/          # tienda, pagos, despacho, usuarios, roles (nuevo)
```

---

## 3. Mapeo: módulos actuales → módulos nuevos

**Principio:** Adaptar todos los módulos existentes en lugar de eliminarlos. Cada componente ya tiene estructura UI armada con PrimeNG que se puede reutilizar.

| Actual | Acción | Nuevo módulo | Qué se reutiliza (verificado en código) | Qué cambia |
|--------|--------|-------------|----------------------------------------|------------|
| `overview` | **Adaptar** | `dashboard` | Chart (bar stacked con tooltip custom), MeterGroup (6 métricas), Table (paginada 5 filas), DatePicker (rango), SelectButton (Weekly/Monthly/Yearly) | Datos cripto → KPIs ventas. MeterGroup: wallets → distribución por categoría. SelectButton: períodos → mismos períodos pero con datos e-commerce |
| `customers` | **Adaptar** | `customers` | Table (11 filas, checkbox select, búsqueda), Popover (menú contextual), Tag (3 estados con color), Avatar+OverlayBadge (foto+estado online), Drawer (importado) | Agregar columnas RUT y segmento. Popover: Details/Delete → Ver/Editar/Historial. Tags: Active/Inactive/Prospect → Activo/Moroso/VIP/B2B |
| `inbox` | **Adaptar** | `orders` | Table (15 filas, scroll flex, bookmark toggle), sidebar izquierdo (w-64, navegación agrupada con iconos), ProgressBar (storage meter con template custom), Checkbox, Tag, Menu | Sidebar: carpetas email → estados pedido (Pendientes/En preparación/Despachados). Table: emails → pedidos. ProgressBar: storage → avance despacho. Bookmark → marcar urgente |
| `chat` | **Adaptar** | `crm` | Layout 3 columnas (4/12 + 6/12 + 3/12), lista con búsqueda+badges+estado activo, timeline mensajes (sent/received con SVG arrows), panel derecho (avatar, toggles, media grid), Textarea autoResize | Col izquierda: chats → leads/clientes. Col centro: mensajes → timeline actividad/notas. Col derecha: perfil contacto → ficha lead con datos comerciales. ToggleSwitch: notif → flags (prioritario, requiere seguimiento) |
| `cards` | **Adaptar** | `catalog` | FileUpload (drag-drop con progress), InputNumber (currency USD→CLP), AutoComplete (email chips → tags producto), Slider (rango dual precio), RadioButton (permisos → estado producto), ToggleSwitch (6 toggles → atributos on/off), Checkbox (specs → filtros) | Unificar 12 cards showcase en formulario CRUD con tabs. Profile card → ficha producto. File upload → galería imágenes. Price range → precio venta/costo. Descartar: InputOTP (no aplica para e-commerce) |
| `movies` | **Adaptar** | `cms` | Carousel (10 items, responsive breakpoints, prev/next con disabled logic), grid 4 columnas (responsive xl:4/md:2/1), SelectButton (5 tabs: Home/Movies/etc.), ProgressBar (watch % → publicación %), Badge rating (punto → prioridad) | Carousel: posters → banners rotativo. Grid: películas → artículos blog. SelectButton: géneros → tipo contenido (Páginas/Banners/Blog/Borradores). Cards: poster+rating+categories → thumbnail+estado+tags |
| — | **Crear** | `marketing` | Componente nuevo. **Copia patrones** de: grid 4-col de CMS (ex-movies) para campañas, Table de customers para cupones, formularios de catalog (ex-cards) para CRUD cupones/promos | No se renombra un módulo existente — se arma nuevo copiando patrones |
| — | **Crear** | `reports` | Componente nuevo. **Copia patrones** de: Chart de dashboard (ex-overview), Table de customers | Nuevo módulo |
| — | **Crear** | `settings` | Componente nuevo. **Copia patrones** de: sidebar de orders (ex-inbox), ToggleSwitch/formularios de catalog (ex-cards), Table de customers | Nuevo módulo |

---

## 4. Detalle de módulos

### 4.1 Dashboard

**Adapta:** `overview` → renombrar a `dashboard`
**Reutiliza:** Chart (bar stacked + custom tooltip plugin via `externalTooltipHandler`), MeterGroup (6 items con colores), Table (paginada, token styling transparente), DatePicker (range mode), SelectButton (período temporal)
**Ya tiene:** Effect hook que redibuja chart al cambiar dark/light mode (mantener)
**Componentes PrimeNG:** Chart, MeterGroup, Table, DatePicker, SelectButton

| Widget actual (overview) | Widget nuevo (dashboard) | Cambio |
|--------------------------|--------------------------|--------|
| Chart bar stacked (cripto) | Chart ventas por canal | Cambiar datasets: BTC/ETH → Web/Tienda/Marketplace |
| SelectButton Weekly/Monthly/Yearly | SelectButton Hoy/Semana/Mes/Año | Agregar opción "Hoy", mantener lógica de cambio de datos |
| MeterGroup wallets (BTC, ETH, etc.) | MeterGroup ventas por categoría | Cambiar labels y colores |
| Table transacciones (5 rows) | Table últimos pedidos (10 rows) | Agregar columnas: estado (Tag), monto (CLP), cliente |
| DatePicker rango | DatePicker rango | Mantener tal cual |
| — | KPI cards (nuevo) | Agregar fila superior: ventas hoy, pedidos pendientes, ticket promedio, tasa conversión |
| — | Alerta stock bajo (nuevo) | Agregar sección inferior con tabla de productos bajo mínimo |

### 4.2 Catálogo (`catalog`)

**Adapta:** `cards` → renombrar a `catalog`
**Reutiliza:** FileUpload (drag-drop con headerTemplate/contentTemplate/progress tracking), InputNumber (mode="currency", ya tiene formato moneda), AutoComplete (chip mode para tags), Slider (rango dual con 2 handles), RadioButton (selección exclusiva), ToggleSwitch (6 toggles boolean), Checkbox (specs con checked binding)
**Descartar de cards:** InputOTP (era para demo de verificación, no aplica), "Forgot Password" card (no relevante para catálogo — pero reutilizable en auth module login)
**Nota:** El módulo actual son 12 cards independientes tipo showcase. La estrategia es descomponer estas cards en secciones de un formulario CRUD con tabs.
**Submódulos:** productos, categorías, marcas, atributos, inventario

#### Productos
- **Lista:** Table (reutilizar de customers, que ya tiene filtros/búsqueda/popover) + export Excel
- **CRUD con tabs** (reorganizar las 12 cards actuales):
  - Tab General: Profile card → ficha producto (nombre, descripción, marca, categoría con AutoComplete)
  - Tab Precios: Price range card → precio venta (InputNumber currency CLP), costo, margen. Slider → rango de precio sugerido
  - Tab Inventario: InputNumber → stock, stock mínimo, SKU. Checkbox specs → atributos de bodega
  - Tab Imágenes: File upload card → galería de imágenes producto (mantener drag-drop + progress)
  - Tab SEO: InputText → meta title, description, slug
  - Tab Variantes: ToggleSwitch → atributos activos/inactivos por variante (talla, color)
- **Bulk actions:** cambio masivo de precios, estado, categoría
- **Componentes PrimeNG:** Table, FileUpload, InputNumber, Select, AutoComplete, Tag, Drawer, Slider, RadioButton, ToggleSwitch

#### Categorías
- **Árbol jerárquico:** TreeTable o Tree para categorías anidadas
- **CRUD:** nombre, slug, imagen, categoría padre, orden, estado

#### Marcas
- **Lista + CRUD:** nombre, logo, descripción, estado

#### Inventario
- **Vista stock:** Table con stock actual, stock mínimo, ubicación bodega
- **Movimientos:** registro de entradas/salidas con motivo
- **Alertas:** productos bajo stock mínimo

### 4.3 Pedidos (`orders`)

**Adapta:** `inbox` → renombrar a `orders`
**Reutiliza:** Sidebar izquierdo (w-64 con navegación agrupada por secciones "Navigation"/"Other" → "Estados"/"Filtros"), Table (15 filas, scrollHeight flex, bookmark toggle), ProgressBar (template custom con texto centrado), Checkbox (selección múltiple), Menu (acciones de toolbar: envelope/alerts/tags → imprimir/exportar/cambiar estado), Tag (tipos email → estados pedido)
**Layout actual que se mantiene:** Panel izquierdo fijo + tabla derecha scrolleable. Exactamente el patrón que necesita un gestor de pedidos.
**Submódulos:** pedidos, despachos, devoluciones

#### Pedidos
- **Lista:** Table existente con estas adaptaciones:
  - Bookmark toggle → marcar pedido urgente/prioritario
  - Avatar + badge → cliente con estado (activo/moroso)
  - Title + message preview → #orden + resumen items
  - Tag type → Tag estado (Pendiente/Confirmado/Preparando/Despachado/Entregado)
  - Time → fecha pedido + monto CLP
- **Sidebar navegación** (adaptar inboxNavs):
  - Sección "Estados": Todos, Pendientes (con badge count), En preparación, Despachados, Entregados, Cancelados
  - Sección "Filtros": Hoy, Esta semana, Este mes, Urgentes
  - ProgressBar storage → ProgressBar "pedidos despachados hoy: 12/20"
- **Detalle:** Drawer (traer de customers) con timeline de estados, productos, datos cliente, pago
- **Componentes PrimeNG:** Table, Tag, Stepper (nuevo), Drawer, Divider, ProgressBar, Checkbox, Menu

#### Despachos
- **Lista:** pedidos por despachar, en tránsito, entregados
- **Integración:** Chilexpress, Starken, Bluexpress (tracking)
- **Etiquetas:** generación de etiquetas de envío

#### Devoluciones
- **Flujo:** solicitud → aprobación → recepción → reembolso
- **Motivos:** defectuoso, equivocado, garantía, arrepentimiento

### 4.4 Clientes (`customers`)

**Adapta:** `customers` → mantener nombre, extender funcionalidad
**Reutiliza:** Table (11 filas con checkbox row select, búsqueda con IconField, filtro/refresh buttons), Popover (menú contextual Details/Delete con toggle ref), Tag (3 severities: success/danger/info), Avatar + OverlayBadge (foto + estado online), DrawerModule (importado pero sin usar aún en template → implementar)
**Resolver:** Eliminar `DomSanitizer.bypassSecurityTrustHtml()` para logos SVG → usar componentes SVG o `<img>` con URLs

- **Lista — adaptar tabla existente:**
  - Agregar columnas: RUT (con pipe format), segmento (B2B/B2C tag), última compra, total compras
  - Popover: "Details/Delete" → "Ver ficha / Editar / Historial compras / Crear cotización"
  - Tags: Active/Inactive/Prospect → Activo/Moroso/VIP/B2B/Nuevo
  - Mantener: checkbox select, búsqueda, avatar+badge, company con logo
- **Ficha cliente — implementar Drawer** (ya importado, falta template):
  - Datos personales, RUT, dirección, contacto
  - Historial compras (mini-table)
  - Crédito disponible, deuda, estado de pago
  - Chart (ya importado) → gráfico de compras por mes
- **Segmentos:** etiquetas, grupos de clientes, listas de precios diferenciadas
- **Componentes PrimeNG:** Table, Drawer, Popover, Tag, Avatar, OverlayBadge, Chart, IconField

### 4.5 CRM

**Adapta:** `chat` → renombrar a `crm`
**Reutiliza:** Layout 3 columnas responsive (w-4/12 + w-6/12 + w-3/12 en xl), lista lateral con búsqueda + SelectButton tabs + badges + estado activo, timeline de mensajes (sent/received con flex-row-reverse, SVG arrow indicators), panel derecho (avatar grande, action buttons, ToggleSwitch x3, members list, media grid), Textarea autoResize para input
**Mocks reutilizables:** ChatItem (→ LeadItem), ChatMessage (→ ActivityNote), ChatMember (→ TeamMember). Adaptar interfaces en `/models/`.
**Submódulos:** leads, oportunidades, seguimiento

- **Lista leads (col izquierda)** — adaptar chat list:
  - ChatItem.name → lead nombre empresa
  - ChatItem.lastMessage → último contacto/nota
  - ChatItem.unreadMessageCount → tareas pendientes (badge)
  - ChatItem.active → estado lead (caliente/tibio/frío con color)
  - SelectButton Chat/Call → Todos/Nuevos/En proceso/Cerrados
- **Timeline actividad (col centro)** — adaptar message thread:
  - Messages sent/received → notas internas (vendedor) / interacciones cliente (email, llamada, visita)
  - SVG arrows → mantener para diferenciar dirección
  - Attachment images → archivos adjuntos (cotizaciones PDF, fotos)
  - Input textarea → agregar nueva nota/actividad
- **Ficha lead (col derecha)** — adaptar contact details:
  - Avatar → logo empresa
  - Action buttons (phone/video/info) → llamar/email/editar/convertir a cliente
  - ToggleSwitch notif/sound/save → prioritario/requiere seguimiento/asignado a mí
  - Members → equipo comercial asignado
  - Media grid → documentos adjuntos (cotizaciones, contratos)
- **Cotizaciones:** generación y envío de cotizaciones PDF

### 4.6 CMS

**Adapta:** `movies` → renombrar a `cms`
**Reutiliza:** Carousel (películas → preview de banners), cards con imagen (posters → thumbnails de páginas/artículos), SelectButton (filtros de género → filtros de tipo contenido), ProgressBar (rating → estado publicación)
**Submódulos:** páginas, banners, blog, SEO

#### Páginas
- **Lista + editor:** páginas estáticas (nosotros, contacto, políticas) — reutilizar cards de `movies` como lista visual
- **Editor:** rich text con PrimeNG Editor o integración Quill/TipTap

#### Banners
- **CRUD:** imagen, link, posición (home hero, sidebar, categoría), fechas activo
- **Preview:** vista previa con Carousel de `movies` adaptado a banners rotativos
- **Componentes PrimeNG:** FileUpload, DatePicker, Select, InputText

#### Blog
- **Lista + editor:** artículos, categorías, tags, autor — reutilizar layout de grid de `movies`
- **SEO:** meta title, meta description, slug, og:image

### 4.7 Marketing

**Módulo nuevo** (no renombra ningún módulo existente). Copia patrones de 2 fuentes:
- De `cms` (ex-movies): copiar patrón grid 4 columnas con cards visuales → lista de campañas con thumbnail, estado, métricas
- De `catalog` (ex-cards): copiar patrón InputNumber (currency → monto descuento), Slider (rango → % descuento), Checkbox (specs → restricciones), DatePicker (de dashboard → vigencia)
**Nota:** Al ser módulo nuevo, se crean archivos desde cero copiando los patrones. No se "comparte" el componente movies con CMS.
**Submódulos:** cupones, promociones, campañas

#### Cupones
- **Lista:** Table (patrón de customers) con columnas: código, tipo, valor, usos/max, vigencia, estado
- **CRUD formulario** (reutilizar de cards):
  - InputText → código cupón (o generación automática)
  - RadioButton → tipo descuento (% / monto fijo / envío gratis)
  - InputNumber currency → monto descuento CLP o Slider → porcentaje
  - InputNumber → monto mínimo compra, usos máximos
  - DatePicker range → fecha inicio/fin vigencia
  - AutoComplete chip → restricción por categoría, marca
  - Checkbox → primera compra, cliente específico
- **Componentes PrimeNG:** Table, InputNumber, Slider, RadioButton, DatePicker, AutoComplete, Checkbox, Tag

#### Promociones
- **Lista:** grid visual (reutilizar de movies) con card por promoción: imagen, nombre, tipo, productos, vigencia
- **Tipos:** 2x1, pack, descuento por volumen, envío gratis
- **Reglas:** condiciones de activación, productos aplicables (AutoComplete multi)

#### Campañas
- **Lista:** grid 4-col (de movies) con métricas por campaña: enviados, abiertos, clicks
- **Email marketing:** plantillas, listas, envío, métricas apertura/clic
- **Integración:** Brevo / Resend API

### 4.8 Reportería (`reports`)

**Módulo nuevo.** Reutiliza Chart de overview (bar stacked + tooltip custom + effect dark mode) y Table de customers (paginada + filtros + búsqueda).
**Componentes PrimeNG:** Chart, Table, DatePicker, Select, Button (export), Tabs

**Layout por reporte:** Tabs para navegar entre reportes. Cada reporte tiene:
1. Barra filtros: DatePicker rango + Select (categoría/marca/vendedor) + botón Export
2. KPI cards resumen (reutilizar patrón de dashboard)
3. Chart principal (configurable: línea, barra, dona)
4. Table detalle con datos tabulares

| Reporte | Chart | KPIs | Table detalle |
|---------|-------|------|---------------|
| **Ventas** | Línea temporal ventas/día + barra por canal | Total vendido, #pedidos, ticket promedio, crecimiento vs período anterior | Lista de ventas: fecha, #orden, cliente, monto, canal |
| **Productos** | Barra horizontal top 10 + dona por categoría | #productos activos, sin stock, margen promedio | Lista: producto, vendidos, ingresos, margen %, stock |
| **Clientes** | Línea nuevos vs recurrentes/mes | Total clientes, nuevos este mes, LTV promedio, tasa retención | Lista: cliente, #compras, total gastado, última compra, segmento |
| **Inventario** | Barra valorización por categoría | Valor total inventario, #bajo stock, #sin movimiento 30d | Lista: producto, stock, mínimo, última venta, rotación |
| **Financiero** | Línea ingresos vs costos/mes | Ingreso total, costo total, margen bruto, margen % | Lista: categoría, ingresos, costos, margen, % del total |
| **Despachos** | Barra tiempo promedio por carrier | Promedio días entrega, costo envío promedio, tasa devolución | Lista: pedido, carrier, días, costo, estado |

**Export:**
- **Excel:** SheetJS (`xlsx`) — exportar tabla visible con filtros aplicados
- **PDF:** jsPDF + autoTable — reporte con logo, filtros, chart como imagen, tabla
- **Botón export** en cada reporte: Select (Excel/PDF) + Button descargar

**Filtros compartidos:**
- DatePicker rango (reutilizar de dashboard, ya en range mode)
- Select período rápido: Hoy, Esta semana, Este mes, Este año, Custom
- Select comparación: vs período anterior, vs mismo período año anterior
- Drill-down: click en barra de chart filtra tabla automáticamente

### 4.9 Configuración (`settings`)

**Módulo nuevo.** Reutiliza ToggleSwitch de cards/chat (para activar/desactivar features), formularios InputText/InputNumber de cards, y Table de customers (para CRUD usuarios).
**Layout:** Sidebar izquierdo con secciones (reutilizar patrón de inbox) + panel derecho con formularios.
**Componentes PrimeNG:** Tabs, InputText, InputNumber, ToggleSwitch, FileUpload (logo), Select, Table, Tag, Drawer, ConfirmDialog

| Sección | Campos | Componentes reutilizados |
|---------|--------|--------------------------|
| **Tienda** | Nombre, logo (FileUpload), RUT empresa, giro, dirección, teléfono, email, horarios | FileUpload de cards, InputText |
| **Pagos** | Habilitar/deshabilitar: Webpay, Flow, transferencia. Credenciales por método, cuenta bancaria para transferencias | ToggleSwitch de cards/chat, InputText para keys |
| **Despacho** | Zonas con tarifa (Table editable), peso máximo, retiro en tienda (ToggleSwitch), carriers habilitados | Table de customers, ToggleSwitch, InputNumber |
| **Impuestos** | IVA 19% (default), exenciones por categoría | InputNumber, Select |
| **Usuarios** | Table CRUD: nombre, email, rol, estado, último login. Drawer para crear/editar | Table + Popover de customers, Drawer |
| **Roles** | Table de roles + matriz de permisos (checkbox grid por módulo × acción) | Table, Checkbox grid |
| **Integraciones** | Estado conexión por servicio (Tag success/danger), credenciales, webhooks URL | Tag, InputText, ToggleSwitch |
| **Auditoría** | Table de audit logs filtrable por usuario/entidad/fecha/acción, solo lectura | Table con filtros, DatePicker, Select |

---

## 5. Layout, navegación y routing

### 5.1 Topbar global (NUEVO — no existe actualmente)

**Problema:** No hay header global. Overview implementa su propio search + notification bell, pero el resto de módulos no tienen nada. Esto causa inconsistencia y duplicación.

**Solución:** Crear `layouts/topbar/topbar.component.ts` e incluirlo en `main.component.html`:

```
┌──────────────────────────────────────────────────────────┐
│ [☰]  implementos.cl    [🔍 Buscar...]   [🔔 3]  [👤 CF] │  ← topbar (NUEVO)
├────────┬─────────────────────────────────────────────────┤
│        │  Dashboard > Ventas                             │  ← breadcrumb (NUEVO)
│ Side   │─────────────────────────────────────────────────│
│ Menu   │                                                 │
│        │              <router-outlet>                    │
│        │                                                 │
└────────┴─────────────────────────────────────────────────┘
```

| Elemento topbar | Fuente actual | Acción |
|-----------------|---------------|--------|
| Hamburger menu (mobile) | No existe | Crear — toggle sidebar como Drawer en mobile |
| Logo + nombre tienda | Solo en side-menu (slim: icon, expanded: text) | Mover a topbar |
| Búsqueda global | overview tiene `IconField` + `InputIcon` | Extraer a topbar, hacerlo global |
| Notificaciones bell | overview tiene `OverlayBadge` con badge rojo | Extraer a topbar con dropdown de notificaciones |
| Avatar usuario | side-menu footer tiene avatar + nombre | Mover a topbar con dropdown (perfil, cerrar sesión) |
| Breadcrumb | No existe | Crear con PrimeNG `Breadcrumb` bajo topbar |

### 5.2 Mobile responsive (NUEVO — actualmente roto)

**Problema:** `side-menu` tiene `hidden lg:block`. En pantallas < 1024px el menú desaparece completamente. No hay alternativa.

**Solución:**
- **Desktop (lg+):** sidebar fijo como está actualmente
- **Tablet/Mobile (<lg):** hamburger en topbar que abre sidebar como `p-drawer` (PrimeNG Drawer, ya importado en customers)
- **Acción:** En `main.component.html`, agregar `<p-drawer>` con el mismo `SideMenuComponent` dentro, visible solo en mobile

### 5.3 Sidebar: extender interface

**Interface actual (demasiado simple):**
```typescript
// sidebar-nav-item.interface.ts
{ icon: string; title: string; url: string }
```

**Interface propuesta:**
```typescript
interface SidebarNavItem {
  icon: string;
  title: string;
  url?: string;             // opcional si tiene children
  children?: SidebarNavItem[]; // submenú
  badge?: number;           // contador (pedidos pendientes, etc.)
  badgeSeverity?: string;   // 'danger' | 'warning' | 'info'
  visible?: boolean | (() => boolean);  // ocultar por rol
  disabled?: boolean;
  separator?: boolean;      // línea divisoria
}
```

### 5.4 Navegación sidebar propuesta

```
📊 Dashboard
📦 Catálogo
   ├── Productos
   ├── Categorías
   ├── Marcas
   └── Inventario
🛒 Pedidos                    [badge: 12 pendientes]
   ├── Todos los pedidos
   ├── Despachos
   └── Devoluciones
👥 Clientes
   ├── Lista clientes
   └── Segmentos
💼 CRM
   ├── Pipeline
   ├── Cotizaciones
   └── Seguimiento
───────────────── (separator)
📝 CMS
   ├── Páginas
   ├── Banners
   └── Blog
🎯 Marketing
   ├── Cupones
   ├── Promociones
   └── Campañas
📈 Reportes
   ├── Ventas
   ├── Productos
   ├── Clientes
   └── Financiero
───────────────── (separator)
⚙️ Configuración              [visible: solo admin]
   ├── Tienda
   ├── Pagos y despacho
   ├── Usuarios y roles
   └── Integraciones
```

### 5.5 Estrategia de routing

**Actual:** Rutas planas sin parámetros, sin guards, sin 404.

**Propuesto:**
```typescript
// app.routes.ts
{
  path: 'auth',
  children: [
    { path: 'login', loadComponent: () => ... },
    { path: 'forgot-password', loadComponent: () => ... },
  ]
},
{
  path: '',
  component: MainComponent,
  canActivate: [authGuard],
  children: [
    { path: '', loadComponent: () => import('./modules/dashboard/...') },
    {
      path: 'catalog',
      children: [
        { path: '', loadComponent: () => import('./modules/catalog/product-list/...') },
        { path: 'products/:id', loadComponent: () => import('./modules/catalog/product-detail/...') },
        { path: 'products/:id/edit', loadComponent: () => import('./modules/catalog/product-form/...') },
        { path: 'categories', loadComponent: () => import('./modules/catalog/categories/...') },
        { path: 'brands', loadComponent: () => import('./modules/catalog/brands/...') },
        { path: 'inventory', loadComponent: () => import('./modules/catalog/inventory/...') },
      ]
    },
    {
      path: 'orders',
      children: [
        { path: '', loadComponent: () => ... },
        { path: ':id', loadComponent: () => ... },
        { path: 'shipping', loadComponent: () => ... },
        { path: 'returns', loadComponent: () => ... },
      ]
    },
    // ... similar para customers, crm, cms, marketing, reports, settings
    { path: '**', redirectTo: '' }  // 404 → dashboard
  ]
}
```

**Cambios clave vs actual:**
- Rutas con `:id` para detalle/edición de productos, pedidos, clientes
- Rutas hijas por módulo (catalog/products, catalog/categories, etc.)
- `authGuard` en el layout principal
- Ruta wildcard `**` para 404
- Módulo `auth` fuera del layout principal (sin sidebar)

---

## 6. Consideraciones técnicas

### Migración de formularios
- **Actual:** Template-driven forms (`ngModel` + `FormsModule`) en todos los módulos
- **Propuesto:** Migrar a **Reactive Forms** (`FormGroup`, `FormControl`, `Validators`) para:
  - Validación compleja (RUT chileno, stock mínimo < stock actual, precios > 0)
  - Formularios dinámicos (variantes de producto, campos condicionales)
  - Testing más fácil
- **Estrategia:** Migrar por módulo, empezando por catalog (el más intensivo en formularios)

### Extracción de datos mock a servicios
- **Actual:** Mock data en `ngOnInit()` de cada componente, excepto chat que usa `mocks/`
- **Propuesto:** Crear servicios por dominio (`ProductService`, `OrderService`, etc.) que:
  - Fase 1: Retornan datos mock (misma data, pero desde el servicio)
  - Fase 2: Hacen HTTP real al backend
  - Patrón: `service.getProducts()` → `Observable<Product[]>` o `Signal<Product[]>`

### Autenticación y autorización
- Login con JWT (access + refresh token)
- Guard por ruta + directiva estructural `*hasPermission` en templates
- Roles: Super Admin, Admin, Vendedor, Bodeguero, Marketing, Soporte
- **Interceptors a crear:**
  - `authInterceptor`: inyecta Bearer token en headers
  - `errorInterceptor`: manejo global de 401 (redirect login), 403 (toast), 500 (retry)

### API
- REST API con paginación offset (compatible con `p-table` lazy loading)
- DTOs tipados con interfaces TypeScript — **evolucionar las interfaces existentes** en `models/`
- Response wrapper: `{ data: T[], meta: { total, page, perPage } }`

### Integraciones Chile
| Servicio | Uso | Prioridad |
|----------|-----|-----------|
| **Transbank Webpay Plus** | Pagos con tarjeta crédito/débito | Alta — core |
| **SII** | Facturación electrónica (DTE: boleta, factura) | Alta — legal |
| **Chilexpress** | Cálculo tarifas y tracking | Media |
| **Starken / Bluexpress** | Alternativas despacho | Baja |
| **Correos de Chile** | Despacho económico | Baja |
| **Flow.cl** | Alternativa pagos (más simple que Transbank) | Media — evaluar |

### Estados UI globales (NUEVO — no existe actualmente)

Actualmente no hay manejo de loading, empty, ni error states. Crear componentes shared:

| Componente | Uso | Implementación |
|------------|-----|----------------|
| `<app-loading-skeleton>` | Mientras carga data de API | PrimeNG `Skeleton` con layout configurable (table/cards/form) |
| `<app-empty-state>` | Tabla sin resultados, lista vacía | Icono + mensaje + botón acción ("Crear primer producto") |
| `<app-error-boundary>` | Error de API, timeout, 500 | Mensaje amigable + botón reintentar |

### DesignerService: decisión

**Actual:** Servicio vacío que importa HttpClient, signal, Aura preset, MessageService pero no implementa nada.

**Opciones:**
1. **Eliminar** — no aporta nada y genera confusión
2. **Reproponer como ThemeService** — manejar branding de implementos.cl (colores corporativos, logo, preset custom)

**Recomendación:** Opción 2 — renombrar a `ThemeService`, usar para aplicar branding de implementos.cl sobre Aura preset.

### Performance (ya existente + mejoras)
- Lazy loading por módulo — **ya implementado** ✓
- OnPush change detection — **ya implementado** ✓
- Dark mode con CSS variables + `effect()` — **ya implementado** ✓
- Build budget: 500KB initial / 1MB max — **ya configurado** ✓
- Zone change detection con `eventCoalescing: true` — **ya configurado** ✓
- SSR con hydration + event replay — **ya configurado** ✓
- **Agregar:** Virtual scroll en tablas >100 filas (`virtualScroll` en p-table)
- **Agregar:** Caché de catálogos con `signal()` + `computed()` de Angular 19
- **Agregar:** Skeleton loaders durante carga de datos (PrimeNG Skeleton)
- **Evaluar:** CSS layers (`cssLayer` en app.config.ts está comentado) — habilitar si hay conflictos de especificidad Tailwind vs PrimeNG

### Pipes útiles a crear
| Pipe | Input → Output | Ejemplo |
|------|----------------|---------|
| `clpCurrency` | `12990` → `$12.990` | Peso chileno, sin decimales, con puntos |
| `rutFormat` | `123456789` → `12.345.678-9` | RUT chileno con dígito verificador |
| `relativeDate` | `Date` → `"hace 2 horas"` | Timestamps legibles |
| `orderStatus` | `'shipped'` → `{ label: 'Despachado', severity: 'info' }` | Estado → Tag config |
| `truncate` | `string` → `string` (max chars) | Ya usado inline en inbox, extraer a pipe |

---

## 7. Fases de implementación

### Fase 1 — Fundación, layout y renombrado

**1a. Layout global (crítico — bloquea todo lo demás):**
- [ ] Crear `layouts/topbar/` con búsqueda global, notificaciones, avatar usuario, breadcrumb
- [ ] Refactorizar `main.component.html`: agregar topbar + breadcrumb entre sidebar y content
- [ ] Mobile responsive: agregar `p-drawer` en main con sidebar dentro, hamburger en topbar
- [ ] Extender `SidebarNavItem` interface: agregar `children`, `badge`, `visible`, `separator`
- [ ] Adaptar `side-menu` template: renderizar submenús colapsables (click to expand)
- [ ] Eliminar headers duplicados de overview (search + bell → ahora en topbar)

**1b. Renombrado y rutas:**
- [ ] Renombrar módulos: overview→dashboard, inbox→orders, chat→crm, cards→catalog, movies→cms
- [ ] Refactorizar `app.routes.ts`: rutas anidadas con `:id`, auth fuera de layout, wildcard 404
- [ ] Actualizar `sidebar-nav-items.ts` con nueva estructura agrupada
- [ ] Crear módulo `auth/` (login, forgot-password) fuera del layout principal:
  - Login: reutilizar InputText + Button de cards. Layout centrado, logo implementos.cl, campos email/password, link "olvidé mi contraseña"
  - Forgot password: reutilizar InputOTP de cards (aquí sí aplica para código verificación) + InputText email
  - Reset password: InputText nuevo password + confirmación

**1c. Core y deuda técnica:**
- [ ] Crear `core/guards/auth.guard.ts` y `core/guards/role.guard.ts`
- [ ] Crear `core/interceptors/` (auth headers, error handling global)
- [ ] Limpiar: imports sin usar (ChartModule en customers/chat), DomSanitizer en customers
- [ ] Extraer mock data a servicios por dominio (`ProductService`, `OrderService`, etc.)
- [ ] Mover `MessageService` de providers locales (cards) a `app.config.ts` global
- [ ] Decidir: eliminar `DesignerService` o renombrar a `ThemeService` para branding

**1d. Shared components y pipes:**
- [ ] Crear: `status-tag`, `confirm-dialog`, `data-table-wrapper`, `empty-state`, `loading-skeleton`
- [ ] Crear pipes: `clpCurrency`, `rutFormat`, `relativeDate`, `orderStatus`, `truncate`
- [ ] Habilitar `Toast` global (PrimeNG) + `ConfirmDialog` global

### Fase 2 — Core commerce
- [ ] **Dashboard:** Adaptar overview → KPIs ventas. Cambiar datasets chart, MeterGroup labels, agregar KPI cards superiores. Eliminar header local (search + bell ya están en topbar)
- [ ] **Catálogo:** Reorganizar 12 cards de showcase en formulario CRUD con tabs (general/precios/inventario/imágenes/SEO). Migrar a reactive forms. Descartar InputOTP (no aplica aquí — va a auth)
- [ ] **Catálogo:** Agregar lista productos (copiar patrón Table de customers), categorías (TreeTable), marcas
- [ ] **Pedidos:** Adaptar sidebar inbox (estados pedido), tabla (emails→órdenes), ProgressBar (tracking)
- [ ] **Pedidos:** Implementar Drawer detalle pedido con Stepper de estados
- [ ] **Pedidos:** Crear PdfService para impresión: orden de pedido, etiqueta despacho, bulk print

### Fase 3 — Clientes y CRM
- [ ] **Customers:** Agregar columnas RUT/segmento. Implementar Drawer (ya importado, sin template). Expandir Popover menú
- [ ] **CRM:** Adaptar chat 3 columnas → leads/timeline actividad/ficha. Migrar interfaces ChatItem→LeadItem, etc.
- [ ] **CRM:** Cotizaciones PDF (nueva funcionalidad)
- [ ] **Clientes↔CRM:** Link entre ficha cliente y timeline CRM (navegación cruzada)

### Fase 4 — Contenido y marketing
- [ ] **CMS:** Adaptar carousel movies → preview banners. Grid películas → lista artículos blog. SelectButton → filtro tipo contenido
- [ ] **CMS:** Agregar editor rich text para páginas y blog
- [ ] **Marketing:** Crear cupones/promociones reutilizando InputNumber/Slider/DatePicker de cards
- [ ] **Marketing:** Campañas con grid visual (reutilizar grid 4-col de movies)

### Fase 5 — Reportería y configuración
- [ ] **Reports (nuevo):** Layout con Tabs por reporte. Reutilizar Chart de dashboard + Table de customers
- [ ] **Reports:** 6 reportes (ventas, productos, clientes, inventario, financiero, despachos) con KPIs + chart + tabla
- [ ] **Reports:** Export PDF (jsPDF + autoTable) y Excel (SheetJS). Drill-down chart → tabla
- [ ] **Settings (nuevo):** Sidebar secciones + panel formularios (patrón inbox). Tienda, pagos, despacho, impuestos
- [ ] **Settings:** CRUD usuarios (Table de customers) + roles con matriz permisos (checkbox grid)
- [ ] **Settings:** Auditoría — tabla de audit logs filtrable, integrar con AuditLog del backend

### Fase 6 — Integraciones y emails
- [ ] Transbank Webpay Plus (o Flow.cl como alternativa más simple)
- [ ] Facturación electrónica SII (DTE) → genera boleta/factura PDF
- [ ] Couriers (Chilexpress API) → tarifas + tracking
- [ ] Email transaccional: confirmación pedido, notificación despacho, reset password (Resend/Brevo)
- [ ] Email marketing: campañas desde módulo marketing
- [ ] Evolucionar AppConfigService: limpiar campos legacy (designerKey, RTL, preset) → AppState simplificado

---

## 8. Matriz de reutilización de componentes PrimeNG

Componentes ya usados en el proyecto y cómo se redistribuyen:

| Componente PrimeNG | Usado en (actual) | Se usa en (nuevo) | Notas |
|--------------------|--------------------|--------------------|-------|
| **Table** | overview, customers, inbox | dashboard, catalog, orders, customers, reports | Componente más reutilizado. Extraer wrapper shared |
| **Chart** | overview | dashboard, reports, customers (ficha) | Mantener `externalTooltipHandler` y effect() de dark mode |
| **FileUpload** | cards | catalog (imágenes producto), cms (banners) | Mantener drag-drop + progress template |
| **Carousel** | movies | cms (banners), marketing (campañas) | Mantener responsive breakpoints config |
| **Drawer** | customers (importado) | orders (detalle pedido), customers (ficha), catalog (detalle producto) | Implementar template — actualmente importado pero sin usar |
| **Popover** | customers | customers, orders, catalog | Expandir opciones del menú contextual |
| **MeterGroup** | overview | dashboard | Cambiar labels/colores |
| **DatePicker** | overview | dashboard, orders, marketing, reports | Range mode ya configurado |
| **SelectButton** | overview, chat, cards, movies | dashboard, crm, cms | Adaptar opciones por contexto |
| **ProgressBar** | inbox, movies | orders (tracking), cms (estado publicación) | Mantener custom template de inbox |
| **AutoComplete** | cards | catalog (tags/categorías), crm (búsqueda leads) | Chip mode ya implementado |
| **InputNumber** | cards | catalog (precios CLP), marketing (descuentos) | Cambiar currency USD→CLP |
| **Slider** | cards | catalog (rango precio), marketing (% descuento) | Mantener dual-handle mode |
| **ToggleSwitch** | chat, cards, customers, inbox | crm (flags lead), settings (config), catalog (atributos) | Ya usado en 4 módulos |
| **Avatar/Badge** | todos | todos | Patrón universal, mantener |
| **Tag** | overview, cards, customers, inbox | todos | Crear pipe `orderStatus` para mapear severity automático |

### Componentes PrimeNG nuevos a agregar

| Componente | Módulo | Uso |
|------------|--------|-----|
| **TreeTable / Tree** | catalog | Categorías jerárquicas |
| **Stepper** | orders | Flujo de estados del pedido |
| **Editor** | cms | Editor rich text para páginas y blog |
| **Skeleton** | shared | Loading states en todos los módulos |
| **ConfirmDialog** | shared | Confirmación de acciones destructivas |
| **Toast** | shared (global) | Notificaciones — ya existe MessageService en cards |
| **Tabs** | catalog, settings | Formularios multi-tab |
| **DragDrop** | crm | Kanban pipeline |

---

## 9. Riesgos y mitigación

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| **Topbar no existe** — crear layout global es prerequisito de todo lo demás | **Crítico** | Hacer en Fase 1a como primera tarea. Bloquea renombrado de módulos |
| **Mobile completamente roto** — sidebar `hidden lg:block` sin alternativa | **Alto** | Agregar `p-drawer` mobile en Fase 1a. Drawer ya importado en customers, patrón conocido |
| **Sidebar no soporta hijos** — interface es `{ icon, title, url }` y el RFC propone 2 niveles | **Alto** | Extender interface y template en Fase 1a antes de agregar rutas anidadas |
| `cards` tiene 12 cards independientes, reorganizar en tabs CRUD es trabajo significativo | Alto | Fase 2: empezar con 3 tabs (general, precios, imágenes), agregar el resto incrementalmente |
| `chat` layout 3 columnas asume mensajería, CRM tiene flujos distintos (pipeline, cotizaciones) | Medio | Mantener layout 3 columnas para seguimiento. Pipeline kanban es vista separada, no adaptar chat para eso |
| Template-driven → Reactive forms es migración manual archivo por archivo | Medio | Migrar solo los módulos que necesitan validación compleja (catalog, customers, crm). Dejar dashboard y cms con ngModel |
| `movies` tiene lógica de carousel/grid para contenido multimedia, CMS necesita CRUD | Medio | Mantener carousel para preview banners. Agregar Table para lista editable (no forzar grid visual para CRUD) |
| SSR + auth — `AppConfigService` usa localStorage directamente, guards necesitan browser | Medio | `isPlatformBrowser()` ya usado en AppConfigService. Aplicar mismo patrón en guards y nuevos servicios |
| **0% test coverage real** — todos los spec.ts son boilerplate `should create` | Medio | No bloquea desarrollo, pero agregar tests de servicios críticos (auth, order status) en cada fase |
| **Routing plano → anidado** es cambio grande que afecta sidebar active state, breadcrumbs, guards | Medio | Migrar rutas incrementalmente por módulo en Fase 1b, no todas a la vez |

---

## 10. Estrategia de testing

**Estado actual:** 0% coverage real. Todos los `.spec.ts` son boilerplate Angular CLI (`should create`).

**Propuesta pragmática** — no buscar 100% coverage, sino cubrir lo crítico:

| Qué testear | Tipo test | Prioridad | Cuándo |
|--------------|-----------|-----------|--------|
| Pipes (`clpCurrency`, `rutFormat`, `orderStatus`) | Unit | Alta | Fase 1 — son puros, fáciles de testear |
| Guards (`authGuard`, `roleGuard`) | Unit | Alta | Fase 1 — lógica de seguridad |
| Interceptors (auth header, error handling) | Unit | Alta | Fase 1 |
| Servicios de dominio (OrderService, ProductService) | Unit | Media | Fase 2-3 — mock HTTP |
| Flujo de estados de pedido | Integration | Media | Fase 2 |
| Formulario CRUD producto (validaciones) | Component | Media | Fase 2 |
| Routing guards + redirects | E2E | Baja | Fase 5 |

**No testear:** templates visuales, estilos, layout responsive (son verificación manual/visual).

---

## 11. Decisiones abiertas

| # | Pregunta | Opciones | Recomendación |
|---|----------|----------|---------------|
| 1 | ¿Backend propio o BaaS? | NestJS / Supabase / Firebase | NestJS si hay equipo backend. Supabase para MVP rápido |
| 2 | ¿Editor CMS? | Quill / TipTap / PrimeNG Editor | TipTap — más moderno y extensible |
| 3 | ¿Facturación electrónica? | Integración directa SII / Proveedor (Bsale, Haulmer) | Proveedor al inicio (Haulmer), directo SII después |
| 4 | ¿Email marketing propio o externo? | Brevo / Mailchimp / Resend | Resend — API simple, pricing justo para Chile |
| 5 | ¿Monorepo con storefront? | Nx monorepo (admin + storefront) vs repos separados | Repos separados al inicio, Nx cuando haya más equipo |
| 6 | ¿State management? | Signals nativos vs NgRx SignalStore | Signals nativos — ya se usan en AppConfigService, Angular 19 los soporta bien |
| 7 | ¿i18n desde el inicio? | Solo español vs multi-idioma | Solo español — implementos.cl es mercado local |
| 8 | ¿DesignerService? | Eliminar / Reproponer como ThemeService | ThemeService para branding implementos.cl |
| 9 | ¿CSS layers? | Habilitar `cssLayer` en app.config / Dejar deshabilitado | Habilitar — previene conflictos Tailwind↔PrimeNG |
| 10 | ¿SSR necesario para admin panel? | Mantener SSR / Desactivar | Desactivar — admin panel no necesita SEO ni SSR |

---

## 12. Modelo de dominio

Entidades principales y sus campos clave. Estas interfaces evolucionan de los mocks actuales.

### Tipos auxiliares compartidos
```typescript
// Resúmenes ligeros para embeber en otras entidades (evitar circular refs)
interface ProductSummary { id: number; sku: string; name: string; image?: string; price: number }
interface CustomerSummary { id: number; rut: string; name: string; email: string; type: 'B2B' | 'B2C' }
interface UserSummary { id: number; name: string; avatar?: string }

interface ProductImage {
  id: number;
  url: string;
  alt?: string;
  order: number;              // para drag-drop de reordenamiento
  primary: boolean;           // imagen principal del producto
}
```

### Product (← mock data de `cards`)
```typescript
interface Product {
  id: number;
  sku: string;
  name: string;
  slug: string;
  description: string;
  brand: Brand;
  category: Category;
  images: ProductImage[];
  price: number;              // precio venta CLP (sin decimales)
  cost: number;               // costo CLP
  compareAtPrice?: number;    // precio "antes" para ofertas
  stock: number;
  stockMin: number;           // alerta bajo stock
  status: 'active' | 'draft' | 'archived';
  tags: string[];
  variants?: ProductVariant[];
  seo: { title: string; description: string; slug: string };
  weight?: number;            // gramos — para cálculo despacho
  createdAt: Date;
  updatedAt: Date;
}

interface ProductVariant {
  id: number;
  sku: string;
  attributes: Record<string, string>;  // { talla: 'L', color: 'Rojo' }
  price: number;
  stock: number;
  active: boolean;
}

interface Category {
  id: number;
  name: string;
  slug: string;
  parentId?: number;
  children?: Category[];
  order: number;
  image?: string;
  active: boolean;
}

interface Brand {
  id: number;
  name: string;
  logo?: string;
  active: boolean;
}
```

### Order (← mock data de `inbox`)
```typescript
interface Order {
  id: number;
  orderNumber: string;        // ej: "IMP-2026-00142"
  customer: CustomerSummary;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  shippingCost: number;       // costo envío CLP
  tax: number;                // IVA 19%
  total: number;
  status: OrderStatus;
  paymentMethod: 'webpay' | 'flow' | 'transfer' | 'cash';
  paymentStatus: 'pending' | 'paid' | 'refunded' | 'partial';
  shipping: ShippingInfo;     // datos de despacho
  notes: string;
  urgent: boolean;            // ← bookmark toggle de inbox
  timeline: OrderEvent[];
  createdAt: Date;
  updatedAt: Date;
}

type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'shipped' | 'delivered' | 'cancelled' | 'returned';

interface OrderItem {
  product: ProductSummary;
  variant?: ProductVariant;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface OrderEvent {
  status: OrderStatus;
  timestamp: Date;
  user: string;
  note?: string;
}

interface ShippingInfo {
  carrier: 'chilexpress' | 'starken' | 'bluexpress' | 'correoschile' | 'pickup';
  trackingNumber?: string;
  address: Address;
  estimatedDelivery?: Date;
  cost: number;
}
```

### Customer (← mock data de `customers`)
```typescript
interface Customer {
  id: number;
  rut: string;                // 12.345.678-9
  type: 'B2B' | 'B2C';
  name: string;
  email: string;
  phone?: string;
  company?: { name: string; rut: string; giro: string };
  addresses: Address[];
  segment: 'vip' | 'regular' | 'new' | 'inactive' | 'delinquent';
  creditLimit?: number;       // solo B2B
  currentDebt?: number;       // solo B2B
  avatar?: string;
  tags: string[];
  totalOrders: number;
  totalSpent: number;
  lastOrderDate?: Date;
  createdAt: Date;
}

interface Address {
  street: string;
  number: string;
  apartment?: string;
  commune: string;            // comuna chilena
  city: string;
  region: string;             // región de Chile
  zipCode?: string;
  isDefault: boolean;
}
```

### Lead (← mock data de `chat`)
```typescript
interface Lead {
  id: number;
  company: string;
  contactName: string;
  email: string;
  phone?: string;
  source: 'web' | 'referral' | 'cold' | 'trade_show' | 'social';
  status: 'new' | 'contacted' | 'qualified' | 'proposal' | 'won' | 'lost';
  temperature: 'hot' | 'warm' | 'cold';
  assignedTo: UserSummary;
  estimatedValue?: number;
  activities: Activity[];     // ← ChatMessage adaptado
  documents: LeadDocument[];   // ← chat media adaptado
  priority: boolean;
  requiresFollowUp: boolean;
  nextFollowUpDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface Activity {
  id: number;
  type: 'note' | 'email' | 'call' | 'visit' | 'quote';
  direction: 'inbound' | 'outbound';  // ← sent/received de chat
  content: string;
  attachments?: string[];
  user: UserSummary;
  createdAt: Date;
}

interface LeadDocument {
  id: number;
  name: string;
  url: string;
  type: 'quote' | 'contract' | 'invoice' | 'other';
  createdAt: Date;
}
```

### User & Permissions
```typescript
interface User {
  id: number;
  email: string;
  name: string;
  avatar?: string;
  role: Role;
  active: boolean;
  lastLogin?: Date;
}

interface Role {
  id: number;
  name: string;               // 'super_admin' | 'admin' | 'seller' | 'warehouse' | 'marketing' | 'support'
  permissions: Permission[];
}

interface Permission {
  module: string;             // 'catalog' | 'orders' | 'customers' | 'crm' | 'cms' | 'marketing' | 'reports' | 'settings'
  actions: ('read' | 'create' | 'update' | 'delete')[];
}
```

---

## 13. Matriz de permisos por rol

| Módulo | Super Admin | Admin | Vendedor | Bodeguero | Marketing | Soporte |
|--------|:-----------:|:-----:|:--------:|:---------:|:---------:|:-------:|
| Dashboard | CRUD | CRUD | R | R | R | R |
| Catálogo > Productos | CRUD | CRUD | R | RU | R | R |
| Catálogo > Inventario | CRUD | CRUD | R | CRUD | — | R |
| Catálogo > Categorías/Marcas | CRUD | CRUD | R | — | R | — |
| Pedidos | CRUD | CRUD | CRUD | RU | — | RU |
| Despachos | CRUD | CRUD | R | CRUD | — | R |
| Clientes | CRUD | CRUD | CRUD | — | R | CRUD |
| CRM | CRUD | CRUD | CRUD | — | R | RU |
| CMS | CRUD | CRUD | — | — | CRUD | — |
| Marketing | CRUD | CRUD | R | — | CRUD | — |
| Reportes | CRUD | CRUD | R (ventas propias) | R (inventario) | R (marketing) | — |
| Configuración | CRUD | RU | — | — | — | — |
| Usuarios/Roles | CRUD | R | — | — | — | — |

`R` = Read, `C` = Create, `U` = Update, `D` = Delete, `—` = Sin acceso

---

## 14. Búsqueda global, notificaciones y audit trail

### Búsqueda global (topbar)

**Componente:** `AutoComplete` de PrimeNG (ya usado en cards) con resultados agrupados.

| Buscar en | Campos | Ejemplo |
|-----------|--------|---------|
| Productos | nombre, SKU, marca | "casco 3m" → Casco Seguridad 3M |
| Pedidos | #orden, nombre cliente, RUT | "IMP-2026" → Pedido #IMP-2026-00142 |
| Clientes | nombre, RUT, email, empresa | "76.543" → Constructora XYZ Ltda. |
| CRM Leads | empresa, contacto | "acme" → Lead Acme Corp |

**Implementación:** Endpoint `/api/search?q=term` que busca en paralelo y agrupa resultados. Debounce 300ms en el frontend.

### Sistema de notificaciones

**Problema:** Overview tiene bell + badge pero es solo visual. No hay sistema real.

| Evento | Notificación | Destinatario |
|--------|-------------|-------------|
| Nuevo pedido | "Pedido #IMP-2026-00143 recibido — $45.990" | Admin, Vendedor |
| Pago confirmado | "Pago confirmado para pedido #143" | Bodeguero (para preparar) |
| Stock bajo mínimo | "Casco 3M: 3 unidades (mínimo: 10)" | Admin, Bodeguero |
| Lead nuevo | "Nuevo lead desde formulario web: Acme Corp" | Vendedor asignado |
| Devolución solicitada | "Devolución solicitada para pedido #138" | Admin, Soporte |
| Pedido sin despachar >24h | "Pedido #140 lleva 26h sin despachar" | Bodeguero, Admin |

**Implementación:**
- Fase 1: Polling cada 30s (simple, sin WebSocket)
- Futuro: WebSocket con Server-Sent Events para real-time
- Persistencia: tabla `notifications` con `read: boolean` y `userId`
- UI: dropdown en topbar con lista, badge con count de no leídas

### Audit trail

**Obligatorio para e-commerce:** saber quién hizo qué y cuándo.

```typescript
interface AuditLog {
  id: number;
  userId: number;
  userName: string;
  action: 'create' | 'update' | 'delete' | 'status_change' | 'login' | 'export';
  entity: string;            // 'product' | 'order' | 'customer' | etc.
  entityId: number;
  changes?: Record<string, { from: any; to: any }>;  // diff de campos
  ip?: string;
  timestamp: Date;
}
```

**Qué registrar:**
- Cambios de estado de pedido (quién confirmó, quién despachó)
- Modificaciones de precio (quién cambió, precio anterior vs nuevo)
- Cambios en stock (entradas/salidas con motivo y responsable)
- Login/logout de usuarios
- Exports de datos (quién exportó qué reporte)
- Eliminaciones (soft delete, registrar quién y por qué)

**Dónde ver:** Sección en Settings > Auditoría. Filtrable por usuario, entidad, fecha, acción.

---

## 15. Almacenamiento de archivos e imágenes

**Problema:** `FileUpload` existe en cards con drag-drop y progress, pero no hay estrategia de dónde almacenar.

| Opción | Pros | Contras | Recomendación |
|--------|------|---------|---------------|
| **Cloudinary** | CDN global, resize/crop automático, free tier generoso | Vendor lock-in | Para MVP |
| **AWS S3 + CloudFront** | Control total, pricing escalable | Más setup | Para producción |
| **Supabase Storage** | Integrado si se usa Supabase como backend | Acoplado al BaaS | Solo si backend es Supabase |
| **Local (Express static)** | Simple | No escala, no CDN | Solo desarrollo |

**Patrón de implementación:**
```typescript
// core/services/file-upload.service.ts
interface FileUploadService {
  upload(file: File, folder: string): Observable<{ url: string; key: string }>;
  delete(key: string): Observable<void>;
  getSignedUrl(key: string): Observable<string>;  // para archivos privados
}
```

**Folders:**
- `products/` — imágenes de productos (público)
- `banners/` — banners del CMS (público)
- `brands/` — logos de marcas (público)
- `documents/` — cotizaciones PDF, contratos (privado)
- `avatars/` — fotos de usuarios (público)

---

## 16. Contexto implementos.cl

> **TODO:** Definir con Cristian el dominio específico de implementos.cl.

Preguntas que afectan directamente la implementación:

| Pregunta | Impacto en el RFC |
|----------|-------------------|
| ¿Qué vende implementos.cl? (seguridad industrial, construcción, ferretería, etc.) | Define atributos de producto (certificaciones, normas, tallas, compatibilidad) |
| ¿Clientes son empresas (B2B), personas (B2C), o ambos? | Define flujo de compra, crédito, facturación, listas de precio |
| ¿Hay vendedores en terreno o solo venta online? | Define CRM: si hay vendedores, el pipeline es crítico. Si es solo online, CRM puede esperar |
| ¿Hay tienda física + online o solo e-commerce? | Define: retiro en tienda, POS, sync inventario |
| ¿Volumen de productos? (100, 1000, 10000+) | Define: virtual scroll, paginación server-side, bulk imports |
| ¿Volumen de pedidos diarios? | Define: notificaciones real-time, capacidad de procesamiento |
| ¿Ya tienen ERP, contabilidad, o sistema legacy? | Define: integraciones extra, migración de datos |
| ¿Necesitan cotizaciones formales antes de la venta? | Define prioridad del módulo CRM y cotizaciones PDF |
| ¿Manejan garantías o servicio post-venta? | Define: submódulo de garantías en devoluciones |
| ¿Despacho propio o solo courier externo? | Define: integración flota propia vs solo APIs courier |

---

## 17. Ambientes y CI/CD

### Ambientes
| Ambiente | URL | Base de datos | Uso |
|----------|-----|--------------|-----|
| **Local** | localhost:4200 | Mock data (servicios) | Desarrollo |
| **Dev** | dev.admin.implementos.cl | DB staging | Testing interno |
| **Staging** | staging.admin.implementos.cl | Copia de producción | QA pre-release |
| **Production** | admin.implementos.cl | DB producción | Usuarios finales |

### Environment files
```
src/environments/
├── environment.ts              # local (default)
├── environment.development.ts  # dev server
├── environment.staging.ts      # staging
└── environment.production.ts   # production
```

```typescript
// environment.ts
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api',
  fileStorageUrl: 'http://localhost:3000/uploads',
  webpayEnvironment: 'integration',  // Transbank test
};
```

### CI/CD (GitHub Actions sugerido)
```
on push to main:
  1. Lint (ESLint)
  2. Test (Karma/Jest — los unit tests del RFC sección 10)
  3. Build (ng build --configuration=production)
  4. Deploy to staging

on manual trigger or tag:
  5. Deploy to production
```

---

## 18. Impresión y emails transaccionales

### Documentos imprimibles (PDF)

El e-commerce necesita generar documentos PDF desde el admin. Todos usan **jsPDF + autoTable** (ya incluido para reportes).

| Documento | Módulo | Contenido | Cuándo se genera |
|-----------|--------|-----------|------------------|
| **Orden de pedido** | Orders | #orden, fecha, cliente, items, subtotal/IVA/total, dirección envío | Al confirmar pedido |
| **Boleta/Factura** | Orders | Datos SII, RUT emisor/receptor, detalle items, IVA desglosado | Al confirmar pago (integración SII) |
| **Etiqueta despacho** | Orders > Despachos | Dirección destino, remitente, #orden, peso, carrier, código barras | Al marcar "en preparación" |
| **Cotización** | CRM | Logo, datos empresa, cliente, items cotizados, condiciones, vigencia | Desde ficha lead |
| **Reporte** | Reports | Logo, filtros aplicados, chart como imagen, tabla datos | Botón export en cada reporte |

**Patrón de implementación:**
```typescript
// shared/services/pdf.service.ts
@Injectable({ providedIn: 'root' })
export class PdfService {
  generateOrder(order: Order): void { ... }
  generateShippingLabel(order: Order): void { ... }
  generateQuote(lead: Lead, items: QuoteItem[]): void { ... }
  generateReport(title: string, chartImage: string, data: any[]): void { ... }
}
```

**Bulk print:** En orders, seleccionar múltiples pedidos (checkbox ya existe en tabla) → "Imprimir etiquetas" genera PDF con varias etiquetas por página.

### Emails transaccionales

Emails automáticos que envía el sistema. Requieren servicio de email (Resend/Brevo).

| Email | Trigger | Destinatario | Contenido |
|-------|---------|-------------|-----------|
| **Confirmación pedido** | Status → `confirmed` | Cliente | #orden, resumen items, total, dirección, fecha estimada |
| **Pedido despachado** | Status → `shipped` | Cliente | #tracking, carrier, link seguimiento, fecha estimada |
| **Pedido entregado** | Status → `delivered` | Cliente | Confirmación + invitación a evaluar |
| **Devolución aprobada** | Return → `approved` | Cliente | Instrucciones de envío, plazo reembolso |
| **Cotización enviada** | Acción manual en CRM | Lead | PDF adjunto, link a cotización web, datos contacto vendedor |
| **Reset password** | Desde login | Usuario admin | Link con token temporal (1h expiración) |
| **Nuevo usuario** | Creado en settings | Usuario admin | Bienvenida + link para crear contraseña |
| **Stock bajo** | Cron check diario | Admin, Bodeguero | Lista de productos bajo mínimo |

**Implementación:**
- Templates HTML responsivos (compatible con clientes email)
- Variables dinámicas: `{{orderNumber}}`, `{{customerName}}`, etc.
- Servicio backend — el frontend solo dispara la acción (cambio de estado), el backend envía el email
- Preview en admin: botón "Previsualizar email" antes de enviar cotización

---

## 19. Evolución de AppConfigService

### Estado actual (legacy showcase)
```typescript
interface AppState {
  preset?: string;       // 'Aura' — único tema, no necesita ser configurable
  primary?: string;      // 'noir' — será reemplazado por branding implementos.cl
  surface?: string;      // null — no usado
  darkTheme?: boolean;   // funcional — mantener
  menuActive?: boolean;  // funcional — mantener
  designerKey?: string;  // 'primeng-designer-theme' — no aplica, eliminar
  RTL?: boolean;         // false — Chile es LTR, eliminar
}
```

### Estado propuesto (e-commerce)
```typescript
interface AppState {
  darkTheme: boolean;       // mantener — dark mode funcional
  menuActive: boolean;      // mantener — toggle sidebar
  sidebarSlim: boolean;     // ← isSlimMenu actual (mover aquí, centralizar)
  mobileMenuOpen: boolean;  // NUEVO — drawer mobile
}
```

**Cambios:**
- **Eliminar:** `preset`, `primary`, `surface`, `designerKey`, `RTL` — eran para el designer showcase
- **Mantener:** `darkTheme`, `menuActive` — funcionan bien
- **Mover:** `isSlimMenu` del side-menu component → `sidebarSlim` en AppState (centralizar)
- **Agregar:** `mobileMenuOpen` para el drawer mobile
- **Branding:** Si se crea ThemeService (ex-DesignerService), los colores corporativos se aplican via CSS variables/Aura preset overrides, no como estado dinámico

### Sidebar slim mode: decisión

El side-menu actual tiene toggle slim/expanded (`isSlimMenu`). Para el admin e-commerce con submenús:

- **Mantener slim mode:** Útil para pantallas medianas (laptop). En slim solo se ven iconos del primer nivel, hover muestra tooltip con nombre.
- **Submenús en slim:** Al hacer hover sobre un item con `children`, mostrar un flyout (mini popover) con los hijos.
- **Submenús en expanded:** Click para expandir/colapsar hijos (accordion).

---

## 20. Fuera de alcance (por ahora)

- Storefront público (sitio que ve el cliente final)
- App móvil
- Multi-tienda / multi-tenant
- Marketplace (múltiples vendedores)
- BI avanzado / data warehouse
- WebSocket / real-time (usar polling inicialmente)
- PWA / offline support
- Importación masiva de productos desde Excel/CSV (futuro, post-MVP)
- POS (punto de venta en tienda física)
- App vendedores en terreno
