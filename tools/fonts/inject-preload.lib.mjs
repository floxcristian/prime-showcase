/**
 * Pure helpers para font preload injection.
 *
 * Sin side effects, sin I/O — todo lo que hace I/O vive en
 * `inject-preload.mjs`. Este archivo es 100% testable con fixtures string
 * (sin tocar filesystem).
 *
 * Patrón alineado con `tools/eslint/utils.js` + sus tests: separar lógica
 * pura de I/O permite que node:test corra la lógica sin mocks de fs.
 *
 * ## Regex vs AST parser (source-stability matrix) — decisión documentada
 *
 * Usamos regex (no postcss / css-tree) porque el CSS que procesamos es
 * generado por un tool controlado + version-pinned:
 *   - `@fontsource-variable/inter` pinned en package-lock.json
 *   - Formato estable desde v5.x (2023+)
 *   - Angular's CSS minifier normaliza whitespace consistentemente
 *
 * Este es el mismo pattern que usa **Next.js `next/font/google`**: regex
 * para CSS de fuente controlada (Google Fonts API, fontsource), AST parser
 * sólo para CSS user-authored arbitrario (p.ej. `next/font/local` que lee
 * archivos .css provistos por el usuario).
 *
 * **Cuándo migrar a AST (css-tree / postcss):** si empezamos a consumir
 * CSS arbitrario provisto por el usuario (no pinned, no controlado).
 * YAGNI por ahora — la app tiene una única fuente fija.
 *
 * **Safety net:** el canary test en `__tests__/inject-preload.test.mjs`
 * lee el CSS REAL instalado de fontsource en cada run de CI. Si un dep
 * bump cambia el formato, el canary falla explícito antes del build.
 * Sin este canary, los fixtures hand-written no detectarían breaking
 * changes de fontsource — ése era el gap real que mitigaba el jump a AST.
 *
 * Ver `tools/fonts/README.md` para la matriz completa.
 */

// Unicode-range stamp del latin subset según `@fontsource-variable/inter`.
// El primer range `U+0000-00FF` es el identificador estable — cubre ASCII +
// Latin-1 (incluye ñ/á/é/í/ó/ú para español), y no cambia entre versiones
// del package. Lo usamos como ancla para distinguir el archivo latin de los
// otros subsets (latin-ext, cyrillic, greek, vietnamese).
//
// Si fontsource cambia este range en una futura major, los tests rompen
// explícito con "no se encontró match" — obliga a revisar y actualizar acá,
// en vez de silenciosamente no preloadear nada.
export const LATIN_RANGE_MARKER = 'U+0000-00FF';

/**
 * Extrae la URL del `.woff2` del subset `latin` de un CSS concatenado
 * (múltiples `@font-face` rules encadenadas).
 *
 * Convention de fontsource: cada `@font-face` declara `src: url(...)` +
 * `unicode-range: ...` en la misma regla, con src antes de unicode-range.
 * Matcheamos la tupla completa con un regex en vez de parsear CSS —
 * suficiente para este formato estable, sin dependencia de CSS parser.
 *
 * El regex:
 *   - `@font-face\s*\{` — inicio de la rule
 *   - `[^}]*?` — cualquier cosa (non-greedy, no salta a otras rules porque
 *     `}` nunca aparece dentro de `@font-face` en CSS standard)
 *   - `\bsrc:\s*url\(["']?([^"')]+\.woff2)["']?\)` — captura el URL woff2
 *   - `[^}]*?\bunicode-range:\s*([^;}]+?)[;}]` — captura el unicode-range
 *     hasta el próximo `;` o `}` (terminator puede ser cualquiera de los
 *     dos — `;` si hay más declaraciones después, `}` si es la última)
 *
 * @param {string} cssSource — CSS concatenado (p.ej. contents de styles-*.css)
 * @returns {string} URL del woff2 latin (ej: "./media/inter-latin-wght-normal-XYZ.woff2")
 * @throws Error si hay 0 o >1 matches (ambos son condiciones inesperadas)
 */
export function findLatinWoff2Url(cssSource) {
  const fontFaceRe =
    /@font-face\s*\{[^}]*?\bsrc:\s*url\(["']?([^"')]+\.woff2)["']?\)[^}]*?\bunicode-range:\s*([^;}]+?)[;}]/g;
  const matches = [];
  for (const match of cssSource.matchAll(fontFaceRe)) {
    const [, url, unicodeRange] = match;
    if (unicodeRange.includes(LATIN_RANGE_MARKER)) {
      matches.push(url.trim());
    }
  }
  if (matches.length === 0) {
    throw new Error(
      `No se encontró ningún @font-face con unicode-range ${LATIN_RANGE_MARKER} (latin subset). ` +
        `¿Cambió la estructura de @fontsource-variable/inter? Revisar qué subset emiten ahora ` +
        `y actualizar LATIN_RANGE_MARKER si corresponde.`,
    );
  }
  if (matches.length > 1) {
    throw new Error(
      `Se encontraron ${matches.length} matches para el latin subset: ${matches.join(', ')}. ` +
        `Ambiguo — el script no puede elegir. Probable causa: el build emite axes múltiples ` +
        `(wght + opsz) para el mismo range. Refinar el matcher para elegir el axis correcto.`,
    );
  }
  return matches[0];
}

/**
 * Normaliza la URL del CSS a forma apta para HTML href.
 *
 * El CSS usa `./media/foo.woff2` (relative-to-css). Como el CSS se sirve
 * desde el mismo origen que el HTML y hay `<base href="/">`, ambas formas
 * resuelven al mismo URL absoluto. Usamos `media/foo.woff2` (sin `./`)
 * porque es más convencional en HTML attributes y evita el caso extraño
 * donde algún proxy/CDN trate `./` de manera no-estándar.
 */
export function normalizeUrl(url) {
  return url.replace(/^\.\//, '');
}

/**
 * Construye el tag `<link rel="preload">` para el woff2.
 *
 * **`crossorigin` es OBLIGATORIO aunque el font sea same-origin.** Sin él,
 * el browser descarta el preload al encontrar el `@font-face` (que fetcha
 * con CORS credentials mode por default) y baja el archivo DE NUEVO. El
 * resultado: download duplicado + zero beneficio del preload. Es el error
 * #1 en font preloads — documentado por web.dev, Vercel, Smashing Mag.
 *
 * Ref: https://web.dev/articles/codelab-preload-web-fonts
 */
export function buildPreloadLinkTag(woff2Url) {
  const href = normalizeUrl(woff2Url);
  return `<link rel="preload" as="font" type="font/woff2" href="${href}" crossorigin>`;
}

/**
 * Inserta el preload link en el `<head>`, idempotente.
 *
 * **Position matters:** el preload debe aparecer lo antes posible en
 * `<head>` para que el browser's preload scanner lo procese antes de llegar
 * al `<style>` inlined con los `@font-face`. En la práctica, cualquier
 * posición dentro de `<head>` funciona (preload scanner corre sobre todo el
 * `<head>` antes de empezar a renderizar), pero la recomendación de web.dev
 * es "earlier is better".
 *
 * **Ancla:** `<meta name="theme-color">` siempre está presente en
 * `src/index.html` y se preserva tras el build. Insertamos inmediatamente
 * después. Fallback defensivo: al principio del `<head>` si no estuviera.
 *
 * **Idempotencia:** si el tag exacto ya está, no-op. Esto permite correr el
 * script múltiples veces sin duplicar (útil en watch-mode o en CI que
 * re-ejecuta pasos).
 *
 * @param {string} html — HTML source
 * @param {string} linkTag — tag completo (incluye <link .../>)
 * @returns {string} HTML con el link inyectado (o idéntico si ya estaba)
 * @throws Error si no hay `<head>` en el HTML
 */
export function injectPreloadLink(html, linkTag) {
  if (html.includes(linkTag)) return html;
  const themeColorRe = /(<meta\s+name="theme-color"[^>]*>)/i;
  if (themeColorRe.test(html)) {
    return html.replace(themeColorRe, `$1\n  ${linkTag}`);
  }
  const headOpenRe = /<head>/i;
  if (!headOpenRe.test(html)) {
    throw new Error(
      'HTML no contiene <head> — no se puede inyectar preload. ' +
        'Revisar si el build output cambió o si el input no es HTML válido.',
    );
  }
  return html.replace(headOpenRe, `<head>\n  ${linkTag}`);
}
