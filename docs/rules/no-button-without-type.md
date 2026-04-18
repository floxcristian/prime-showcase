# showcase/no-button-without-type

Requires every plain `<button>` element to declare an explicit `type`
attribute (`button`, `submit`, or `reset`).

## Why

HTML defaults a `<button>` inside a `<form>` to `type="submit"`. A button
meant for a side-effect (open a menu, toggle state, trigger a popover)
without `type` will **submit the form when clicked** — a classic silent
bug that's hard to reproduce until it happens in production:

```html
<form>
  <input name="email" />
  <button (click)="togglePopover()">…</button>   <!-- ❌ submits the form -->
</form>
```

GitHub, Linear, Stripe all enforce explicit button types in their
lint configs for the same reason. The fix is always a single attribute
and has zero runtime cost.

Rationale: HTML spec §4.10.6 (`button` element), CLAUDE.md
§Elementos interactivos.

## Rule details

### Forbidden

```html
<button (click)="action()">…</button>
<button class="flex">…</button>
<button [attr.aria-label]="'Close'">×</button>
```

### Allowed

```html
<button type="button" (click)="action()">…</button>  <!-- explicit -->
<button type="submit">Save</button>                   <!-- form-submit -->
<button type="reset">Reset</button>                   <!-- form-reset -->
<button [attr.type]="isSubmit ? 'submit' : 'button'">…</button>  <!-- bound -->
<button pButton label="OK"></button>                  <!-- pButton exempt -->
<p-button label="OK" />                               <!-- <p-button> exempt -->
```

### pButton / `<p-button>` exemption

Both `[pButton]` directive applications and the `<p-button>` component are
exempt from this rule. PrimeNG renders its own button with `type="button"`
by default (you can override via `[type]` input). The internal `<button>`
element always has a type set.

## Auto-fix

This rule does not auto-fix. The correct value (`"button"`, `"submit"`, or
`"reset"`) depends on intent — rarely can a linter decide between them.
The fix is manual but mechanical: 99% of the time it's `type="button"`.

## When not to use

Never. The cost of the attribute is zero; the cost of an accidental form
submission is paid in debugging hours.

## Related

- [`showcase/no-icon-button-without-tooltip`](./no-icon-button-without-tooltip.md)
- CLAUDE.md §Elementos interactivos: acción vs navegación
