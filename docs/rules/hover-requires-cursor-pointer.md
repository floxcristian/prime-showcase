# showcase/hover-requires-cursor-pointer

Requires `cursor-pointer` and `hover:*` classes to appear together on plain HTML
elements. Reports in both directions: a `cursor-pointer` with no hover feedback is
just as wrong as a `hover:*` with no pointer cursor.

## Why

Interactivity requires two signals:

- **Affordance** — the cursor visually communicates clickability (`cursor-pointer`)
- **Feedback** — the element responds to hover so the user knows it's alive (`hover:*`)

Missing either one is a UX bug. A `cursor-pointer` without hover leaves users
hovering over an element that *looks* clickable but gives zero response. A
`hover:*` without `cursor-pointer` shows a hover state, but users don't know to
click because the cursor doesn't change.

CLAUDE.md §Estados interactivos is explicit: every `cursor-pointer` must have a
matching `hover:*`. This rule enforces it bidirectionally.

## Rule details

### Valid

```html
<div class="cursor-pointer hover:bg-emphasis">        <!-- both present -->
<button class="cursor-pointer hover:opacity-70">      <!-- plain <button> -->
<p-button></p-button>                                  <!-- PrimeNG exempt -->
<p-select class="hover:bg-emphasis"></p-select>       <!-- PrimeNG exempt -->
<button pButton label="OK"></button>                  <!-- pButton directive exempt -->
<div class="flex items-center gap-2">                 <!-- neither — nothing to check -->
```

### Invalid

```html
<div class="cursor-pointer"></div>                <!-- cursor without hover -->
<div class="hover:bg-emphasis"></div>              <!-- hover without cursor -->
<button class="cursor-pointer flex"></button>     <!-- same -->
```

### PrimeNG exemption

`<p-*>` components and any element with the `pButton` directive are exempt.
PrimeNG's Aura theme supplies hover feedback and the pointer cursor via its
own styles; adding Tailwind equivalents is redundant and can conflict.

### `group-hover:` / `peer-hover:` are NOT triggers

The rule only considers `hover:*` on the element itself. `group-hover:` and
`peer-hover:` are state-propagation utilities — the hover happens on a parent
(`.group`) or sibling (`.peer`), which is where `cursor-pointer` belongs.

```html
<!-- Valid — child uses group-hover, parent carries cursor-pointer -->
<div class="group cursor-pointer hover:bg-emphasis">
  <span class="group-hover:text-primary">Label</span>
</div>
```

A previous version of this rule matched `hover:` with `\bhover:`, which caught
`group-hover:` and `peer-hover:` as false positives. The current pattern uses
a negative lookbehind `(?<![\w-])` to exclude them.

### `routerLinkActive` IS scanned

`routerLinkActive` accepts a space-separated class list that Angular applies
when the associated link is active. Classes in that list are real classes with
the same design-system constraints as `class`, so this rule scans them too.

```html
<a class="cursor-pointer" routerLinkActive="bg-primary hover:bg-primary-emphasis">
```

## Suggestions

**When `cursor-pointer` is present without `hover:*`** — three suggestions:

1. **Add hover:bg-emphasis** — for containers, cards, rows
2. **Add hover:opacity-70** — for images, avatars
3. **Add hover:text-muted-color-emphasis** — for text, links

**When `hover:*` is present without `cursor-pointer`** — one suggestion:

1. **Add cursor-pointer**

Suggestions append to the existing static `class="..."` attribute when present,
or add a new `class` attribute to the opening tag.

## Related

- [`showcase/no-forbidden-transitions`](./no-forbidden-transitions.md)
- CLAUDE.md §Estados interactivos
- CLAUDE.md §Elementos interactivos: acción vs navegación
