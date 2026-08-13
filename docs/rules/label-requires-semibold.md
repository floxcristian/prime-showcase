# showcase/label-requires-semibold

Enforces label weights by control type: input labels take `font-semibold`;
checkbox/radio labels take `font-normal` (and must NOT take `font-semibold`).

## Why

DESIGN.md § Typography: the label ABOVE a control (input, select, textarea)
anchors the field visually → `font-semibold` (Stripe/Linear/Polaris pattern).
The label BESIDE a checkbox/radio is an option, not a field anchor →
`font-normal` (GitHub/Stripe/Google pattern). Swapping them flattens the form
hierarchy.

## Rule details

### Forbidden

```html
<label for="email" class="text-color leading-6">Email</label>           <!-- input label sin semibold -->
<label class="font-semibold"><p-checkbox [binary]="true" /> Acepto</label> <!-- checkbox label con semibold -->
```

### Allowed

```html
<label for="email" class="text-color font-semibold leading-6">Email</label>
<label class="text-color font-normal leading-6">
  <p-radiobutton name="plan" value="pro" /> Plan Pro
</label>
```

## Related

- DESIGN.md § Typography — LABELS; § Layout — "Formularios dentro de cards"
