# showcase/no-decorative-icon-without-aria-hidden

Requires every `<i>` element carrying a Font Awesome class to declare
`aria-hidden="true"` (or the Angular binding `[attr.aria-hidden]="true"`).

## Why

Font Awesome's own documentation is explicit:

> By default, we treat any icon placed with `<i>` as decorative. Screen
> readers should skip them. Add `aria-hidden="true"` so that assistive
> tech ignores the element.

Without `aria-hidden`, screen readers may announce the icon's font
character, which leaks garbage into the accessible name:

```html
<button aria-label="Notifications">
  <i class="fa-sharp fa-regular fa-bell"></i>
</button>
```

Expected announcement: *"Notifications, button"*.
Without `aria-hidden` on the `<i>`, some screen readers announce:
*"Private use area 6293, Notifications, button"* — garbage-then-label.

The semantic meaning should live on the **adjacent text** (or `aria-label`
on the parent button). The icon is purely visual.

Rationale: Font Awesome accessibility docs, CLAUDE.md §Iconos.

## Rule details

### Forbidden

```html
<button aria-label="Refresh">
  <i class="fa-sharp fa-regular fa-arrows-rotate"></i>   <!-- ❌ missing aria-hidden -->
</button>

<i class="fa-sharp fa-solid fa-star"></i>                 <!-- ❌ -->
<i [ngClass]="cond ? 'fa-sharp fa-solid fa-star' : 'fa-sharp fa-regular fa-star'"></i>  <!-- ❌ -->
```

### Allowed

```html
<button aria-label="Refresh">
  <i class="fa-sharp fa-regular fa-arrows-rotate" aria-hidden="true"></i>
</button>

<i class="fa-sharp fa-solid fa-star" aria-hidden="true"></i>

<!-- Angular attribute binding is also recognized -->
<i class="fa-sharp fa-regular fa-bell" [attr.aria-hidden]="true"></i>

<!-- <i> with no FA class is exempt (rare: emphasis markup in copy) -->
<i>italic emphasis</i>
```

### Detection — static and bound classes

The rule treats an `<i>` as "decorative Font Awesome icon" when any of
these class sources match `/\bfa-/`:

- Static `class="fa-sharp fa-regular fa-bell"`
- Bound `[ngClass]="{ 'fa-sharp fa-solid fa-star': cond }"`
- Bound `[ngClass]="cond ? 'fa-sharp fa-solid fa-star' : 'fa-sharp fa-regular fa-star'"`
- Bound `[class]="'fa-sharp fa-regular fa-cloud'"`

The bound-attribute scan reuses `extractClassStrings` from `../utils`
(same helper every showcase rule uses), so the detection stays consistent
as Angular's expression AST evolves.

### When to use `<span role="img">` instead

If the icon is the **only** signal and there's no adjacent text label,
don't use `<i>` at all. Use a labelled image element:

```html
<span role="img" aria-label="Bitcoin">
  <i class="fa-brands fa-bitcoin" aria-hidden="true"></i>
</span>
```

The outer `<span>` carries the accessible name; the inner `<i>` stays
decorative. This is the pattern used for crypto-symbol badges in
`overview.component.html`.

## When not to use

Never. If an icon is meaningful enough to not be `aria-hidden`, use a
`role="img"` wrapper with an explicit `aria-label` — don't just drop
`aria-hidden` and hope the screen reader does something sensible with a
Private Use Area codepoint.

## Related

- [`showcase/no-bare-fa-without-sharp`](./no-bare-fa-without-sharp.md)
- [`showcase/no-duotone-inline-icon`](./no-duotone-inline-icon.md)
- [Font Awesome accessibility docs](https://fontawesome.com/docs/web/dig-deeper/accessibility)
- CLAUDE.md §Iconos
