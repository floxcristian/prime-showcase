# showcase/no-icon-button-without-tooltip

Requires `pTooltip` on icon-only PrimeNG buttons — `<p-button>` and
`<button pButton>` — either on the button itself or on a wrapping ancestor.

## Why

An icon-only button is visually ambiguous. `aria-label` covers screen
readers; `pTooltip` covers sighted mouse/keyboard users (GitHub / Linear /
Figma standard). The wrapper form (`<span pTooltip>` around the button) is
accepted because a `[loading]`/disabled button gets `pointer-events: none`
and its own tooltip listener stops firing — the canonical Material UI /
Mantine / Radix workaround.

## Rule details

A button is exempt when it has a `label` attribute, non-empty projected
TEXT content (including `{{ interpolation }}`), its own `pTooltip`, or any
ancestor with `pTooltip`. A lone projected `<i>` icon does NOT count as text.

### Forbidden

```html
<p-button icon="fa-sharp fa-regular fa-bell" />
<p-button icon="fa-sharp fa-regular fa-bell" ariaLabel="Notificaciones" />
<button pButton type="button" icon="fa-sharp fa-regular fa-bell"></button>
<p-button><i class="fa-sharp fa-regular fa-bell"></i></p-button>
```

### Allowed

```html
<p-button icon="fa-sharp fa-regular fa-bell" ariaLabel="Notificaciones" pTooltip="Notificaciones" />
<p-button label="Guardar" />
<p-button icon="fa-sharp fa-regular fa-download">Descargar</p-button>  <!-- projected text -->
<span pTooltip="Refrescar"><p-button icon="fa-sharp fa-regular fa-arrows-rotate" [loading]="busy()" /></span>
```

## Related

- DESIGN.md § Accessibility — "Iconos decorativos vs informativos"
- `.claude/rules/primeng-patterns.md` — "Icon-only buttons"
