# showcase/no-inline-styles

Forbids static `style="..."` attributes in templates.

## Why

Inline styles bypass every enforcement layer at once: no design tokens, no
dark-mode pairing, no lint scanning of values, no theming. Everything static
must be expressed with Tailwind utilities over design tokens (DESIGN.md
§ Do's and Don'ts).

## Rule details

### Forbidden

```html
<div style="margin-top: 8px; color: #333"></div>
<div style="background: white"></div>
```

### Allowed

```html
<!-- Tailwind + tokens for anything static -->
<div class="mt-2 text-color bg-surface-0 dark:bg-surface-950"></div>

<!-- Angular bindings for genuinely DYNAMIC values -->
<div [style.backgroundColor]="item.color"></div>
<div [ngStyle]="{ width: progress() + '%' }"></div>
```

## Related

- DESIGN.md § Do's and Don'ts (`style=""` inline)
