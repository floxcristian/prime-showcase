# showcase/text-3xl-requires-bold

Requires `font-bold` on any element that carries `text-3xl`.

## Why

Hero titles (`text-3xl`) always pair with `font-bold` (DESIGN.md
§ Typography, decisión 2026-04-21): the weight — not just the size — is what
lets the eye find the page's H1 instantly. Mixing `text-3xl font-semibold`
and `text-3xl font-bold` across screens is inconsistency no per-value check
catches, so this rule validates the combination on the element.

## Rule details

The scan aggregates ALL class strings of the element (static + bound:
`class`, `[ngClass]`, `[class]`, `*StyleClass`) — `font-bold` may live in a
different attribute than `text-3xl`.

### Forbidden

```html
<div class="text-3xl font-semibold">Título</div>
<div class="text-3xl">Título</div>
```

### Allowed

```html
<div class="text-color text-3xl font-bold leading-normal">Título</div>
<div class="text-3xl" [ngClass]="{ 'font-bold': true }">Título</div>
```

## Related

- DESIGN.md § Typography — "Combinaciones aprobadas", "Distribución de pesos"
- [`no-forbidden-typography`](./no-forbidden-typography.md)
