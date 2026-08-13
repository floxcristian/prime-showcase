# showcase/no-hardcoded-colors

Forbids generic Tailwind palette colors (`text-gray-500`, `bg-blue-100`,
`text-slate-700`), `text-white`/`bg-black`, and arbitrary color values
(`bg-[#fff]`, `bg-[rgb(0,0,0)]`) in templates.

## Why

The design system paints exclusively with semantic Aura tokens so light/dark
theming, contrast targets, and future palette changes stay centralized in the
preset (`src/app/app.preset.ts`). A hardcoded gray bypasses all of that and
silently breaks dark mode.

Rationale: DESIGN.md § Colors — "Principio: solo design tokens".

## Rule details

### Forbidden

```html
<div class="text-gray-500 bg-blue-100"></div>
<span class="text-white bg-black"></span>
<div class="bg-[#ffffff] text-[rgb(20,20,20)]"></div>
```

### Allowed

```html
<div class="text-color bg-surface-0 dark:bg-surface-950"></div>
<span class="text-muted-color text-primary bg-emphasis"></span>
<!-- Semantic exceptions with fixed meaning (DESIGN.md § Excepciones) -->
<p-tag class="bg-violet-100 text-violet-950"></p-tag>
<i class="text-green-500"></i> <!-- online dot -->
<div class="border-black/10 dark:border-white/20"></div> <!-- main layout -->
```

## Related

- DESIGN.md § Colors, § Excepciones permitidas
- [`no-missing-dark-pair`](./no-missing-dark-pair.md)
