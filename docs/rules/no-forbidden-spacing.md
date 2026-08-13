# showcase/no-forbidden-spacing

Enforces the spacing scale (gap / padding / margin) as an **allow-list**: any
value outside the approved scale is flagged, including arbitrary values
(`gap-[13px]`).

## Why

Spacing consistency is the backbone of the "calm density" atmosphere
(DESIGN.md § Layout). The rule was originally a deny-list of known-bad values,
which silently admitted anything not enumerated (`gap-13`, `p-32`, `m-40`).
The allow-list inverts the default: new steps must be consciously added.

## Rule details

Allowed values per family:

| Family | Values |
|---|---|
| `gap`, `gap-x`, `gap-y` | 0, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 8 |
| `p`, `px`, `py`, `pt/pr/pb/pl`, `ps/pe` | 0, 0.5, 1, 1.5, 2, 3, 3.5, 4, 5, 6 |
| `m`, `mx`, `my`, `mt/mr/mb/ml`, `ms/me` | 0, 0.5, 1, 2, 4, 6 |

Full-class exceptions (AUDIT_BASELINE.md EX-004/005/006 + pre-existing
patterns): `gap-7`, `px-7`, `py-8`, `px-12`, `p-[1px]`, `mt-3`, `mt-5`,
`mb-5`, `mt-10`.

### Forbidden

```html
<div class="gap-9"></div>
<div class="p-8"></div>
<div class="m-3"></div>
<div class="gap-13 p-32 m-40"></div>   <!-- caught by the allow-list -->
<div class="gap-[13px]"></div>          <!-- arbitrary -->
```

### Allowed

```html
<div class="gap-2 p-4 mt-6"></div>
<div class="py-5 px-7"></div>           <!-- expanded card header -->
<div class="-mx-2 !p-0 mt-0.5"></div>   <!-- negative/important/fractional of allowed values -->
```

## Related

- DESIGN.md § Layout — "Spacing — escala permitida"
- AUDIT_BASELINE.md EX-004, EX-005, EX-006
