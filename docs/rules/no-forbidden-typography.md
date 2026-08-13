# showcase/no-forbidden-typography

Enforces the typography scale: text size, leading, and font-weight values
outside the approved sets are flagged, along with arbitrary values
(`text-[18px]`).

## Why

The type system is deliberately narrow (DESIGN.md § Typography): 16px chrome,
`text-xs` for metadata, `text-xl`–`text-3xl` for headings, weights
normal/medium/semibold/bold. Off-scale sizes (`text-4xl+` as copy),
`leading-snug`/`leading-relaxed`, and `font-black`/`font-extrabold` break the
approved combinations.

## Rule details

### Forbidden

```html
<div class="text-5xl">Título</div>          <!-- outside product scale -->
<div class="leading-relaxed"></div>
<div class="font-extrabold"></div>
<div class="text-[18px]"></div>
```

### Allowed

```html
<div class="text-3xl font-bold leading-normal">Hero</div>
<div class="text-2xl font-medium leading-8">Sección</div>
<div class="text-xs font-medium">Badge</div>
<i class="fa-sharp-duotone fa-regular fa-cloud text-4xl"></i> <!-- icon/stat exception -->
```

Documented exception: `text-5xl`/`text-6xl` on the login marketing bento grid
(AUDIT_BASELINE.md EX-007) is registered in the rule's allow-list.

## Related

- DESIGN.md § Typography — "Combinaciones aprobadas"
- [`text-3xl-requires-bold`](./text-3xl-requires-bold.md)
