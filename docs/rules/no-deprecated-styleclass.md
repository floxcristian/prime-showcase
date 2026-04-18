# showcase/no-deprecated-styleclass

Forbids `styleClass` / `[styleClass]` on PrimeNG component selectors where
PrimeNG v20 deprecated the input in favor of `class`.

## Why

PrimeNG v20 introduced a host-binding directive (`primeng/Bind`) that
forwards the host `class` attribute onto the component's internal
rendered root. Before v20 the only way to target that internal root was
the component-specific `styleClass` input; after v20 `styleClass` is
redundant with `class` and the PrimeNG type definitions mark it as:

```ts
/**
 * @deprecated since v20.0.0, use `class` instead.
 */
styleClass: string | undefined;
```

A showcase repo should track the framework's public API, not parallel
legacy shapes — otherwise deprecation warnings leak into the IDE and the
codebase drifts from current docs. This rule enforces the migration.

Rationale: PrimeNG v20 changelog, PrimeNG type definitions
(`node_modules/primeng/types/primeng-*.d.ts`).

## Rule details

### Forbidden

`styleClass` as a static attribute or `[styleClass]` as a bound attribute
on any component selector in the deprecation list:

```html
<p-avatar styleClass="rounded-lg overflow-hidden flex" />
<p-tag [styleClass]="cond ? 'a' : 'b'" />
<p-skeleton styleClass="mb-2" />
<p-progressbar [styleClass]="'bg-primary'" />
<p-paginator styleClass="!bg-transparent" />
<p-table [styleClass]="...' />
```

### Allowed

The v20+ idiomatic replacement — `class`, `[class]`, `[ngClass]`:

```html
<p-avatar class="rounded-lg overflow-hidden flex" />
<p-tag [ngClass]="cond ? 'a' : 'b'" />
<p-skeleton class="mb-2" />
<p-progressbar [class]="'bg-primary'" />
```

### Still allowed — sub-element `*StyleClass` inputs

`*StyleClass` variants target **internal sub-elements**, not the host,
and have no `class` equivalent. They remain the public API:

```html
<p-table paginatorStyleClass="!bg-transparent" />
<p-progressbar valueStyleClass="!bg-surface-0 !rounded-full" />
<p-carousel contentStyleClass="flex gap-4" />
```

These are `paginatorStyleClass`, `valueStyleClass`, `panelStyleClass`,
`contentStyleClass`, `headerStyleClass`, `footerStyleClass`,
`inputStyleClass`, `labelStyleClass`. The rule ignores all of them.

### Still allowed — overlay components

PrimeNG did **not** deprecate `styleClass` on components whose host
element doesn't render where the content lives — the overlays:

- `<p-drawer>`, `<p-dialog>`, `<p-popover>`, `<p-tooltip>`
- `<p-confirmdialog>`, `<p-confirmpopup>`, `<p-galleria>`, `<p-contextmenu>`
- `<p-menu>`, `<p-tieredmenu>`, `<p-menubar>`
- `<p-fileupload>`, `<p-inputotp>`, `<p-selectbutton>`, `<p-splitter>`,
  `<p-steps>`, `<p-breadcrumb>`, `<p-scrolltop>`, `<p-fieldset>`,
  `<p-message>`, `<p-overlaybadge>`, `<p-inputmask>`, `<p-picklist>`,
  `<p-inputgroupaddon>`, `<p-avatargroup>`
- `<p-button>` (styleClass still the official API at v21)

For those components the host element is the overlay wrapper or host
directive target, and the component exposes `styleClass` as the public
theming input. The rule does not flag them.

The full in-scope set lives in `tools/eslint/rules/no-deprecated-styleclass.js`
as `DEPRECATED_STYLECLASS_ELEMENTS`. Keep it in sync with PrimeNG type defs.

## Migration

Mechanical substitution:

```diff
- <p-avatar styleClass="rounded-lg" />
+ <p-avatar class="rounded-lg" />

- <p-tag [styleClass]="cond ? 'a' : 'b'" />
+ <p-tag [ngClass]="cond ? 'a' : 'b'" />

- <p-skeleton [styleClass]="baseClass" />
+ <p-skeleton [class]="baseClass" />
```

No autofix is provided because the static / bound choice depends on the
source expression, and semantics (static `class` vs `[class]` vs
`[ngClass]`) can subtly differ for list-manipulation forms. The fix is
always manual but mechanical.

## Maintaining the deprecation list

When PrimeNG deprecates `styleClass` on a new component (or removes the
annotation from an existing one), update
`DEPRECATED_STYLECLASS_ELEMENTS` in the rule file. The canonical source is:

```bash
grep -B6 "^    styleClass:" node_modules/primeng/types/primeng-*.d.ts \
  | grep -B1 "@deprecated since v20.0.0, use \`class\`"
```

The test file `tools/eslint/rules/__tests__/no-deprecated-styleclass.test.js`
exports the set for assertion.

## When not to use

Never. Deprecated APIs are a liability: they generate IDE warnings, drift
from docs, and become removed in major versions. Keep the codebase on the
current public surface.

## Related

- PrimeNG v20 changelog — `Bind` directive introduction
- CLAUDE.md §Componentes: Siempre PrimeNG primero
