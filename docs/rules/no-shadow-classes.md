# showcase/no-shadow-classes

Forbids `shadow-*` and `drop-shadow-*` utilities.

## Why

The project expresses elevation with `border border-surface rounded-2xl`, not
shadows (DESIGN.md § Elevation & Depth — "NO usar sombras"). Shadows re-create
a depth vocabulary the system deliberately avoids and behave inconsistently in
dark mode.

## Rule details

### Forbidden

```html
<div class="shadow-md rounded-2xl"></div>
<div class="drop-shadow-lg"></div>
<div class="shadow-[0_2px_8px_rgba(0,0,0,0.2)]"></div>
```

### Allowed

```html
<div class="border border-surface rounded-2xl"></div>
<!-- Resets that REMOVE PrimeNG shadows are fine -->
<p-select class="!border-0 !shadow-none"></p-select>
```

Documented runtime exception: the Chart.js custom tooltip applies a shadow via
`classList.add()` in TS (DESIGN.md § Elevation, excepción 1) — outside this
rule's HTML scope by design.

## Related

- DESIGN.md § Elevation & Depth
