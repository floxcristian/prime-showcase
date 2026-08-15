# ADR-002: Paleta de marca Implementos — anclaje en Pantone y derivacion en OKLCH

- **Estado:** Aceptado
- **Fecha:** 2026-08-14
- **Autores:** Cristian Flores

## Contexto

El design system del showcase venia pintando con una paleta que **se parecia** a la de Implementos sin ser la de Implementos.

Estado antes de este cambio, verificado archivo por archivo:

| Superficie | Que corria | Que dice el brand book |
|---|---|---|
| `primary.500` | `#0074C2` — "en familia del logo", mismo hue, distinto color | `#006DB6`, PANTONE 300 U |
| Verde de marca | No existia. Vivia **solo** dentro del SVG del logo | `#00937F`, PANTONE 334 U |
| Gris neutro | `slate` en light, `zinc` en dark — defaults de Aura, nunca declarados | `#636569`, PANTONE Cool Gray 10 C |
| `tornado.svg` (fondo del chrome y de los asides de auth) | `#005DB9`, `#0073c8`, `#0089D6` — tres azules fuera de toda paleta | — |
| `<meta name="theme-color">` | `#0074c2`, copia manual, sin gate | — |
| `.storybook/manager.ts` | 14 hexes hardcodeados del catalogo publicado | — |

Cuatro azules de marca coexistiendo, y **ninguno** era el declarado. Los ratios de contraste que `DESIGN.md` publicaba estaban medidos a mano una sola vez, y tres ya eran falsos (el comentario del preset citaba `#52525b` para un token que resolvia a `#475569`, y afirmaba 5.9:1 para un par que medía 7.5:1).

Ademas, `public/implementos-logo.svg` dibujaba el wordmark **dos veces** — una copia invisible debajo de la placa opaca de la otra — sirviendo ~9,4 kB de peso muerto (48 % del archivo) en toda ruta autenticada.

### El conflicto de fuentes

Marca entrego un `logo.svg` corregido cuyos tonos (`#0545BA` / `#059868`) **no coinciden** con la "PALETA DE COLOR PRIMARIA" del propio manual (`#006DB6` / `#00937F`). Ambos no pueden ser normativos.

Se resolvio con evidencia del propio PDF. Extrayendo los operadores de color de sus content streams:

- La pagina "PALETA DE COLOR PRIMARIA" pinta sus muestras exactamente en `#006DB6`, `#00937F` y `#636569` — los tres hex coinciden con el texto impreso al lado.
- **El artwork del logo dentro del brand book**, en todas las paginas del capitulo 02 (version principal, versiones color, tamaño minimo, margenes, usos incorrectos), esta pintado en `#006DB6` / `#00937F`.
- `#0047AD` y `#00B380` aparecen 24 y 7 veces, pero solo como chrome de la propia presentacion (encabezados, numeros de capitulo) — no son tokens declarados.

O sea: el manual es internamente consistente, y su propia representacion del logo usa la paleta declarada. Los tonos del SVG entregado son la anomalia.

## Decision

**1. El brand book manda para la paleta de producto.** Los tres ramps se anclan en `#006DB6`, `#00937F` y `#636569`.

**2. El logo conserva la correccion estructural del archivo entregado y recupera los tonos del manual.** La regla "NUNCA ALTERAR LOS TONOS EN EL LOGOTIPO" (cap. 02) se respeta: esto no aparta el logo de sus tonos corporativos, lo devuelve a ellos — y a los que el propio manual dibuja.

**3. Los ramps se derivan, no se eligen.** Once shades por ancla, en OKLCH: hue constante, curva de lightness perceptualmente pareja, envolvente de croma que se afloja hacia los extremos. El shade 500 reproduce su Pantone byte a byte.

**4. El verde es acento y se mantiene separado de la semantica.** No se remapea la severity `success` de PrimeNG. Ver [Consecuencias](#consecuencias).

**5. Un solo gris para ambos modos.** La marca declara un gris.

**6. Las afirmaciones de contraste pasan a ser computadas.** `tools/design-tokens/brand.mjs`, dentro de `npm run lint`.

### Por que OKLCH y no HSL

Un ancla de marca da **un** punto; los otros diez shades hay que derivarlos. Derivar en HSL — que es lo que hace la mayoria de las paletas hechas a mano — produce ramps desparejos, porque la `L` de HSL no es lightness percibida: `hsl(204, 100%, 50%)` y `hsl(60, 100%, 50%)` declaran la misma lightness y difieren en ~60 puntos de lightness medida.

En OKLCH un paso constante de `L` **es** un paso constante de lightness percibida. Es lo que hace que `primary.600` se lea como "un escalon mas oscuro que 500" en vez de "otro azul mas oscuro". Es tambien el espacio al que migro Tailwind 4, asi que no es una eleccion exotica.

Un detalle que importo: `#006DB6` vive cerca del borde del gamut sRGB. Clipear canales para volver al gamut le rota el hue de forma visible; `oklchToHex()` en su lugar hace busqueda binaria sobre el croma maximo que entra, manteniendo `L` y `h` fijos. Sin eso, el ramp se salia de su propia linea de hue justo en los shades saturados.

### Por que el gris tambien cambia, y por que el cambio es chico

`#636569` es casi acromatico (croma OKLCH ~0.007). `slate` corre ~0.04 con hue 257°; `zinc`, ~0.01 con hue 286°. O sea que las superficies del producto no eran del gris de la marca, y ademas **cambiaban de temperatura al togglear el tema**, porque light y dark corrian familias distintas.

La curva de lightness del neutro nuevo **reproduce la de slate/zinc**, medida, no inventada (ambas son casi identicas entre si: 98.4/96.8/92.9/86.9/71.1/55.4/44.6/37.2/27.9/20.8/12.9 vs 98.5/96.7/92.0/87.1/71.2/55.2/44.2/37.0/27.4/21.0/14.1). Solo cambian hue y croma. La unica desviacion apreciable es el shade 500, que baja 4.8 puntos para aterrizar en el Pantone exacto; el resto queda dentro de ~3 puntos.

Esa decision es deliberada: el ritmo de lightness de las superficies es load-bearing (`surface.200` es `bg-emphasis`, `surface.600` es `text-muted-color`, `surface.950` es la pagina en dark). Conservarlo convierte el cambio en un **recolor de marca** en vez de un rediseño de superficies — los ratios de contraste y la densidad visual se trasladan casi intactos.

## Alternativas consideradas

**Adoptar los tonos del SVG entregado (`#0545BA` / `#059868`).** Descartada: contradice la pagina que el manual titula "PALETA DE COLOR PRIMARIA" y contradice el artwork del logo dentro del propio manual. Habria alineado el producto con un archivo suelto en vez de con el documento normativo.

**Dejar el logo con sus tonos y correr la UI con los del manual.** Descartada: deja ~15° de diferencia de hue entre el logo del header y el `bg-primary` inmediatamente al lado. Un color de marca que no coincide consigo mismo a 40 px de distancia.

**Mapear el verde de marca a la severity `success`.** Descartada, y es la alternativa mas tentadora. Habria dado mas cohesion cromatica, pero pone el verde en cada toast de confirmacion, cada `p-tag` de estado y cada badge de exito — precisamente el "verde dominante" que el manual lista como error, dos veces y en dos capitulos distintos. Lo que hace de marca a un color es su escasez.

**Dejar `slate`/`zinc` y tocar solo azul y verde.** Descartada: el gris es uno de los cuatro colores declarados. Una app cuyos neutros no son los neutros de la marca no esta alineada, por mucho que el acento lo este.

**Un `bg-accent` semantico y mode-aware, en espejo de `bg-primary`.** Descartada por accesibilidad: `accent.500` mide 3.8:1 sobre blanco, bajo el 4.5:1 de AA. Un `bg-accent` con label encima habria fallado en silencio. El acento se pide siempre con shade explicito, lo que ademas obliga a que cada uso sea una decision.

## Consecuencias

### A favor

- `bg-primary` **es** PANTONE 300 U. No una aproximacion.
- El verde de marca existe por primera vez como token (`--p-accent-*`, `bg-accent-500`, …) en vez de estar sepultado dentro de un SVG.
- Un solo neutro: las superficies dejan de cambiar de temperatura entre modos.
- El contraste mejora en los pares que mas se usan: `primary.500` sobre blanco pasa de 4.9:1 a **5.4:1**; el texto muted, de 7.5:1 a **8.8:1**.
- El logo pesa 43 % menos (19.4 kB → 11.1 kB) y dibuja su artwork una sola vez.
- Los hexes literales que vivian fuera de toda cascada (`theme-color`, `tornado.svg`, tonos del logo) pasan a estar gateados.
- Los ratios de `DESIGN.md` dejan de ser una afirmacion y pasan a ser una salida.

### En contra / a vigilar

- **Los 87 baselines visuales se invalidan** (13 de rutas + 74 de Storybook). Es inherente a un cambio de paleta. Regenerar con el workflow "Visual baselines (manual)", que es el camino mandatado (el render local difiere del runner).
- **El fondo de marca queda mas oscuro.** Las tres paradas de `tornado.svg` bajan ~9-10 puntos de lightness al mapearse a `primary.700/600/500`. Sube el contraste del texto blanco encima (la parada mas clara pasa de 3.7:1 a 5.4:1) y coincide con lo que el manual pide para superficies de marca ("fondo liso y alto contraste"), pero es un cambio visible que conviene mirar en los screenshots.
- **El verde queda declarado y sin uso en UI.** A proposito: darle uso es diseño, no correccion de color, y forzarlo seria justo el error que el manual advierte. Los tokens estan listos y la regla de cuando aplicarlos esta en `DESIGN.md`.
- **El halo de foco sigue en 1.4:1.** Deuda preexistente, no una regresion (el halo anterior medía exactamente lo mismo). No incumple AA — WCAG 2.1 §2.4.7 solo exige que el foco se vea; el piso de 3:1 es §2.4.11, AAA en WCAG 2.2. `brand.mjs` lo mide y lo reporta como `info` en cada corrida para que la deuda quede a la vista. Subirlo implica repensar el halo estilo Lara completo.
- **`primary.contrastColor` sigue siendo `#ffffff` heredado de Aura**, no un token del repo. El par esta gateado en `brand.mjs`, pero si alguien aclara el primary lo suficiente, el que rompe es un token que no controlamos.

## Referencias

- `docs/implementos/Brand book Implementos 2026.pdf` — cap. 02 (logotipo), cap. 03 (paleta), cap. 05 y 07 (verde como acento).
- `tools/design-tokens/color.mjs` — conversiones OKLCH/WCAG y derivacion de ramps.
- `tools/design-tokens/brand.mjs` — gate de conformidad. `npm run design-tokens:brand:report`.
- `DESIGN.md` §Colors → "La paleta de marca" y "Azul base / verde acento".
- ADR-001 §2 — `transitionDuration: '0s'`, que este cambio no debe reintroducir.
