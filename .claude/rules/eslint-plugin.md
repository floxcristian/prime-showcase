---
paths:
  - "tools/eslint/**/*"
  - "eslint.config.js"
---

# ESLint plugin — design system enforcement

Reglas custom que **bloquean** violaciones del design system en CI. Esta es la capa de enforcement más fuerte — los .md son guidance, esto es enforcement real.

## Estructura

```text
tools/eslint/
  plugin.js                           ← Entry point del plugin local
  utils.js                            ← Visitor helper (escanea class + styleClass + *StyleClass + routerLinkActive)
  rules/
    no-hardcoded-colors.js            ← Bloquea text-gray-*, bg-blue-*, text-white, bg-[#hex], etc.
    no-shadow-classes.js              ← Bloquea shadow-* y drop-shadow-* (permite !shadow-none para resets)
    no-forbidden-rounded.js           ← Solo rounded-lg a rounded-3xl + rounded-full + rounded-border
    no-inline-styles.js               ← Bloquea style="" estático
    no-forbidden-spacing.js           ← Enforces spacing scale (gap, padding, margin)
    no-missing-dark-pair.js           ← Requiere dark: counterpart para bg-surface-*
    no-forbidden-typography.js        ← Enforces text size, leading, font-weight scale
    no-forbidden-transitions.js       ← Bloquea transition-all / bare transition (política big-tech)
    hover-requires-cursor-pointer.js  ← hover:* ↔ cursor-pointer deben ir en pareja
    no-icon-button-without-tooltip.js ← Icon-only <p-button> requiere pTooltip
    no-deprecated-styleclass.js       ← `styleClass` deprecated en PrimeNG v20 — usar `class`
    text-3xl-requires-bold.js         ← text-3xl debe ir con font-bold en el mismo elemento
    label-requires-semibold.js        ← <label> de input → font-semibold; <label> de checkbox/radio → font-normal
    anchor-link-classes.js            ← <a> de texto debe llevar el set canónico
  rules/__tests__/                    ← node:test suites por regla (RuleTester + invariantes)
```

## Reglas custom (severity: error)

| Regla | Qué bloquea | Qué permite |
|---|---|---|
| `showcase/no-hardcoded-colors` | `text-gray-*`, `bg-blue-*`, `text-white`, `bg-black`, `bg-[#hex]`, `bg-[rgb(...)]` | Design tokens (`text-color`, `bg-surface-*`, `bg-primary`), excepciones semánticas (`bg-violet-100`, `border-black/10`) |
| `showcase/no-shadow-classes` | `shadow-*`, `drop-shadow-*` | `shadow-none`, `!shadow-none` (resets de PrimeNG) |
| `showcase/no-forbidden-rounded` | `rounded`, `rounded-sm`, `rounded-md`, `rounded-none`, `rounded-[*]` | `rounded-lg`, `rounded-xl`, `rounded-2xl`, `rounded-3xl`, `rounded-full`, `rounded-border`, directional variants (`rounded-t-lg`) |
| `showcase/no-inline-styles` | `style="..."` estático | `[style.*]="expr"` y `[ngStyle]` para valores dinámicos |
| `showcase/no-forbidden-spacing` | `gap-9`, `p-8`, `m-3`, `m-5`, `gap-[13px]`, etc. | Escala aprobada (gap 1-6,8 / p 1-4,6 / m 0,1,2,4,6) + excepciones documentadas |
| `showcase/no-missing-dark-pair` | `bg-surface-100` sin `dark:bg-surface-800` | Pares completos, shades oscuros sin par (900, 950) |
| `showcase/no-forbidden-typography` | `text-4xl+`, `leading-snug`, `leading-relaxed`, `font-black`, `font-extrabold`, `text-[18px]` | Escala aprobada (text-xs a text-3xl, leading-4 a leading-8, font-normal/medium/semibold/bold) + `text-4xl` para iconos/stats |
| `showcase/text-3xl-requires-bold` | `text-3xl` sin `font-bold` en el mismo elemento | `text-3xl font-bold` (en cualquier combinación de class/ngClass/[class]) |
| `showcase/label-requires-semibold` | (1) Label de input sin `font-semibold`. (2) Label de checkbox/radio sin `font-normal`, o con `font-semibold` presente | Input label con `font-semibold` (Stripe/Linear/Polaris); checkbox/radio label con `font-normal` (GitHub/Stripe/Google pattern) |
| `showcase/anchor-link-classes` | `<a>` de texto sin el set canónico (falta `font-medium`, `cursor-pointer`, `transition-colors`, `duration-150`, `underline`, `text-primary`, o `hover:text-primary-emphasis`). Detecta también `text-blue-500 hover:text-blue-700` | `<a>` con los 7 tokens. Exenciones: `[routerLink]`, `href="#..."`, `<a>` que contiene `<p-button>` |
| `showcase/no-forbidden-transitions` | `transition-all`, bare `transition`, `transition-[all]` | `transition-colors`, `transition-opacity`, `transition-transform`, `transition-none`, `transition-shadow`, `transition-[transform]` |
| `showcase/hover-requires-cursor-pointer` | Elementos con `hover:*` sin `cursor-pointer`, o viceversa (plain HTML) | Mismo elemento con el par; `group-hover:*` y `peer-hover:*` no se flaggean; `<p-*>` y `[pButton]` están exentos |
| `showcase/no-icon-button-without-tooltip` | `<p-button [icon]="..." aria-label="..."/>` sin `pTooltip` | Botones con `label` visible, o con `pTooltip` |
| `showcase/no-deprecated-styleclass` | `styleClass` / `[styleClass]` en componentes PrimeNG v20 que deprecaron el atributo (53 selectores: p-tag, p-avatar, p-table, p-skeleton, etc.) | `class=`, `[class]=`, `[ngClass]=`. Sub-element variants (`paginatorStyleClass`, `valueStyleClass`) y overlays (`p-drawer`, `p-dialog`, `p-popover`, `p-tooltip`, `p-menu`, `p-button`) no se flaggean. Set sincronizado vía drift-test contra PrimeNG type defs. |

## Reglas built-in habilitadas

| Regla | Severity | Qué previene |
|---|---|---|
| `@angular-eslint/prefer-on-push-component-change-detection` | error | Componentes sin OnPush |
| `@angular-eslint/template/prefer-control-flow` | error | `*ngIf`, `*ngFor` legacy |
| `@angular-eslint/component-selector` | error | Selectores sin prefijo `app-` |

## Scope de las reglas

Las reglas escanean atributos estáticos y dinámicos:

**Estáticos** (string plano):
- `class="..."` — HTML estándar
- `styleClass="..."` — Componentes PrimeNG
- `paginatorStyleClass`, `valueStyleClass`, `panelStyleClass`, `contentStyleClass`, `headerStyleClass`, `footerStyleClass`, `inputStyleClass`, `labelStyleClass` — Variantes de PrimeNG
- `routerLinkActive="..."` — Clases en estado activo (escaneadas con la misma política que `class`)

**Dinámicos** (expresiones Angular — AST walk para extraer string literals):
- `[ngClass]="{ 'class': cond }"` — Object literal keys
- `[ngClass]="cond ? 'class-a' : 'class-b'"` — Ternary branches
- `[class]="'class-a'"` — String literals
- `[styleClass]="expr"`, `[*StyleClass]="expr"` — Mismas reglas

**No escanean:** expresiones que construyen clases via variables o funciones (`[ngClass]="myVar"`, `[class]="getClass()"`). Imposibles de resolver en lint estático — se validan por code review.

## Agregar nuevas reglas

1. Crear archivo en `tools/eslint/rules/nombre-regla.js`
2. Usar `createClassAttrVisitor` de `tools/eslint/utils.js` para escanear clases
3. Registrar en `tools/eslint/plugin.js`
4. Habilitar en `eslint.config.js` bajo el bloque `**/*.html`
5. Crear test suite en `tools/eslint/rules/__tests__/nombre-regla.test.js` con `node:test` + RuleTester

## Excepciones documentadas al design system

(Agregar una nueva requiere justificación en code review.)

1. **`shadow-[...]` sobre tooltip custom de Chart.js** (`src/app/modules/overview/overview.component.ts:191`, aplicado en runtime via `classList.add()`). Chart.js dibuja el tooltip fuera del árbol Angular, no hereda design tokens y elevation no se puede expresar con `border border-surface` (rompería el layout). ESLint no la detecta porque vive en string concatenada en TS, fuera del scope del visitor HTML.

2. **`!absolute` sobre `<i class="fa-sharp-duotone ...">`** (corner stat icons del login marketing panel). Font Awesome declara `position: relative` en `.fa-sharp-duotone` para anclar pseudo-elementos. El `!` de Tailwind v4 emite `!important` y restaura el posicionamiento. Solo cuando se combina `fa-sharp-duotone` con `absolute` en el mismo elemento.
