// @ts-check
/**
 * @fileoverview Pure token resolver — turns the merged Aura + project
 * preset into a flat map of effective hex values per color scheme.
 *
 * **Why a custom resolver and not Aura's `toVariables()`**
 *
 * `@primeuix/themes` exposes `toVariables()` which produces a complete
 * CSS string (`--p-treeselect-...: var(--p-form-field-...)` etc., 158k+
 * chars). That output is great for runtime injection but useless for
 * drift detection — every variable points at another variable, never at
 * a final hex. Resolving the indirections requires walking the preset
 * tree ourselves.
 *
 * **What we resolve**
 *
 *   1. `colors.primary.{50..950}`  — our literal hex overrides.
 *   2. `colors.surface.{0..950}`    — per mode (light=slate, dark=zinc).
 *   3. `colors.semantic.textColor`        — Aura default (resolved per mode).
 *   4. `colors.semantic.textMutedColor`   — our override `{surface.N}`.
 *   5. `colors.semantic.formField.invalidBorderColor` — `{rose.N}`.
 *   6. `colors.semantic.focusRingShadow`  — composite `0 0 0 0.2rem {primary.200}`.
 *
 * **Resolution algorithm**
 *
 * Given a token reference like `{surface.600}`, the resolver looks up
 * the path in three sources, in priority order:
 *
 *   a) `preset.semantic.colorScheme[mode]` — per-mode overrides.
 *   b) `preset.semantic`                    — common semantic.
 *   c) `preset.primitive`                   — base palettes (rose, slate…).
 *
 * The returned value may itself be a reference (Aura surfaces map
 * `{surface.500}` → `{slate.500}` → `#64748b`), so the resolver recurses
 * until it hits a literal hex (or a non-color literal like `0`/`9999px`).
 *
 * **Pure function**
 *
 * No `fs`, no `path`, no side effects. Driven entirely by its input. That
 * makes it unit-testable with `node --test` against minimal fixtures
 * (see `__tests__/resolver.test.mjs`).
 */

const REF_RE = /\{([^}]+)\}/g;
const MAX_DEPTH = 12;

/**
 * Looks up a dotted path in an object. Returns undefined if any segment
 * is missing. Numeric-looking segments are tried as both string and
 * number keys (palette shades like `500` may be either depending on the
 * source).
 *
 * @param {object} obj
 * @param {string[]} segments
 */
function lookupPath(obj, segments) {
  let cur = obj;
  for (const seg of segments) {
    if (cur == null || typeof cur !== 'object') return undefined;
    if (seg in cur) {
      cur = cur[seg];
      continue;
    }
    const asNum = Number(seg);
    if (!Number.isNaN(asNum) && asNum in cur) {
      cur = cur[asNum];
      continue;
    }
    return undefined;
  }
  return cur;
}

/**
 * Resolves one `{token.path}` reference against the preset.
 *
 * Priority chain mirrors how Aura resolves at runtime:
 *   1. colorScheme[mode]  — per-mode override (light or dark surface, etc.)
 *   2. semantic           — non-mode semantic tokens (primary palette etc.)
 *   3. primitive          — base palettes (rose, slate, zinc, …)
 *
 * Returns the looked-up value (which may be another `{ref}` string,
 * the caller handles recursion).
 *
 * @param {string} path
 * @param {object} preset
 * @param {'light' | 'dark'} mode
 */
function lookupReference(path, preset, mode) {
  const segments = path.split('.');
  const sources = [
    preset?.semantic?.colorScheme?.[mode],
    preset?.semantic,
    preset?.primitive,
  ];
  for (const source of sources) {
    const v = lookupPath(source, segments);
    if (v !== undefined) return v;
  }
  return undefined;
}

/**
 * Resolves a value end-to-end. Handles:
 *   - Literal strings (returns as-is): `'#0074c2'`, `'9999px'`, `'0'`.
 *   - Single reference: `'{rose.500}'` → recurse.
 *   - Composite string with embedded references:
 *     `'0 0 0 0.2rem {primary.200}'` → resolved inline.
 *   - Non-strings (numbers, undefined): returned as-is.
 *
 * Recursion depth is bounded to MAX_DEPTH so a malformed preset with
 * circular references fails loud instead of hanging.
 *
 * @param {unknown} value
 * @param {object} preset
 * @param {'light' | 'dark'} mode
 * @param {number} [depth]
 * @returns {string | number | undefined}
 */
export function resolveValue(value, preset, mode, depth = 0) {
  if (depth > MAX_DEPTH) {
    throw new Error(
      `Token resolution exceeded max depth (${MAX_DEPTH}); circular reference?`,
    );
  }
  if (value == null) return undefined;
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return undefined;

  // Pure reference like `{rose.500}` — recurse on the looked-up value
  // so chains (`{surface.500}` → `{slate.500}` → `#64748b`) collapse.
  const trimmed = value.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}') && !trimmed.includes(' ')) {
    const inner = trimmed.slice(1, -1);
    const looked = lookupReference(inner, preset, mode);
    if (looked === undefined) return value; // unresolved — return original
    return resolveValue(looked, preset, mode, depth + 1);
  }

  // Composite string — replace each `{ref}` inline, leave the rest.
  REF_RE.lastIndex = 0;
  if (!REF_RE.test(value)) return value;
  REF_RE.lastIndex = 0;
  return value.replace(REF_RE, (_, path) => {
    const looked = lookupReference(path, preset, mode);
    if (looked === undefined) return `{${path}}`;
    const resolved = resolveValue(looked, preset, mode, depth + 1);
    return resolved == null ? `{${path}}` : String(resolved);
  });
}

/**
 * The canonical set of token paths we EXPORT from the preset for drift
 * detection + JSON artifact. Extend this when you add a new project-
 * owned token. Adding here automatically:
 *   - gates `npm run design-tokens:check` on it
 *   - publishes it in `design-tokens/tokens.json`
 *
 * Each entry is `[paths…, expectedShape]`. `expectedShape` tells the
 * exporter how to format the entry in the JSON output:
 *   - 'hex'      → string color literal
 *   - 'shadow'   → CSS shadow composite (kept as a string)
 *   - 'palette'  → entire keyed map (e.g. primary.{50..950})
 */
export const EXPORTED_TOKENS = /** @type {const} */ ({
  // Brand palette (literal hex in our preset)
  primary: { kind: 'palette', path: ['semantic', 'primary'] },

  // Surface palette per mode (Aura defaults: light=slate, dark=zinc;
  // shade 0 hard-coded to white in both)
  surface: { kind: 'paletteByMode', path: ['surface'] },

  // Project semantic overrides — resolved per mode
  textMutedColor: {
    kind: 'colorByMode',
    path: ['text', 'muted', 'color'],
  },
  invalidBorderColor: {
    kind: 'colorByMode',
    path: ['formField', 'invalidBorderColor'],
  },

  // Focus ring shadow — composite, resolved without mode (uses semantic.primary)
  focusRingShadow: {
    kind: 'composite',
    path: ['semantic', 'focusRing', 'shadow'],
  },
});

/**
 * Resolves a single shade from a per-mode palette.
 *   - `{slate.500}` → `#64748b` (light)
 *   - `{zinc.500}`  → `#71717a` (dark)
 *
 * @param {object} preset
 * @param {'light' | 'dark'} mode
 * @param {string} paletteName
 * @param {string} shade
 */
function resolveShade(preset, mode, paletteName, shade) {
  const surface = lookupReference(`${paletteName}.${shade}`, preset, mode);
  if (surface === undefined) return undefined;
  const resolved = resolveValue(surface, preset, mode);
  return typeof resolved === 'string' ? resolved : undefined;
}

/**
 * Returns the surface palette as resolved hex for the given mode.
 * Aura's surface map points at `{slate.N}` for light, `{zinc.N}` for
 * dark — this helper hides that indirection from callers.
 *
 * @param {object} preset
 * @param {'light' | 'dark'} mode
 * @returns {Record<string, string>}
 */
export function resolveSurfacePalette(preset, mode) {
  const result = {};
  const shades = ['0', '50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];
  for (const shade of shades) {
    const v = resolveShade(preset, mode, 'surface', shade);
    if (v !== undefined) result[shade] = v;
  }
  return result;
}

/**
 * Returns the primary palette as it sits in the preset. No resolution
 * needed because we declare it as literal hex.
 *
 * @param {object} preset
 * @returns {Record<string, string>}
 */
export function resolvePrimaryPalette(preset) {
  const out = {};
  const palette = preset?.semantic?.primary ?? {};
  for (const [shade, value] of Object.entries(palette)) {
    if (typeof value === 'string') out[shade] = value;
  }
  return out;
}

/**
 * Resolves a per-mode color override (e.g. `text.muted.color`).
 *
 * @param {object} preset
 * @param {string[]} path
 * @param {'light' | 'dark'} mode
 */
export function resolveColorByMode(preset, path, mode) {
  const branch = preset?.semantic?.colorScheme?.[mode];
  const value = lookupPath(branch, path);
  if (value === undefined) return undefined;
  const resolved = resolveValue(value, preset, mode);
  return typeof resolved === 'string' ? resolved : undefined;
}

/**
 * Resolves a `{primary.N}` or `{surface.N}` reference inside the
 * PROJECT_TOKENS avatar block against the preset palettes. Avatar
 * tokens are declared as references (`'{primary.100}'`) so that
 * brand recolours propagate without manual edits.
 */
function resolveAvatarColor(preset, value, mode) {
  if (typeof value !== 'string') return undefined;
  const m = value.match(/^\{(primary|surface)\.(\d+)\}$/);
  if (!m) return value;
  const r = resolveShade(preset, mode, m[1], m[2]);
  return typeof r === 'string' ? r : undefined;
}

/**
 * Top-level export: produces the canonical resolved token map.
 *
 * Shape:
 *   {
 *     primary: { '50': '#eff8ff', …, '950': '#001829' },
 *     surface: {
 *       light: { '0': '#ffffff', '50': '#f8fafc', …, '950': '#020617' },
 *       dark:  { '0': '#ffffff', '50': '#fafafa', …, '950': '#09090b' },
 *     },
 *     semantic: {
 *       textMutedColor:     { light: '#52525b', dark: '#d4d4d8' },
 *       invalidBorderColor: { light: '#f43f5e', dark: '#fb7185' },
 *       focusRingShadow:    '0 0 0 0.2rem #b2ddf9',
 *       motion: { duration: { fast: '150ms', … }, easing: { … } },
 *       zIndex: { sticky: 10, overlay: 1100, … },
 *       avatar: { initials: { light: { background, color }, dark: … } },
 *     },
 *   }
 *
 * **Project-extra tokens** (motion, zIndex, avatar, density) are
 * sourced from `PROJECT_TOKENS` if it is exported by the preset
 * module. They live alongside the colour tokens in the JSON
 * artifact so external consumers (Figma plugin, mobile theme,
 * downstream repos) see one document, not two.
 *
 * @param {object} preset — merged preset (definePreset(Aura, overrides))
 * @param {object} [projectTokens] — PROJECT_TOKENS export from preset module
 */
export function exportTokens(preset, projectTokens) {
  const base = {
    primary: resolvePrimaryPalette(preset),
    surface: {
      light: resolveSurfacePalette(preset, 'light'),
      dark: resolveSurfacePalette(preset, 'dark'),
    },
    semantic: {
      textMutedColor: {
        light: resolveColorByMode(preset, ['text', 'muted', 'color'], 'light'),
        dark: resolveColorByMode(preset, ['text', 'muted', 'color'], 'dark'),
      },
      invalidBorderColor: {
        light: resolveColorByMode(preset, ['formField', 'invalidBorderColor'], 'light'),
        dark: resolveColorByMode(preset, ['formField', 'invalidBorderColor'], 'dark'),
      },
      focusRingShadow: (() => {
        const raw = preset?.semantic?.focusRing?.shadow;
        // Focus ring shadow doesn't change per mode, but its `{primary.200}`
        // reference resolves through either branch. Resolve in light.
        return resolveValue(raw, preset, 'light');
      })(),
    },
  };

  if (!projectTokens) return base;

  base.semantic.motion = projectTokens.motion;
  base.semantic.zIndex = projectTokens.zIndex;
  base.semantic.density = projectTokens.density;
  base.semantic.elevation = projectTokens.elevation;
  base.semantic.avatar = {
    initials: {
      light: {
        background: resolveAvatarColor(
          preset,
          projectTokens.avatar?.initialsBackground?.light,
          'light',
        ),
        color: resolveAvatarColor(
          preset,
          projectTokens.avatar?.initialsColor?.light,
          'light',
        ),
      },
      dark: {
        background: resolveAvatarColor(
          preset,
          projectTokens.avatar?.initialsBackground?.dark,
          'dark',
        ),
        color: resolveAvatarColor(
          preset,
          projectTokens.avatar?.initialsColor?.dark,
          'dark',
        ),
      },
    },
  };

  return base;
}
