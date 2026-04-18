# showcase/no-bare-fa-without-sharp

Forbids Font Awesome icon classes that use a style token (`fa-regular`,
`fa-solid`, `fa-light`, `fa-thin`, `fa-duotone`) without the family prefix
the project actually loads (`fa-sharp` or `fa-sharp-duotone`).

## Why

The project self-hosts Font Awesome Pro 7 from `public/fontawesome/`, but
only loads the **Sharp** family CSS bundles (`sharp-regular.css`,
`sharp-solid.min.css`, `sharp-duotone-regular.css`) plus `brands.min.css`.
The classic (non-Sharp) family files are not loaded — nothing on disk, nothing
in `<head>`.

That means:

```html
<i class="fa-regular fa-magnifying-glass"></i>       <!-- ❌ renders empty box -->
<i class="fa-sharp fa-regular fa-magnifying-glass"></i>  <!-- ✅ renders the glyph -->
```

Without the `fa-sharp` prefix, Font Awesome's CSS maps the glyph to the
classic family, the matching `@font-face` isn't available, and the `<i>`
shows as a blank rectangle. This failure mode is silent in review (the HTML
looks right) and only appears in the browser.

The rule catches the missing prefix at lint time so the glyph always
resolves against a loaded face.

Rationale: CLAUDE.md §Iconos, §Sintaxis.

## Rule details

### Forbidden

```html
<i class="fa-regular fa-bell"></i>          <!-- missing fa-sharp -->
<i class="fa-solid fa-star"></i>            <!-- missing fa-sharp -->
<i class="fa-light fa-user"></i>            <!-- missing fa-sharp -->
<i class="fa-duotone fa-cloud"></i>         <!-- missing fa-sharp-duotone -->
<button pButton icon="fa-regular fa-download"></button>  <!-- same -->
```

### Allowed

```html
<i class="fa-sharp fa-regular fa-bell"></i>
<i class="fa-sharp fa-solid fa-star"></i>
<i class="fa-sharp-duotone fa-regular fa-cloud"></i>
<i class="fa-brands fa-bitcoin"></i>               <!-- brands are loaded -->
<i class="fa-sharp fa-regular text-lg"></i>        <!-- mixed with utility classes -->
```

### `fa-brands` exemption

`fa-brands` is exempt — it's a separate CSS bundle (`brands.min.css`) that
*is* loaded, and it uses the real brand glyphs (Bitcoin, Ethereum, GitHub,
Google). A `fa-brands` class without `fa-sharp` is valid because Sharp
Brands doesn't exist upstream.

## Scope

The rule scans every class source the utils visitor understands:

- Static: `class="..."`, `styleClass="..."`, `*StyleClass="..."`,
  `routerLinkActive="..."`
- Bound: `[ngClass]`, `[class]`, `[styleClass]`, `[*StyleClass]`
  (object-literal keys, ternary branches, string-concat branches)

The `icon="..."` input on `<p-button>` / `[pButton]` is **not** scanned —
it's a component input, not a class attribute. Keep icon strings on those
inputs consistent with this rule by code review, or move the class onto a
wrapped `<i>` child where lint coverage applies.

## When not to use

Never. The loaded face matrix is fixed by `angular.json` — changing that
alone produces a bundle size regression that's much worse than the cost of
typing the prefix. If a new face needs to load, add it to `angular.json`
*and* update this rule's allowlist in the same PR.

## Related

- [`showcase/no-duotone-inline-icon`](./no-duotone-inline-icon.md)
- [`showcase/no-decorative-icon-without-aria-hidden`](./no-decorative-icon-without-aria-hidden.md)
- CLAUDE.md §Iconos
