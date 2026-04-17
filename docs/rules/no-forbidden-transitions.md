# showcase/no-forbidden-transitions

Disallows `transition-all` and the bare `transition` utility. Requires explicit, narrow
transitions (`transition-colors`, `transition-opacity`, `transition-transform`).

## Why

`transition-all` animates **every** animatable property simultaneously —
`outline-width`, `outline-offset`, `box-shadow`, `border-color`, `transform`, `color`,
and so on. The most visible consequence: **focus rings fade in and out over 150 ms**
whenever an element gains/loses focus.

This is inconsistent with PrimeNG's default behavior, which sets
`transitionDuration: '0s'` on the Aura preset so focus rings appear instantly. Mixing
`transition-all` elements with PrimeNG components produces a split-brain UX: some
focus rings snap in, others fade. Big-tech product UIs (GitHub, Linear, Stripe,
Vercel) all standardize on narrow transitions for exactly this reason — crisp,
predictable focus rings are a hallmark of polish.

Tailwind 4's bare `transition` utility expands to the same default property list
that includes `all`, so it's equivalent to `transition-all` and equally prohibited.

Rationale: CLAUDE.md §Transiciones, ADR-001 §9.

## Rule details

### Forbidden

```html
<div class="transition-all">           <!-- plain -->
<div class="transition">               <!-- bare (Tailwind 4 default list) -->
<div class="!transition-all">          <!-- !important -->
<div class="hover:transition-all">     <!-- any variant prefix -->
<div class="md:transition-all">
<div class="dark:transition-all">
<div class="group-hover:transition-all">
<div class="md:!transition-all">       <!-- variant + important -->
<div class="transition-[all]">         <!-- arbitrary "all" -->
<div class="transition-[box-shadow,color]">   <!-- arbitrary with forbidden props -->
```

### Allowed

```html
<div class="transition-colors">        <!-- bg/text color changes -->
<div class="transition-opacity">       <!-- images, avatars, icons -->
<div class="transition-transform">     <!-- movement, scale, rotate -->
<div class="transition-none">          <!-- explicit off -->
<div class="transition-shadow">        <!-- shadow changes (rare, but narrow) -->
<div class="transition-[transform]">   <!-- narrow arbitrary value -->
<div class="hover:transition-colors">  <!-- variants on allowed utilities -->
```

## Suggestions

Each error provides three editor suggestions:

1. **Replace with transition-colors** — for hover states that change `bg-*` / `text-*`
2. **Replace with transition-opacity** — for images, avatars, fade effects
3. **Replace with transition-transform** — for movement, scale, rotate

Suggestions preserve any variant prefix (`hover:`, `md:`) and the `!important`
modifier, so `md:!transition-all` becomes `md:!transition-colors`.

## When not to use

If you genuinely need to animate multiple properties simultaneously, use the
narrow arbitrary form: `transition-[transform,opacity]`. This is explicit about
what animates and keeps the focus ring out of the property list. Document the
reason in a comment — complex transitions should be deliberate.

## Related

- [`showcase/hover-requires-cursor-pointer`](./hover-requires-cursor-pointer.md)
- ADR-001 §9 — transition policy
- CLAUDE.md §Transiciones
