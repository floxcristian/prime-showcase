# showcase/no-color-on-pbutton-icon

Forbids design-system color tokens, backgrounds, and state variants inside
the `icon="..."` string of `<p-button>` / `[pButton]`.

## Why

PrimeNG splats `icon` onto an internal `<i>` whose color is owned by the
button skin (`severity` / state selectors like `.p-button-text > .p-icon`),
with higher specificity than a Tailwind utility. A `text-muted-color` inside
`icon=` is dead code that misleads reviewers into thinking the tone is
load-bearing — the severity already paints it.

## Rule details

### Forbidden inside `icon=`

```html
<p-button icon="fa-sharp fa-regular fa-phone text-muted-color" />
<p-button icon="fa-sharp fa-regular fa-bell bg-surface-100" />
<p-button icon="fa-sharp fa-regular fa-bell hover:text-primary dark:text-color" />
```

### Allowed inside `icon=`

```html
<p-button icon="fa-sharp fa-regular fa-download" />
<p-button icon="fa-sharp fa-regular fa-bell text-xl" />          <!-- size is load-bearing -->
<p-button icon="fa-brands fa-bitcoin text-yellow-500" />          <!-- semantic exception colors CAN override -->
```

Color for the icon comes from the button's `severity` / variant — style the
BUTTON, not the icon string.

## Related

- DESIGN.md § Colors — Excepciones permitidas
- `.claude/rules/primeng-patterns.md` — Botones
