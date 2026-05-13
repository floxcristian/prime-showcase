/**
 * Helper de traducción para contenido **interactivo** de las stories
 * de Storybook (labels de botón, captions de demo, contenido de
 * tabla simulada). NO se usa en `parameters.docs.description.*` —
 * esos strings son estáticos en español (ver `.storybook/preview.ts`
 * → comentario en `globalTypes.locale`).
 *
 * **Idiomas soportados**:
 *   - `es` — Español. Default. Idioma del equipo del proyecto.
 *   - `en` — English. Solo para validar copies localizadas en demos
 *     y para revisores externos.
 *
 * **Convención**: el equipo escribe primero `es`; `en` es traducción
 * **cuando aporta valor** (ej: mostrar el botón "Save" en una story
 * de Button), nunca obligatoria. Si una story no necesita demo
 * bilingüe — la mayoría — omite `tr()` y usa el string directo en
 * español:
 *
 * ```ts
 * // Spanish-only (90 % de las stories — caso normal):
 * args: { label: 'Guardar' }
 *
 * // Bilingüe (cuando el demo sirve para validar copy localizado):
 * render: (_args, ctx) => ({
 *   props: { label: tr({ es: 'Guardar', en: 'Save' }, getLocale(ctx)) },
 *   template: `<p-button [label]="label" />`,
 * });
 * ```
 *
 * El `ctx.globals` viene del toolbar de Storybook (definido en
 * `preview.ts → globalTypes.locale`). Usar `getLocale(ctx)` para
 * narrow del tipo `unknown` al tipo `Locale` validado.
 */

export type Locale = 'es' | 'en';

/** Lista canónica de locales soportados — single source of truth. */
export const LOCALES: readonly Locale[] = ['es', 'en'];

/** Locale default (idioma del equipo). Usado por `getLocale()`
 * cuando el toolbar value es `undefined` o inválido. */
export const DEFAULT_LOCALE: Locale = 'es';

export interface I18nString {
  /** Español (default — idioma del equipo). */
  es: string;
  /** English (opcional). Si no se provee, cae a `es`. */
  en?: string;
}

/**
 * Type guard que valida un valor `unknown` (típicamente `ctx.globals.
 * locale`) contra el set canónico de locales soportados. Sin esto,
 * un typo en el render (`ctx.globals?.['locael']`) silenciosamente
 * volvería al fallback `es` sin warning — bug invisible para
 * siempre.
 */
export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/**
 * Narrow seguro del locale desde el contexto de Storybook. Acepta:
 *   - `ctx.globals?.['locale']` con el shape correcto (string `'es'`/
 *     `'en'`) → devuelve ese valor tipado como `Locale`.
 *   - `ctx.globals` undefined (story corriendo fuera del shell,
 *     ej. baselines visuales headless) → devuelve `DEFAULT_LOCALE`.
 *   - Cualquier otro valor inesperado → devuelve `DEFAULT_LOCALE`
 *     (graceful degrade — preferimos que el catálogo siga
 *     funcionando que crashear por mismatch del toolbar).
 *
 * **Patrón canónico de uso en stories**:
 *
 * ```ts
 * import { getLocale, tr } from '../i18n';
 *
 * render: (_args, ctx) => ({
 *   props: { label: tr({ es: 'Guardar', en: 'Save' }, getLocale(ctx)) },
 *   template: `<p-button [label]="label" />`,
 * });
 * ```
 *
 * Acoplamiento al shape de Storybook `StoryContext` evitado con un
 * tipo estructural mínimo — el caller pasa `ctx` directo sin import
 * de tipo extra.
 */
export function getLocale(ctx: { globals?: Record<string, unknown> | undefined }): Locale {
  const raw = ctx.globals?.['locale'];
  return isLocale(raw) ? raw : DEFAULT_LOCALE;
}

/**
 * Traduce un par i18n al locale activo. Signature estricta: `locale`
 * debe ser `Locale` validado (usar `getLocale(ctx)` para obtenerlo
 * desde el contexto de Storybook). Si `en` falta, cae a `es`.
 *
 * Type-safe por construcción — un typo en el locale es imposible
 * porque sólo `'es' | 'en'` compilan.
 */
export function tr(str: I18nString, locale: Locale): string {
  if (locale === 'en' && str.en !== undefined) return str.en;
  return str.es;
}

/**
 * Helper opcional para reducir boilerplate cuando todos los strings
 * de una story son bilingües. Toma el dict de props bilingües + el
 * template + extra props no-traducidos, y retorna la render function
 * compatible con `StoryObj.render`.
 *
 * **Antes** (Button.stories.ts):
 *
 * ```ts
 * export const Primary: Story = {
 *   render: (_args, ctx) => ({
 *     props: {
 *       label: tr({ es: 'Guardar', en: 'Save' }, getLocale(ctx)),
 *     },
 *     template: `<p-button [label]="label" />`,
 *   }),
 * };
 * ```
 *
 * **Después** con helper:
 *
 * ```ts
 * export const Primary: Story = {
 *   render: bilingualRender(
 *     { label: { es: 'Guardar', en: 'Save' } },
 *     `<p-button [label]="label" />`,
 *   ),
 * };
 * ```
 *
 * Cuando la story necesita props NO traducidos (booleans, objects,
 * functions), pasarlos en el 3er argumento — se mergean tal cual:
 *
 * ```ts
 * bilingualRender(
 *   { label: { es: 'Descargar', en: 'Download' } },
 *   `<p-button [label]="label" icon="fa-sharp fa-regular fa-download" />`,
 *   { iconPos: 'left' },
 * );
 * ```
 */
export function bilingualRender(
  bilingualProps: Record<string, I18nString>,
  template: string,
  extraProps: Record<string, unknown> = {},
): (
  args: unknown,
  ctx: { globals?: Record<string, unknown> | undefined },
) => { props: Record<string, unknown>; template: string } {
  return (_args, ctx) => {
    const locale = getLocale(ctx);
    const props: Record<string, unknown> = { ...extraProps };
    for (const [key, dict] of Object.entries(bilingualProps)) {
      props[key] = tr(dict, locale);
    }
    return { props, template };
  };
}
