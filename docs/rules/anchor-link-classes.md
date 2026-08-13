# showcase/anchor-link-classes

Requires the canonical link class set on text `<a>` elements:
`font-medium text-primary hover:text-primary-emphasis underline
cursor-pointer transition-colors duration-150`.

## Why

Links are the one place the accent hue appears in running text (DESIGN.md
§ Typography — LINKS). A partial set (missing `underline`, or using
`text-blue-500 hover:text-blue-700`) produces links that look subtly
different across screens and breaks the single-hue accent policy.

## Rule details

### Forbidden

```html
<a href="/docs" class="text-primary">Docs</a>                     <!-- incomplete set -->
<a href="/docs" class="text-blue-500 hover:text-blue-700">Docs</a> <!-- generic palette -->
```

### Allowed

```html
<a
  href="/docs"
  class="font-medium text-primary hover:text-primary-emphasis underline cursor-pointer transition-colors duration-150"
>Docs</a>
```

### Exemptions

- `<a [routerLink]="...">` — nav items follow the nav recipes, not the text-link recipe.
- `href="#..."` in-page anchors.
- `<a>` wrapping a `<p-button>` — the button owns the styling.

## Related

- DESIGN.md § Typography — LINKS; § Motion (duration-150 solo en `<a>` de texto)
