# showcase/no-forbidden-rounded

Enforces the border-radius scale: only `rounded-full`, `rounded-lg`,
`rounded-xl`, `rounded-2xl`, `rounded-3xl` (plus `rounded-border` and
directional variants of the allowed steps).

## Why

The radius scale carries hierarchy (DESIGN.md § Shapes): `rounded-2xl` for
standard cards, `rounded-3xl` for form cards, `rounded-lg` for small elements
inside cards. `rounded`, `rounded-sm`, `rounded-md`, `rounded-none`, and
arbitrary values (`rounded-[10px]`) fall outside that vocabulary and erode the
visual rhythm.

## Rule details

### Forbidden

```html
<div class="rounded"></div>
<div class="rounded-sm"></div>
<div class="rounded-md"></div>
<div class="rounded-none"></div>
<div class="rounded-[10px]"></div>
```

### Allowed

```html
<div class="rounded-2xl"></div>   <!-- standard card -->
<div class="rounded-3xl"></div>   <!-- form card -->
<div class="rounded-lg"></div>    <!-- inner elements, buttons, inputs -->
<div class="rounded-full"></div>  <!-- circles: avatars, dots -->
<div class="rounded-t-lg"></div>  <!-- directional variant of allowed step -->
```

## Related

- DESIGN.md § Shapes — "Border-radius — escala permitida" y regla de jerarquía
