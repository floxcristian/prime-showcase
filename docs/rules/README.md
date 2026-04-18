# showcase ESLint rules

Local ESLint rules that enforce the PrimeNG Showcase design system in Angular
templates. All rules run under the `showcase/` namespace and fire at `error`
severity on `**/*.html`.

Rules scan the following attributes as class lists:

- Static: `class`, `styleClass`, `*StyleClass` (all PrimeNG variants),
  `routerLinkActive`
- Bound: `[ngClass]`, `[class]`, `[styleClass]`, `[*StyleClass]` —
  object-literal keys, ternary branches, and string-concatenation branches

## Rule index

| Rule | What it prevents |
|---|---|
| [`no-hardcoded-colors`](./no-hardcoded-colors.md) | Generic Tailwind colors (`text-gray-500`, `bg-blue-100`), `text-white`/`bg-black`, arbitrary hex (`bg-[#fff]`), arbitrary CSS color functions |
| [`no-shadow-classes`](./no-shadow-classes.md) | `shadow-*` and `drop-shadow-*` — use `border border-surface` for elevation |
| [`no-forbidden-rounded`](./no-forbidden-rounded.md) | `rounded`, `rounded-sm`, `rounded-md`, `rounded-none`, `rounded-[*]` — only `rounded-full`/`lg`/`xl`/`2xl`/`3xl` allowed |
| [`no-inline-styles`](./no-inline-styles.md) | Static `style="..."` — use Tailwind classes or `[style.*]` for dynamic values |
| [`no-forbidden-spacing`](./no-forbidden-spacing.md) | Off-scale spacing (`gap-7`, `p-8`, `m-3`, arbitrary values like `gap-[13px]`) |
| [`no-missing-dark-pair`](./no-missing-dark-pair.md) | `bg-surface-*` light shades without a matching `dark:bg-surface-*` pair |
| [`no-forbidden-typography`](./no-forbidden-typography.md) | Off-scale text size / leading / font-weight |
| [`no-icon-button-without-tooltip`](./no-icon-button-without-tooltip.md) | Icon-only `<p-button>` without `pTooltip` (accessibility) |
| [`no-forbidden-transitions`](./no-forbidden-transitions.md) | `transition-all`, bare `transition`, arbitrary transitions with forbidden properties |
| [`hover-requires-cursor-pointer`](./hover-requires-cursor-pointer.md) | `cursor-pointer` without `hover:*`, or `hover:*` without `cursor-pointer` |
| [`no-bare-fa-without-sharp`](./no-bare-fa-without-sharp.md) | `fa-regular`/`fa-solid`/`fa-light`/`fa-duotone` without the `fa-sharp` or `fa-sharp-duotone` prefix the project actually loads |
| [`no-button-without-type`](./no-button-without-type.md) | Plain `<button>` without `type="button"` (accidental form submission) |
| [`no-duotone-inline-icon`](./no-duotone-inline-icon.md) | `fa-sharp-duotone` outside hero scale (`text-4xl`+) — keeps UI-chrome icons on a single family |
| [`no-decorative-icon-without-aria-hidden`](./no-decorative-icon-without-aria-hidden.md) | `<i>` Font Awesome icon missing `aria-hidden="true"` (screen-reader leakage) |
| [`no-deprecated-styleclass`](./no-deprecated-styleclass.md) | `styleClass` on PrimeNG components deprecated since v20 — use `class` instead |

All rules ship at severity **error**.

## Running

```bash
npm run lint              # run all rules
npm run lint:fix          # apply autofixes (most showcase rules have no fixes,
                          #  but suggestions fix via editor)
npm run lint:rules:test   # run RuleTester unit tests for showcase rules
```

## Contributing a new rule

1. Create `tools/eslint/rules/<name>.js` using the existing rules as a template.
   Most rules use `createClassAttrVisitor` from `../utils` to get class-string
   iteration and per-match `loc` for free.
2. Set `meta.docs.url` to `../../docs/rules/<name>.md`.
3. Set `meta.schema: []` explicitly, even when no options.
4. Use `meta.messages` + `messageId` in `context.report` — never inline strings.
5. If the rule can offer fixes, set `meta.hasSuggestions: true` and provide
   `suggest: [...]` in reports.
6. Register in `tools/eslint/plugin.js` and enable in `eslint.config.js`.
7. Add RuleTester tests in `tools/eslint/rules/__tests__/<name>.test.js`.
8. Write a per-rule doc in `docs/rules/<name>.md` and link it from this index.

## Per-match loc

`createClassAttrVisitor` provides a `ctx` object with a `ctx.report(match, messageId,
data?, extras?)` helper. For static attributes (`class="..."`), it computes a
precise source range pointing at the offending token — not the whole attribute.
Bound attributes (`[ngClass]`) use attribute-level loc because mapping AST
literals back to source offsets is fragile.
