# RFC-003: Cliente registrado — signup, onboarding y configuración por cuenta

- **Estado:** Propuesto
- **Fecha:** 2026-08-14
- **Autores:** equipo
- **Relacionados:** RFC-001 (arquitectura y navegación — reserva la ruta `signup` y las páginas `social-connections`/`social-providers`), RFC-002 (modelo de dominio: recibe cerrados `ProviderDescriptor`, `PROVIDER_CATALOG`, `ApiKeyEntry`, `ApiKeyStatus`, `ConnectorConfig`, `TenantProviderState`, `SocialAccount`, `ConnectionStatus`, `ProviderConfigPort`), RFC-004/005/006 (UX de páginas de analítica/planner/studio — consumen el gating de onboarding definido acá)

## Resumen

Diseña el pitch SaaS multi-tenant de la suite social: (a) flujo de registro mock en `/signup` con `guestGuard`, replicando los patrones del login existente, donde el usuario autenticado ES el cliente y todo dato social se scope-a a él (cero cuentas hardcodeadas); (b) onboarding dirigido registro → configurar conector → conectar cuentas → módulos funcionando, materializado como empty states con CTA en cada página y un checklist de primeros pasos en `social-overview`; (c) la página `social-connections` (grid de conectores IG/FB/TikTok con máquina de estados `disconnected/connecting/connected/expired/error` y OAuth simulado); (d) la página `social-providers` (catálogo `PROVIDER_CATALOG` agrupado por categoría, alta de key con plaintext mostrado UNA vez, verificación simulada determinista, toggle enabled y provider activo por categoría); y (e) `SocialSettingsService` como único dueño de la persistencia localStorage SSR-safe con keys versionadas y scoped por cliente. NO define los tipos de dominio (RFC-002), ni el selector de provider dentro del studio (RFC-006), ni ninguna vista de analítica.

## Contexto y problema

La corrección de alcance v2 del cliente es explícita: la suite es una plataforma SaaS global donde cada cliente se registra, conecta SUS cuentas sociales y configura SUS API keys desde módulos de configuración de primera clase. El repo hoy tiene login mock (`modules/login/`, `AuthService` cookie-based, `authGuard`/`guestGuard`) pero no registro; y ningún módulo existente persiste configuración scoped al usuario autenticado. Sin este RFC, tres riesgos: (1) las páginas de Waves B/C nacerían con cuentas mock hardcodeadas — exactamente lo que el pedido prohíbe; (2) cada página inventaría su propio criterio de "qué mostrar cuando falta configuración"; (3) la persistencia de keys terminaría dispersa o, peor, en cookie.

Restricciones que mandan: showcase sin backend (todo simulado detrás de puertos), SSR + zoneless + OnPush, localStorage solo tras guard `isBrowser` (patrón `CustomersPreferencesService`), plaintext de keys mostrado una única vez (patrón `ApiKeysMockService`), y los gates de RFC-001 D7 (fixtures capturan connections/providers en su estado vacío de onboarding con localStorage limpio).

## Decisión

### D1. El cliente autenticado es el tenant — scoping por `AuthService.email`

No se introduce entidad `Tenant` ni switcher de workspaces (fuera de alcance v2). El identificador de cliente es el email de la sesión activa:

```typescript
// social/services/social-settings.service.ts (fragmento)
/** Id de cliente = email de la sesión, normalizado. El usuario mock logueado
 * representa a un cliente registrado del SaaS; TODO dato social (cuentas
 * conectadas, keys, config) se persiste y se lee bajo este scope. Dos
 * sesiones distintas en el mismo browser NO comparten configuración. */
private readonly clientId = computed(() =>
  this.auth.email()?.trim().toLowerCase() ?? null,
);
```

Consecuencias operativas:

- **Cero cuentas hardcodeadas.** Ninguna factory de RFC-002 pre-puebla `SocialAccount[]`: el estado inicial de todo cliente es vacío. Las cuentas nacen exclusivamente del flujo connect de D4, derivadas determinísticamente del `clientId` (ver D4.3), y se persisten scoped a él.
- **Login existente = cliente existente.** Registrarse por `/signup` o loguearse por `/login` son dos puertas a la misma sesión mock; ambas producen un cliente válido con su propio scope. El signup es aditivo, no reemplaza nada.
- **Logout → login con otro email** cambia el scope: `SocialSettingsService` re-lee storage para el nuevo `clientId` (D6.4). Es la demo más barata posible de aislamiento multi-tenant: dos emails, dos configuraciones.

### D2. Signup — `modules/login/signup/`, réplica del patrón login

Ruta ya reservada por RFC-001 D2 (fuera del layout autenticado, `canActivate: [guestGuard]`, `loadComponent` lazy). Estructura:

```
src/app/modules/login/signup/
  signup.component.ts
  signup.component.html
  signup.component.scss          ← vacío, por convención
  constants/signup-content.ts    ← SIGNUP_BENEFITS (bullets del aside), tipado
```

El componente replica **exactamente** los patrones de `login.component.ts`: signals para cada campo, validación perezosa on-blur destapada al submit, `AUTH_SUBMIT_DELAY_MS` como única latencia, timer cancelado en `DestroyRef.onDestroy`, host class idéntica al login (`flex w-full min-h-screen lg:h-screen bg-surface-0 dark:bg-surface-950 overflow-hidden`), split form + aside de marketing.

```typescript
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // mismo pattern que login
const MIN_PASSWORD_LENGTH = 8;

export class SignupComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private submitTimer: ReturnType<typeof setTimeout> | undefined;

  readonly brandName = signal('');   // nombre de la marca/empresa del cliente
  readonly email = signal('');
  readonly password = signal('');
  readonly acceptTerms = signal(false);
  readonly submitting = signal(false);
  // *Touched por campo + computeds emailInvalid / passwordInvalid /
  // brandInvalid, calcados de login.component.ts:105-119.

  onSubmit(): void {
    if (this.submitting()) return;
    this.markAllTouched();
    if (this.anyInvalid()) return;      // p-message inline ya renderizan
    this.submitting.set(true);
    this.submitTimer = setTimeout(() => {
      // El registro mock ES un login: cualquier email crea sesión (cookie
      // de AuthService). El brandName se entrega a SocialSettingsService,
      // que lo persiste scoped al cliente (D6) para saludos/branding.
      this.auth.login(this.email().trim());
      this.settings.setBrandName(this.brandName().trim());
      this.router.navigateByUrl('/social/overview');   // aterriza en el checklist (D3)
    }, AUTH_SUBMIT_DELAY_MS);
  }
}
```

Decisiones de detalle:

- **Campos: marca, email, contraseña, aceptación de términos.** Sin confirmación de contraseña (fricción sin valor en mock; patrón Vercel/Linear). Contraseña con `<p-password [feedback]="true">` (indicador de fuerza — acá sí aporta, a diferencia del login) y regla mínima de 8 caracteres validada on-blur con mensaje específico ("Mínimo 8 caracteres."). Checkbox de términos con label `font-normal` (regla `label-requires-semibold` solo exige semibold en labels de input).
- **Sin verificación de unicidad de email**: no hay backend ni registro de usuarios; `AuthService` acepta todo. Documentado en JSDoc del componente ("en producción: POST /signup + verificación de email").
- **Cross-links:** el login agrega bajo el botón `¿No tenés cuenta? <a routerLink="/signup">Creá tu cuenta</a>`; el signup el inverso hacia `/login`. Ambos `<a>` con la receta de link de DESIGN.md. Es el único cambio a `login.component.html`.
- **Post-registro navega a `/social/overview`**, no a `/`: el cliente cae directo en el checklist de primeros pasos (D3) — la historia "registro → conectar → funcionando" empieza sin clicks intermedios. `returnUrl` no aplica al signup (nadie deep-linkea a rutas protegidas para terminar registrándose; quien lo haga pasa por login).
- **Aside de marketing** con `SIGNUP_BENEFITS` propios (4 bullets del pitch social: analítica IG/FB/TikTok, IA de contenido, calendario, tus propias API keys) reusando la receta visual del aside de login (iconos `fa-sharp-duotone` permitidos porque llevan `text-2xl`+ en el mismo elemento — el criterio de `showcase/no-duotone-inline-icon` es el TAMAÑO, no el path; así pasa el login hoy).

### D3. Onboarding dirigido — gating uniforme + checklist en overview

**Fuente única del estado de onboarding: `SocialSettingsService`** (mandato de RFC-001 D5). Expone computeds sincrónicos que toda página social consume:

```typescript
/** ¿Hay al menos una cuenta conectada (status connected o expired)? Gating
 * de todas las páginas de analítica/planner. `expired` cuenta como
 * conectada: hay datos históricos que mostrar + banner de reconexión. */
readonly hasConnectedAccounts: Signal<boolean>;

/** ¿Hay al menos un provider de este kind habilitado con key válida?
 * Gating del studio (image-gen/video-gen/text-gen) y del connect de
 * cuentas (analytics-connector, ver D4.2). */
hasReadyProvider(kind: ProviderKind): Signal<boolean>;

/** Pasos del checklist con su estado, derivados — nunca almacenados. */
readonly onboardingSteps: Signal<readonly OnboardingStep[]>;
```

**Gating por página (cascada canónica de RFC-001 D5):** cada página social evalúa, después del `loadError` y antes de sus datos, el requisito de configuración. Si falta, renderiza `<app-empty-state>` con CTA que navega vía `actionClick`:

```html
@else if (!settings.hasConnectedAccounts()) {
  <app-empty-state
    icon="fa-chart-mixed"
    title="Conectá tu primera cuenta"
    description="Para ver la analítica necesitás al menos una red conectada. Conectá Instagram, Facebook o TikTok y volvé acá."
    actionLabel="Conectar cuentas"
    actionIcon="fa-sharp fa-regular fa-plug"
    (actionClick)="goToConnections()"
  />
}
```

```typescript
protected goToConnections(): void {
  void this.router.navigate(['/social/connections']);
}
```

Nota de API: el input `icon` de `app-empty-state` recibe el nombre PELADO (`icon="fa-chart-mixed"`) — el componente ya antepone `fa-sharp-duotone fa-regular` y aplica `text-4xl` (`empty-state.component.ts`, JSDoc del input). `actionIcon` en cambio va a `<p-button [icon]>` y SÍ lleva las clases completas (`fa-sharp fa-regular fa-plug`).

Copy es-CL definitivo por página (responde la pregunta abierta de copy; título `text-2xl font-medium` y descripción `text-muted-color` los aplica `app-empty-state`):

| Página | Requisito faltante | Título | Descripción | CTA → ruta |
|---|---|---|---|---|
| overview, analytics, insights, competitors | sin cuentas | Conectá tu primera cuenta | Para ver la analítica necesitás al menos una red conectada. Conectá Instagram, Facebook o TikTok y volvé acá. | Conectar cuentas → `/social/connections` |
| trends | sin cuentas | — **gating PARCIAL por sección** (decisión RFC-005 D8): tendencias y recomendador viven sin cuenta (datos de mercado); solo "Menciones recientes" y "Performance de hashtags" muestran su propio `<app-empty-state size="compact" bordered>` local | (por sección) Conectá una cuenta para ver tus menciones / la performance de tus hashtags. | Conectar cuentas → `/social/connections` |
| planner | sin cuentas | Todavía no hay dónde publicar | Conectá al menos una cuenta para empezar a programar publicaciones en tu calendario. | Conectar cuentas → `/social/connections` |
| studio | sin provider de generación listo | Configurá un proveedor de IA | Para generar captions, imágenes o videos necesitás al menos un proveedor habilitado con una API key válida. | Configurar proveedores → `/social/providers` |
| connections (por card, no página) | conector sin key válida | — (hint en card, D4.2) | El conector de {red} necesita una API key válida. | Configurar conector → `/social/providers` |

**Interacción checklist ↔ empty state en overview:** mientras el checklist (abajo) esté visible y no haya cuentas, `social-overview` NO repite el empty state genérico de la tabla — el checklist ES el estado de onboarding (dos CTAs idénticas apiladas serían ruido). El empty state estándar de overview aplica solo si el usuario descartó el checklist y sigue sin cuentas. Las demás páginas no montan el checklist y usan la tabla tal cual.

`connections` y `providers` **no** tienen empty state de página: su contenido es el propio grid/catálogo, que siempre renderiza (con todos los estados en `disconnected`/`unverified` para un cliente nuevo) — es la captura correcta del pitch para las baselines de RFC-001 D7.

**Checklist de primeros pasos — `modules/social/components/onboarding-checklist/`** (componente local cross-página social, sin story por RFC-001 D8). Renderizado por `social-overview` ARRIBA de la cascada de datos, solo mientras esté incompleto y no descartado:

```typescript
export interface OnboardingStep {
  readonly id: 'account' | 'connector-key' | 'connect-network' | 'gen-provider';
  readonly title: string;          // es-CL, ver copy abajo
  readonly done: boolean;
  readonly optional: boolean;      // gen-provider es opcional para analítica
  readonly route: string;          // CTA del paso
}
```

Copy es-CL de los pasos (en orden): **1. Creá tu cuenta** — "Listo: ya sos parte de la plataforma." (siempre `done`); **2. Configurá un conector de analytics** — "Agregá la API key de Instagram, Facebook o TikTok y verificála." → `/social/providers`; **3. Conectá tu primera red** — "Vinculá la cuenta de tu marca para empezar a traer datos." → `/social/connections`; **4. (Opcional) Habilitá un proveedor de IA** — "GPT, Gemini, Veo, HeyGen o Higgsfield para generar contenido." → `/social/studio`… con CTA a `/social/providers`.

Presentación: card `border border-surface rounded-2xl p-6`, filas con icono `fa-sharp fa-regular fa-circle-check` (done, `text-green-500` — indicador semántico permitido) / `fa-circle` (pendiente, `text-muted-color`), título `font-medium leading-6`, CTA por fila como link receta DESIGN.md. Botón de descarte icon-only (`p-button text` + `ariaLabel` + `pTooltip` "Ocultar primeros pasos"). El descarte se persiste (D6.1); el checklist también desaparece solo cuando los pasos no-opcionales están `done`.

### D4. `social-connections` — grid de conectores con OAuth simulado

**D4.1 Layout.** Host class página-card (RFC-001 D5). `<app-page-header heading="Cuentas conectadas" description="Vinculá las redes de tu marca para alimentar la analítica y el calendario.">`. Sin refresh-toolbar (no hay datos remotos que refrescar: el estado es local al cliente). Grid `grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6` con una card por red del catálogo (`PROVIDER_CATALOG` filtrado a `kind === 'analytics-connector'`, iterando sus `capabilities.networks`) — el catálogo manda: agregar una red mañana es agregar una entry, no tocar la página.

**Card de conector** (`social-connections/components/connector-card/`, local):

```html
<div class="border border-surface rounded-2xl p-6 flex flex-col gap-4">
  <div class="flex items-center gap-2">
    <i [class]="brandIcon()" class="text-2xl" aria-hidden="true"></i> <!-- fa-brands fa-instagram/facebook/tiktok -->
    <div class="flex-1 text-color font-bold leading-6">{{ networkLabel() }}</div>
    <p-tag [severity]="statusSeverity()" [value]="statusLabel()" styleClass="font-medium" />
  </div>
  <!-- connected/expired: @handle + avatar iniciales (!bg-primary-100 !text-primary-950),
       followers formateados con Intl es-CL en el .ts, y
       "Última sincronización {{ account().lastSyncAt | relativeTime }}" -->
  <!-- error: mensaje accionable con failureReason -->
  <!-- disconnected sin key válida: hint + link "Configurar conector" (D3) -->
  <p-button [label]="ctaLabel()" [loading]="connecting()" [disabled]="ctaDisabled()"
    [outlined]="isConnected()" (onClick)="onCta()" styleClass="w-full" />
</div>
```

Estado de conexión: **`p-tag` + tokens locales**, NO `app-health-badge` (sus labels "Saludable/Degradado" son de otro dominio; forzarlos confundiría — cierra la decisión que RFC-001 D8 dejó abierta). Patrón `health-badge.tokens.ts`, en `social-connections/constants/connection-status.tokens.ts`:

```typescript
import type { ConnectionStatus } from '../../models/social.interface';

export const CONNECTION_STATUS_LABELS: Record<ConnectionStatus, string> = {
  connected: 'Conectada',
  expired: 'Token expirado',
  error: 'Error',
  disconnected: 'Sin conectar',
};

export type ConnectionSeverity = 'success' | 'warn' | 'danger' | 'secondary';

export const CONNECTION_STATUS_SEVERITIES: Record<ConnectionStatus, ConnectionSeverity> = {
  connected: 'success',
  expired: 'warn',
  error: 'danger',
  disconnected: 'secondary',
};
```

Sin componente shared nuevo → sin story (RFC-001 D8). Si RFC-004 lo promueve, va con `.tokens.ts` + story en ese PR.

**D4.2 Prerequisito: key del conector.** Conectar la red X exige que el provider `analytics-connector` correspondiente esté `enabled` con key `valid` (D5). Es lo que da sentido de producto al pedido "keys de conectores IG/FB/TikTok configurables por cliente": el cliente trae su propia app de Graph API. Sin key válida, la card muestra el hint de D3 con link a `/social/providers` y el botón Conectar `[disabled]` + `pTooltip="Configurá primero la API key del conector"`.

**D4.3 Connect = OAuth simulado.** Al click en Conectar:

1. `connecting` (signal local de la card) → botón `[loading]="true"`; latencia `mockLatency(1200, 800)` que emula el roundtrip de consentimiento OAuth.
2. Resolución determinista: `seededRandom(`${clientId}:${network}:attempt-${n}`)() < 0.15` → **error** ("No pudimos completar la autorización con {red}. Reintentá."). El contador de intento `n` (signal en memoria) entra en el seed: el retry puede tener resultado distinto — se demuestra el estado `error` sin dejarlo pegado para siempre.
3. Éxito → `SocialSettingsService.connectAccount(network)` fabrica la `SocialAccount` **derivada del cliente, jamás hardcodeada**: `handle = '@' + localPart(clientId)` saneado (`colegios.norte@…` → `@colegiosnorte`), `displayName = brandName` persistido en signup (fallback: localPart capitalizado), followers/following/postsCount vía `seededRandom(`${clientId}:${network}`)` en rangos realistas por red, `connectedAt = lastSyncAt = now ISO`, `connectorId` del catálogo. Se persiste (D6.1) y toast `success` ("Cuenta conectada", detail "Los datos de @handle empiezan a sincronizarse.").
4. **`expired` computado en lectura, no almacenado:** `status` efectivo = `expired` cuando `now − connectedAt > TOKEN_TTL_MS` (7 días — compresión demo de los 60 días reales de Meta, documentada en JSDoc; valor congelado también en RFC-002 D6): un cliente demo que vuelve a la semana ve el flujo real de reconexión. Además aplica la regla determinista de RFC-002 D6: `seededRandom(`${clientSeed}:sync-err:${network}`)() < 0.2` marca UNA cuenta con `status: 'error'` + `failureReason` accionable — variedad de estados que la card muestra (D4.1) y de la que dependen los flujos `failed` de RFC-006 D6.1. **Reconectar** repite el flujo connect refrescando `connectedAt`, limpiando `failureReason` y preservando la cuenta.
5. **Desconectar** (item en menú `···` de la card) con `p-confirmdialog`: header "Desconectar cuenta", message "Vas a desconectar @{handle}. La analítica y el calendario de {red} dejarán de mostrar datos hasta que vuelvas a conectarla.", acceptLabel "Desconectar", `acceptButtonStyleClass="p-button-danger"`. Elimina la cuenta persistida (los mocks de analítica de RFC-002 derivan de las cuentas conectadas: sin cuenta, sin datos — el gating de D3 reaparece solo).

### D5. `social-providers` — catálogo, keys y provider activo

**D5.1 Layout.** Host class página-card. `<app-page-header heading="Proveedores IA y conectores" description="Configurá tus propias API keys: conectores de analytics y proveedores de generación de contenido.">`. Cuatro secciones en orden fijo — Conectores de analytics, Texto, Imágenes, Video (`analytics-connector`, `text-gen`, `image-gen`, `video-gen`) — cada una con header de card (`text-color font-semibold leading-6`) y grid `md:grid-cols-2 gap-6` de cards de provider derivadas de `PROVIDER_CATALOG` filtrado por `kind`.

**Card de provider** (`social-providers/components/provider-card/`, local): icono del descriptor, `name` (`font-bold leading-6`) + `vendor` (`text-muted-color text-xs leading-4`), capabilities como `text-xs` (p. ej. "hasta 8 s · 9:16, 16:9" desde `capabilities`), `<p-toggleswitch>` enabled (deshabilitado con `pTooltip` si no hay key válida), estado de su key activa como `p-tag` (mapa local `API_KEY_STATUS_LABELS/SEVERITIES` en `social-providers/constants/api-key-status.tokens.ts`, mismo patrón que D4: `valid→success` "Válida", `invalid→danger` "Inválida", `expired→warn` "Expirada", `unverified→secondary` "Sin verificar"), `maskedKey` en fuente del sistema con `text-ellipsis whitespace-nowrap overflow-hidden`, "Verificada {{ lastVerifiedAt | relativeTime }}", y acciones: **Agregar key** / **Verificar** / **Revocar** / **Usar como activo**.

**D5.2 Alta de key — plaintext UNA vez.** Dialog local (`components/api-key-dialog/`, `p-dialog` modal) en dos pasos:

1. *Formulario:* label opcional ("Producción", "Cuenta agencia") + input de key con `placeholder` = `keyFormatHint` del descriptor. **Validación de forma** (responde la pregunta abierta): la fuente ÚNICA es el `keyPattern` del `ProviderDescriptor` (RFC-002 D3) — el dialog valida con `new RegExp(descriptor.keyPattern)`, sin archivo de regex paralelo (el mismo pattern que `verifyKey` usa en su shape-check, RFC-002 D5: un solo dato, cero drift). Los valores concretos que el catálogo congela por provider:

```typescript
/** keyPattern por provider en PROVIDER_CATALOG (prefijo + largo mínimo).
 * Nunca valida autenticidad — eso es verifyKey (simulado). On-blur, el
 * mensaje cita el keyFormatHint del catálogo: «El formato esperado es "sk-…"». */
'openai-images':   /^sk-[A-Za-z0-9_-]{20,}$/
'gemini-imagen':   /^AIza[A-Za-z0-9_-]{16,}$/
gpt:               /^sk-[A-Za-z0-9_-]{20,}$/
gemini:            /^AIza[A-Za-z0-9_-]{16,}$/
veo:               /^AIza[A-Za-z0-9_-]{16,}$/
heygen:            /^hg_[A-Za-z0-9]{24,}$/
higgsfield:        /^hf-[A-Za-z0-9]{24,}$/
'instagram-graph': /^EAA[A-Za-z0-9]{30,}$/
'facebook-graph':  /^EAA[A-Za-z0-9]{30,}$/
'tiktok-api':      /^act\.[A-Za-z0-9]{24,}$/
```

   Submit deshabilitado hasta pasar la forma. La validación es on-blur con `role="alert"` + `aria-describedby` (receta de `ux-patterns.md`).
2. *Confirmación:* `addKey` (latencia `mockLatency(200, 300)` — operación liviana, JSDoc de `mock-latency.ts` ya lo contempla) enmascara con el patrón `maskPrefix` de `ApiKeysMockService` (primeros ~14 + `…` + últimos 4) y **descarta el plaintext**; el dialog lo muestra esta única vez con copy-to-clipboard y aviso `p-message severity="warn"`: "Guardá esta key ahora: por seguridad no la vamos a volver a mostrar." Cerrar el dialog es irreversible. La key nace `unverified`.

**D5.3 Verificación simulada — determinista por key.** `verifyKey(keyId)` con `mockLatency(800, 700)` (verificar una key "sale" a la API externa — la espera vende la validación; valor congelado en RFC-002 D11) + botón `[loading]`; tras el shape-check contra `keyPattern` (D5.2), el resultado sale de `seededRandom(keyId)` con los umbrales congelados en RFC-002 D5:

```typescript
/** Resultado estable por keyId (el id incluye Date.now().toString(36):
 * reintentar con una key NUEVA re-tira el dado; re-verificar la MISMA key
 * repite el resultado — como un backend real). Umbrales de RFC-002 D5. */
const roll = seededRandom(keyId)();
const status: ApiKeyStatus = roll < 0.75 ? 'valid' : roll < 0.92 ? 'invalid' : 'expired';
```

`valid` setea `lastVerifiedAt`; `invalid`/`expired` muestran toast `error` accionable ("La key de {provider} fue rechazada. Verificá que la copiaste completa o generá una nueva."). Solo una key `valid` permite `enabled: true`.

**D5.4 Provider activo por categoría.** Dentro de cada sección de generación (`text-gen`/`image-gen`/`video-gen`) puede haber varios providers habilitados; **uno** es el activo por defecto que el studio preselecciona (RFC-006 solo lo lee). El estado `activeByKind: Partial<Record<ProviderKind, ProviderId>>` y el método de puerto `setActiveProvider(kind, providerId)` ya están DECLARADOS en el contrato congelado (RFC-002 D3 `TenantProviderState` y D4 `ProviderConfigPort`) — este RFC define solo la UX. UI: acción "Usar como activo" en la card (visible solo si enabled), con `p-tag severity="info"` "Activo" en el elegido. Al habilitar el primer provider de una categoría, se vuelve activo automáticamente. Para `analytics-connector` no aplica (no hay "activo": cada red usa su propio conector) — nunca aparece como key de `activeByKind`.

**D5.5 Revocar una key en uso** (responde la pregunta abierta). `p-confirmdialog` cuyo message enumera el impacto concreto calculado antes de abrir: "Vas a revocar la key `sk-…a4f9` de {provider}. {Provider} quedará deshabilitado{, dejará de ser el proveedor activo de {categoría}}{ y las cuentas de {red} conectadas pasarán a estado de error}." Al aceptar, en una sola transición de `SocialSettingsService`:

1. La key pasa a estado revocado y **desaparece de la card** (a diferencia del módulo users no hay tabla de auditoría acá; la key deja de listarse y el provider queda "sin key").
2. Si era `activeKeyId` del config → `enabled: false` y se limpia `activeKeyId`.
3. Si el provider era `activeByKind` de su categoría → se limpia la entry; si otro provider de la categoría sigue enabled, se promueve automáticamente (toast `info` avisando cuál).
4. Si era un `analytics-connector` con cuentas conectadas de su red → esas cuentas pasan a `status: 'error'` con `failureReason: 'La credencial del conector fue revocada.'` — la card de connections muestra el error accionable y el gating de analítica reacciona vía los computeds de D3. Nada se borra: reconfigurar la key + reconectar restaura.

### D6. Persistencia — `SocialSettingsService`, único dueño del storage

Sigue `CustomersPreferencesService` al pie de la letra: guard `isBrowser` declarado **antes** de cualquier field initializer que lo lea, `try/catch` silencioso centralizado en helpers privados `readJson<T>(key, fallback)` / `writeJson(key, value)`, signals `asReadonly()` hacia afuera. Implementa `ProviderConfigPort` (RFC-002) — el swap a backend real es implementar el mismo puerto con HTTP.

**D6.1 Keys de storage — versionadas y scoped por cliente:**

```typescript
/** Base names versionados; el scope por cliente va como sufijo:
 * `social:provider-config:v1::<clientId>`. Cambio de shape ⇒ bump de
 * versión (v2) + los datos v1 se ignoran (fallback default), sin migración
 * — criterio showcase. */
const PROVIDER_CONFIG_KEY = 'social:provider-config:v1';  // ConnectorConfig[] + activeByKind
const API_KEYS_KEY = 'social:api-keys:v1';                // ApiKeyEntry[] — SOLO maskedKey, jamás plaintext
const CONNECTIONS_KEY = 'social:connections:v1';          // SocialAccount[] conectadas por el cliente
const PROFILE_KEY = 'social:profile:v1';                  // { brandName } del signup (D2)
const ONBOARDING_KEY = 'social:onboarding:v1';            // { checklistDismissed: boolean } (D3)

private storageKey(base: string): string | null {
  const id = this.clientId();
  return id ? `${base}::${id}` : null;   // sin sesión no se lee/escribe nada
}
```

`CONNECTIONS_KEY`, `PROFILE_KEY` y `ONBOARDING_KEY` extienden las dos keys previstas originalmente: sin persistir las cuentas conectadas, un F5 desharía el onboarding (inaceptable para el pitch); brandName y dismissal son estado del cliente con el mismo dueño. **NADA en cookie**: ninguna config social participa del primer paint SSR (no hay FOUC que evitar) y acercar material sensible a un header que viaja en cada request es el anti-patrón exacto; la cookie del repo existe solo para dark-mode y auth (rationale en `app-config.service.ts` / ADR-001 §4).

**D6.2 SSR default + reconciliación al hidratar.** En server (`!isBrowser`) toda lectura devuelve el default: configs del catálogo con `enabled: false` y sin `activeKeyId`, `keys: []`, cuentas `[]`, checklist visible. Las páginas consumen el estado vía la fachada Observable del puerto (`getState()` con `mockLatency(200, 300)`) + `trackedResource`: el SSR pinta `<p-skeleton>`, el browser pinta skeleton → datos reales de storage. **No hay mismatch de hidratación** porque el HTML servido y el primer frame cliente muestran lo mismo (skeleton); los datos entran después como en cualquier página mock del repo — es la misma razón por la que RFC-001 D7 marca connections/providers con `waitForData: true`. Para el **gating** (D3), los computeds sincrónicos leen el signal en memoria ya inicializado desde storage en el field initializer (browser) — mismo timing que `readDensityFromStorage()`.

**D6.3 API del service (superset del puerto):**

```typescript
@Injectable({ providedIn: 'root' })
export class SocialSettingsService implements ProviderConfigPort {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID)); // PRIMERO
  private readonly auth = inject(AuthService);

  // ProviderConfigPort COMPLETO (RFC-002 D4, firmas idénticas — `implements`
  // compila): getState / setEnabled / setActiveKey / setActiveProvider /
  // addKey / verifyKey / revokeKey / connectAccount / reconnectAccount /
  // disconnectAccount — TODOS devuelven Observable, incluso mutaciones
  // "instantáneas" (disconnectAccount(accountId): Observable<void>): el
  // puerto es el contrato del backend futuro.
  // Extensiones de este RFC (fuera del puerto, sincrónicas):
  setBrandName(name: string): void;
  dismissChecklist(): void;
  // Gating (D3): hasConnectedAccounts, hasReadyProvider(kind), onboardingSteps
  // Lectura reactiva para otras páginas/services sociales — NOMBRES CANÓNICOS
  // (los usan RFC-002 D5 y RFC-006 D7; no hay alias):
  readonly accounts: Signal<readonly SocialAccount[]>;   // status expired computado en lectura (D4.4)
  readonly state: Signal<TenantProviderState>;           // estado persistido crudo
}
```

`state` es el snapshot crudo persistido; `accounts` es el derivado con `status` efectivo (TTL + error por seed) — los consumidores de CUENTAS (analytics de RFC-002 D5, composer de RFC-006) leen `accounts()`; los de configuración (providerOptions del studio, RFC-006 D7) leen `state()`.

Las mutaciones actualizan el signal y persisten en el mismo método (setter explícito, **no** `effect` reactivo — contrato del repo, `app-config.service.ts:25-29`). Los mocks de analítica de RFC-002 leen `accounts` para derivar TODO dato social del cliente: cuentas vacías ⇒ datasets vacíos, por construcción.

**D6.4 Cambio de cliente.** Un único `effect()` en el service observa `clientId()` y ante un cambio (login/logout/otro email) re-lee los cinco keys para el nuevo scope y resetea los signals (logout ⇒ defaults). Es el único `effect` del service y su JSDoc lo justifica: reacciona a un signal externo (`AuthService.email`), no a estado propio. El mismo patrón de reset por cliente aplica a los services mutables NO persistidos (`SocialPublishingMockService`, `SocialGenerationMockService`, `RecommendationDismissalsStore`) — decisión y mecánica en RFC-002 D6: el aislamiento cubre configuración Y contenido.

**D6.5 Zoneless guard-rail.** Todo objeto bindeado a `[(ngModel)]` en estas páginas (toggle de provider, checkbox de términos, inputs del dialog) es primitivo (boolean/string) — sin riesgo de identidad. Si RFC-004 agrega multiselects, aplica la regla de RFC-001 D5 (field `readonly`/`computed`, jamás literal inline).

## Alternativas consideradas

1. **Registro "real" con lista de usuarios en storage y unicidad de email.** NO: `AuthService` mock acepta cualquier credencial por diseño; duplicar una base de usuarios en localStorage agrega superficie sin valor demo y contradice el trade-off documentado del auth mock. El signup es la puerta narrativa, no un sistema de identidad.
2. **Entidad `Tenant` + switcher de workspaces.** NO: explícitamente fuera de alcance v2. El scoping por email demuestra el aislamiento con cero UI extra.
3. **Cookie para la configuración social.** NO: no participa del primer paint SSR (el único motivo válido para cookie en este repo), infla cada request y acerca material sensible al wire. Regla del RFC: nada social en cookie.
4. **Persistir el plaintext de las keys para re-mostrarlo.** NO: el patrón `ApiKeysMockService` (plaintext una vez, luego solo máscara) es además el mensaje correcto del showcase — un backend real hashea al recibir. `maskedKey` es lo único que existe post-alta.
5. **Reutilizar `app-health-badge` para el estado de conexión.** NO: sus labels ("Saludable", "Degradado", "Sin datos") son del dominio observability y quedarían mal en una card de red social; parametrizar labels le rompería el contrato de source-of-truth. `p-tag` + tokens locales cuesta 20 líneas y no toca shared.
6. **Conectar cuentas sin exigir key del conector** (OAuth "de la plataforma", como Metricool/Buffer). NO: el pedido pide keys de conectores de analytics configurables por cliente como feature de primera clase; hacerlas opcionales las degradaría a decoración. El costo (un paso más de onboarding) se mitiga con el checklist y los hints por card.
7. **Cuentas mock pre-conectadas para que la demo "se vea llena" al primer login.** NO: viola "CERO cuentas hardcodeadas" del pedido v2. La demo se llena en dos clicks guiados por el checklist, y ese flujo ES el pitch.
8. **Un service por página (ConnectionsService + ProvidersService).** NO: el gating de onboarding necesita una fuente única (RFC-001 D5); dividir el estado obligaría a un tercer coordinador. Un service, un puerto, un dueño del storage — patrón `CustomersPreferencesService`.
9. **Simular OAuth con ventana/popup.** NO: un popup mock que se autocierra es teatro frágil (bloqueadores, SSR, a11y); el botón `[loading]` con latencia larga + estados de resultado cuenta el mismo flujo con los patrones del repo.

## Consecuencias

**Positivas**

- La historia completa del pitch (registro → key de conector → conectar red → módulos vivos) es recorrible en <2 minutos y cada paso usa exclusivamente patrones existentes del repo (login clonado, empty-state, p-tag, confirm dialog, localStorage guard).
- Aislamiento multi-tenant demostrable en vivo: logout + login con otro email = configuración limpia, sin código extra.
- El gating centralizado en computeds de `SocialSettingsService` hace que 6 páginas de Waves B/C implementen su empty state en ~10 líneas idénticas — el review compara contra la tabla de copy de D3 (trends es la excepción deliberada: gating parcial por sección, RFC-005 D8).
- `verifyKey`/`connect` deterministas por seed ⇒ baselines visuales y demos reproducibles.
- El swap a backend real está delimitado: implementar `ProviderConfigPort` con HTTP + borrar los helpers de storage; ningún componente cambia.

**Negativas / deuda aceptada**

- `clientId` = email en claro como sufijo de key de localStorage (legible en DevTools). Aceptado: no hay secretos (solo máscaras) y es un showcase; anotado en JSDoc que producción usa un id opaco del backend.
- La configuración vive por browser: el mismo cliente en otra máquina arranca vacío. Inherente a frontend-only; es además coherente con el estado limpio que exigen los gates visuales.
- TTL de token comprimido a 7 días (vs 60 reales de Meta): un reviewer que conozca Graph API puede notarlo — está documentado como compresión demo en el JSDoc.
- El seed de fixtures (`tests/fixtures/social-seed.ts`, RFC-001 D7) importa factories de `src/` desde el harness de Playwright — acoplamiento test↔src aceptado a cambio de cero duplicación del shape persistido.
- Tres keys de storage más que las dos previstas (connections, profile, onboarding). Aceptado: mismo dueño, mismo patrón, y la alternativa (perder cuentas conectadas en F5) rompe el pitch.
- `seededRandom` sobre ids con `Date.now()` implica que la MISMA key re-verificada nunca cambia de estado: una key `invalid` queda `invalid` para siempre (hay que crear otra). Es el comportamiento de un backend real, pero puede confundir en demo — mitigado por el toast que sugiere generar una nueva.

## Plan de implementación

Todo en **Wave A** (RFC-001 D9), repartido en los dos PRs ya previstos:

**[Wave A / PR-1] — junto a la capa compartida de RFC-002:**
1. `SocialSettingsService` completo (D6) implementando `ProviderConfigPort` + extensiones (`activeByKind` y `setActiveProvider` ya declarados en RFC-002 D3/D4 — sin coordinación pendiente). Unit tests (`social-settings.service.spec.ts`): defaults SSR, scoping por cliente, revocación en cascada (D5.5), determinismo de `verifyKey`/connect.
2. Computeds de gating + `OnboardingStep` (D3). Los shells de páginas B/C de RFC-001 consumen `hasConnectedAccounts`/`hasReadyProvider` con el copy de la tabla D3.

**[Wave A / PR-2] — páginas de este RFC:**
3. `signup` (D2): componente + constants + cross-links en login. Verificar con el MCP de PrimeNG las APIs actuales de `p-password` (feedback/promptLabel) y `p-checkbox` antes de implementar.
4. `social-connections` (D4): página + `connector-card` + `connection-status.tokens.ts` + confirm de desconexión + toasts.
5. `social-providers` (D5): página + `provider-card` + `api-key-dialog` (validación de forma vía `keyPattern` del catálogo — sin archivo de regex propio) + `api-key-status.tokens.ts` + confirm de revocación con impacto calculado.
6. `onboarding-checklist` (D3) montado en el shell de `social-overview`.
7. `tests/fixtures/social-seed.ts` (entregable de este RFC según RFC-001 D7): `TenantProviderState` determinista construido con las factories puras + las keys versionadas de D6.1 scoped a `TEST_EMAIL` — lo consumen las entries `-seeded` de Waves B/C.
8. Fixtures ya declaradas en RFC-001 D7 (`/signup` `guestOnly`; connections/providers `waitForData: true`, estado default vacío) → correr workflow `Visual baselines` y commitear en el mismo PR. `npm run verify` antes de push.

## Criterios de aceptación verificables

- [ ] `npm run verify` pasa en ambos PRs (lint 19 reglas + tests + build ≤ budgets + `bundle:check` + smoke). `signup`, `social-connections` y `social-providers` entran SOLO por `loadComponent`; cero crecimiento del initial más allá de lo presupuestado en RFC-001 D6.
- [ ] Reglas de lint que este RFC ejercita sin violaciones: `label-requires-semibold` (labels de input semibold; checkbox de términos normal), `no-missing-dark-pair`, `no-icon-button-without-tooltip` (descarte del checklist, menú `···` de cards), `no-decorative-icon-without-aria-hidden` (logos `fa-brands`), `no-duotone-inline-icon` (duotone solo en empty states/aside, jamás inline), `no-forbidden-spacing`/`rounded`/`transitions`.
- [ ] **Flujo E2E manual del pitch:** con localStorage limpio, `/signup` (solo sin sesión — guestGuard) → registra → aterriza en `/social/overview` con checklist paso 1 `done` y empty state de analítica → `/social/providers`: alta de key con forma inválida bloqueada on-blur, alta válida muestra plaintext UNA vez (no recuperable tras cerrar el dialog), verificación produce estado determinista, toggle enabled solo con key `valid` → `/social/connections`: connect deshabilitado sin key del conector; con key, connect simula OAuth (loading ≥1 s) y produce cuenta derivada del email (handle ≠ ningún literal del repo) → checklist completo desaparece.
- [ ] **Aislamiento:** logout + login con otro email muestra configuración vacía Y contenido vacío (drafts/jobs/dismissals reseteados — RFC-002 D6); volver al email original restaura su configuración (dos scopes en localStorage, sufijos distintos; el contenido no persistido se descarta, límite documentado).
- [ ] **Revocación en cascada (D5.5):** revocar la key activa de un conector con cuenta conectada ⇒ provider disabled + cuenta en `error` con `failureReason` + gating de analítica reactivado — verificado en unit test del service y manualmente.
- [ ] **SSR:** `npm run test:ssr:smoke` pasa; `curl` a `/signup` sin cookie renderiza 200; las páginas de settings sirven skeleton en SSR (sin acceso a localStorage server-side — cero referencias a `localStorage` fuera de los helpers guarded del service, verificable por grep).
- [ ] Fixtures en `tests/fixtures/routes.ts` en el mismo PR; baselines vía workflow manual `Visual baselines` (nunca local); `npm run a11y` sin violaciones `serious`/`critical` en `/signup`, `/social/connections`, `/social/providers` (dialogs con focus trap de `p-dialog`, validaciones con `role="alert"` + `aria-describedby`, touch targets 44×44 en icon-only).
- [ ] Sin stories nuevas requeridas (ningún componente shared nuevo — D4/D5 usan componentes locales + tokens locales); si un review promueve algo a `shared/`, la story entra en ese mismo PR (RFC-001 D8).
- [ ] Grep de seguridad del showcase: ninguna aparición de plaintext de key persistida (`localStorage.setItem` solo dentro de `SocialSettingsService`, payloads con `maskedKey` únicamente); ningún handle/cuenta social literal en `mocks/` (las cuentas solo nacen de `connectAccount`).
