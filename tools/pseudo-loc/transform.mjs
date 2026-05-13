// @ts-check
/**
 * Pseudo-localizacion deterministica para strings de UI.
 *
 * **Mission**
 *
 * Stripe, Atlassian, Salesforce y todo equipo serio que i18n-iza una app
 * usa un pseudo-locale antes de traducir de verdad: una transformacion
 * mecanica del texto fuente que:
 *
 *   - Reemplaza cada vocal por su variante acentuada (`Save` -> `Save`)
 *     -- esto descubre INMEDIATAMENTE cualquier string hardcodeado que
 *     se salteo la pipeline de i18n. Si el boton sigue diciendo "Save"
 *     despues del pseudo-loc, es un string sin marcar (`i18n="..."`).
 *   - Expande el largo del string (`+25%` tipico) -- esto descubre
 *     overflows de container ANTES de pagar la traduccion a aleman o
 *     portugues que naturalmente expanden esa cantidad.
 *   - Wrappea con `[` y `]` -- esto delimita el rango pseudo-localizado
 *     visualmente en screenshots / captures. Si un `]` aparece pegado a
 *     otro `[`, dos labels distintos colapsaron en el mismo nodo y eso
 *     tambien es un bug de extraccion.
 *
 * **Por que este script vive en `tools/` y no como lib del runtime**
 *
 * El pseudo-loc se aplica como build-time transform sobre los `.html` de
 * templates (ver `scan.mjs` para el orquestador). Cero runtime cost,
 * cero bytes shipped a produccion. La funcion exportada es PURA -- sin
 * IO, sin estado -- para que `scan.mjs` la consuma per-string sin
 * preocupaciones de ordering o memoizacion.
 *
 * **Reglas de transformacion** (orden importa)
 *
 *   1. Si el string YA empieza con `[` y termina con `]`, se asume
 *      pseudo-localizado y se devuelve tal cual (idempotente). Evita
 *      doble wrap en pipelines que aplican el transform 2x.
 *   2. Se segmentan zonas "protegidas" que NO se transforman:
 *      - Interpolaciones Angular `{{ ... }}`
 *      - Decorators `@if (...)`, `@for (...)`, `@switch (...)` y sus
 *        keywords (`@else`, `@empty`)
 *      - Atributos i18n tipo `i18n="..."` (defensivo)
 *      - ICU placeholders `{plural, ...}`, `{select, ...}`
 *      - HTML entities `&...;`
 *      - Numeros (enteros o decimales)
 *   3. Sobre las zonas NO-protegidas se aplica el reemplazo de vocales
 *      (preservando case) y la expansion por palabra.
 *   4. Todo el resultado se wrappea en `[ ... ]`.
 *
 * **Expansion**
 *
 * Solo palabras de >3 chars reciben sufijo + N chars extras, donde
 * N = floor(largoPalabra / 4). Esto da una expansion proporcional que
 * imita el comportamiento de aleman/portugues sin inflar artificialmente
 * palabras cortas (articulos, preposiciones).
 *
 * **Caracteres acentuados ya presentes** (n con tilde, vocales tildadas)
 * se mapean al mismo target que sus vocales base. Esto mantiene
 * idempotencia visual entre input acentuado y sin acentuar.
 */

/**
 * Mapa de vocales (base + variantes acentuadas comunes en es-CL) a sus
 * versiones pseudo-localizadas. Preserva el case de origen.
 */
const VOWEL_MAP = Object.freeze({
  a: 'å',
  'á': 'å',
  'à': 'å',
  'ä': 'å',
  'â': 'å',
  e: 'é',
  'é': 'é',
  'è': 'é',
  'ë': 'é',
  'ê': 'é',
  i: 'î',
  'í': 'î',
  'ì': 'î',
  'ï': 'î',
  'î': 'î',
  o: 'ø',
  'ó': 'ø',
  'ò': 'ø',
  'ö': 'ø',
  'ô': 'ø',
  u: 'ü',
  'ú': 'ü',
  'ù': 'ü',
  'ü': 'ü',
  'û': 'ü',
  A: 'Å',
  'Á': 'Å',
  'À': 'Å',
  'Ä': 'Å',
  'Â': 'Å',
  E: 'É',
  'É': 'É',
  'È': 'É',
  'Ë': 'É',
  'Ê': 'É',
  I: 'Î',
  'Í': 'Î',
  'Ì': 'Î',
  'Ï': 'Î',
  'Î': 'Î',
  O: 'Ø',
  'Ó': 'Ø',
  'Ò': 'Ø',
  'Ö': 'Ø',
  'Ô': 'Ø',
  U: 'Ü',
  'Ú': 'Ü',
  'Ù': 'Ü',
  'Ü': 'Ü',
  'Û': 'Ü',
});

/**
 * Patrones que se sustraen del texto a transformar. El orden de las
 * alternancias importa: ganan los matches mas especificos primero
 * (interpolacion `{{}}` antes que ICU `{}`).
 *
 * Cada zona protegida se reemplaza por un placeholder con sentinels
 * unicode antes de aplicar la transformacion, y se restaura al final.
 */
const PROTECTED_PATTERNS = [
  /\{\{[\s\S]*?\}\}/g, // Angular interpolation
  /@(?:if|for|else|empty|switch|case|default|defer|placeholder|loading|error)\b(?:\s*\([^)]*\))?/g,
  /\bi18n(?:-[a-zA-Z]+)?="[^"]*"/g, // i18n attribute (defensivo)
  /\{[a-zA-Z_][\w]*\s*,\s*(?:plural|select|selectordinal)\s*,[\s\S]*?\}/g, // ICU
  /&[a-zA-Z]+;|&#\d+;|&#x[0-9a-fA-F]+;/g, // HTML entities
  /\b\d+(?:[.,]\d+)?\b/g, // numeros
];

/**
 * Sentinels para marcar zonas protegidas. Usan caracteres del area de uso
 * privado unicode (U+E000) para garantizar que nunca colisionen con texto
 * real ni con la transformacion.
 *
 * El indice del token se serializa como digitos rodeados de underscores
 * (`<E000>_42_<E001>`). El rodeo con `_` es defensivo:
 *
 *   - `\b\d+\b` (patron de numeros del strip-pass): el word-boundary
 *     falla porque `_` es word-char, asi que el indice NO se matchea
 *     como "numero" en una segunda pasada del strip.
 *   - `\p{L}+` (patron de expansion): digitos y underscore no son
 *     unicode-letter, asi que la expansion no toca el indice.
 *
 * Con esto el orden de aplicacion de los patrones de strip es seguro.
 */
const SENTINEL_OPEN = '\u{E000}';
const SENTINEL_CLOSE = '\u{E001}';
const SENTINEL_RE = /\u{E000}_(\d+)_\u{E001}/gu;

/**
 * Reemplaza vocales preservando el case. Caracteres no-vocales
 * (consonantes, puntuacion, whitespace) pasan sin cambios.
 *
 * @param {string} segment
 * @returns {string}
 */
function transliterateVowels(segment) {
  let out = '';
  for (const ch of segment) {
    out += VOWEL_MAP[/** @type {keyof typeof VOWEL_MAP} */ (ch)] ?? ch;
  }
  return out;
}

/**
 * Expande palabras de >3 chars con un sufijo. Mantiene whitespace y
 * puntuacion entre palabras. La unidad "palabra" es secuencia de chars
 * unicode-letter; signos como `,`, `.`, `:`, `?`, etc. terminan la
 * palabra y se preservan en su posicion original.
 *
 * @param {string} segment
 * @returns {string}
 */
function expandWords(segment) {
  return segment.replace(/\p{L}+/gu, (word) => {
    if (word.length <= 3) return word;
    const extra = Math.floor(word.length / 4);
    return word + '—' + '¡'.repeat(extra);
  });
}

/**
 * Aplica los patrones de zona protegida sobre `input`, reemplazandolos
 * por placeholders con sentinels unicode.
 *
 * @param {string} input
 * @returns {{ stripped: string, tokens: string[] }}
 */
function stripProtected(input) {
  /** @type {string[]} */
  const tokens = [];
  let stripped = input;
  for (const pattern of PROTECTED_PATTERNS) {
    stripped = stripped.replace(pattern, (match) => {
      const idx = tokens.length;
      tokens.push(match);
      return `${SENTINEL_OPEN}_${idx}_${SENTINEL_CLOSE}`;
    });
  }
  return { stripped, tokens };
}

/**
 * Restaura los tokens protegidos en su lugar original.
 *
 * @param {string} input
 * @param {string[]} tokens
 * @returns {string}
 */
function restoreProtected(input, tokens) {
  return input.replace(SENTINEL_RE, (_, idx) => tokens[Number(idx)] ?? '');
}

/**
 * Pseudo-localiza un string de UI. Idempotente: si ya esta envuelto en
 * `[...]`, devuelve el input sin cambios.
 *
 * @param {string} input
 * @returns {string}
 */
export function pseudoLoc(input) {
  if (typeof input !== 'string') return '';
  if (input.length === 0) return '';

  // Idempotencia: detectar marcador. Conservador -- solo skip si empieza
  // con `[` Y termina con `]` Y el contenido del medio NO esta vacio.
  if (input.length >= 2 && input.startsWith('[') && input.endsWith(']')) {
    return input;
  }

  const { stripped, tokens } = stripProtected(input);
  const transliterated = transliterateVowels(stripped);
  const expanded = expandWords(transliterated);
  const restored = restoreProtected(expanded, tokens);
  return `[${restored}]`;
}
