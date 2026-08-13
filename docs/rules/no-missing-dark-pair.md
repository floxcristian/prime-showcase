# showcase/no-missing-dark-pair

Requires a `dark:bg-surface-*` counterpart whenever a light `bg-surface-*`
shade is used.

## Why

Surfaces don't invert automatically: `bg-surface-100` on its own renders a
light gray in BOTH modes, producing a glaring light patch in dark mode. Every
light surface shade must declare its dark partner (DESIGN.md § Dark mode).

## Rule details

### Forbidden

```html
<div class="bg-surface-100"></div>
<div class="bg-surface-0 p-4"></div>
```

### Allowed

```html
<div class="bg-surface-100 dark:bg-surface-800"></div>
<div class="bg-surface-0 dark:bg-surface-950"></div>
<!-- Dark shades used as the base don't need a pair -->
<div class="bg-surface-900"></div>
<div class="bg-surface-950"></div>
```

## Related

- DESIGN.md § Dark mode
- [`no-hardcoded-colors`](./no-hardcoded-colors.md)
