# showcase/no-duotone-inline-icon

Restricts `fa-sharp-duotone` usage to hero-scale icons (`text-4xl` and
larger). Forbids duotone inline with body copy or in toolbars.

## Why

Sharp Duotone icons are visually **louder** than single-tone icons at small
sizes. The two-tone fill that reads as tasteful depth at 48-64 px reads as
noise at 16-20 px, where the second tone collapses into pixel soup next to
the primary color.

Big-tech product UIs (Linear, Vercel, Stripe, GitHub) use **a single
family** for their functional UI chrome — list items, nav, metadata,
toolbars — because visual rhythm matters more than per-icon expressiveness.
Duotone icons exist in those products, but only as hero imagery: empty
states, onboarding, feature cards, large-format illustrations.

Mixing duotone and single-tone icons inline at the same size breaks that
rhythm. When your eye scans a list of rows, each duotone icon becomes a
visual anchor that wasn't requested.

Rationale: CLAUDE.md §Iconos §Estrategia de estilos (Regla #1 — un solo
peso para UI funcional).

## Rule details

### Rule

`fa-sharp-duotone` is only allowed on elements that also carry `text-4xl`
(or an implicit size ≥ 4xl from typography). Everywhere else → use
`fa-sharp fa-regular` or `fa-sharp fa-solid` for toggle-active state.

### Forbidden

```html
<!-- inline, default size → reads as noise -->
<i class="fa-sharp-duotone fa-regular fa-bell"></i>

<!-- inline with small size modifier → still too small -->
<i class="fa-sharp-duotone fa-regular fa-star text-base"></i>
<i class="fa-sharp-duotone fa-regular fa-gear text-xl"></i>
<i class="fa-sharp-duotone fa-regular fa-user text-2xl"></i>
<i class="fa-sharp-duotone fa-regular fa-cog text-3xl"></i>

<!-- as a toggle-active icon (use fa-sharp fa-solid instead) -->
<i [ngClass]="on ? 'fa-sharp-duotone fa-regular fa-bookmark' : 'fa-sharp fa-regular fa-bookmark'"></i>
```

### Allowed

```html
<!-- hero-scale empty state / onboarding -->
<i class="fa-sharp-duotone fa-regular fa-cloud-arrow-up text-4xl"></i>
<i class="fa-sharp-duotone fa-regular fa-inbox text-5xl"></i>
<i class="fa-sharp-duotone fa-regular fa-shield text-6xl"></i>

<!-- feature card with large icon -->
<div class="flex flex-col gap-4">
  <i class="fa-sharp-duotone fa-regular fa-chart-line text-4xl text-primary"></i>
  <h3>Premium analytics</h3>
</div>
```

## Related patterns

The dual-tone-for-hero vs. single-tone-for-chrome split is what lets
`<app-empty-state>` use `fa-sharp-duotone` (it always renders at `text-4xl`)
while every other `<i>` in the codebase uses `fa-sharp`.

## When not to use

If you need dense, functional UI in a screen that intentionally has no hero
icons (pure data views, settings forms), never use `fa-sharp-duotone` —
there's no hero context to justify the noise.

## Related

- [`showcase/no-bare-fa-without-sharp`](./no-bare-fa-without-sharp.md)
- [`showcase/no-decorative-icon-without-aria-hidden`](./no-decorative-icon-without-aria-hidden.md)
- CLAUDE.md §Iconos §Estrategia de estilos
