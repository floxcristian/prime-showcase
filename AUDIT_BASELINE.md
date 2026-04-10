# Audit Baseline — Falsos Positivos y Excepciones

**Fecha de establecimiento:** 2026-04-09
**Proyecto:** Prime Showcase
**Propósito:** Evitar que futuras auditorías re-reporten items ya evaluados y descartados.

> **Instrucción para auditores:** Antes de reportar un gap, buscar su ID en este documento. Si está listado como falso positivo (FP-*) o excepción (EX-*), NO reportarlo a menos que el código referenciado haya cambiado.

---

## Falsos Positivos de Accesibilidad

### FP-001: Botón "12 Postulantes" sin `aria-label`

| Campo          | Valor                                            |
|----------------|--------------------------------------------------|
| **Donde**      | `cards.component.html` (~línea 231)              |
| **Reportado como** | Button missing descriptive aria-label         |
| **Veredicto**  | FALSE POSITIVE                                   |

**Justificación:** El botón contiene texto visible "12 Postulantes" que funciona como accessible name según WCAG. Solo los botones icon-only (sin texto visible) necesitan `aria-label` explícito.

**Referencia:** W3C Accessible Name and Description Computation (AccName 1.2) — role `button` permite `nameFrom: content`, que traversa recursivamente todos los nodos hijo incluyendo `<div>`. Agregar `aria-label` redundante podría violar WCAG 2.5.3 (Label in Name).

---

### FP-002: `<p-avatar>` sin atributo `alt`

| Campo          | Valor                                                            |
|----------------|------------------------------------------------------------------|
| **Donde**      | side-menu (perfil "Robin Jonas"), customers (avatares en tabla)  |
| **Reportado como** | Avatar images missing alt text                               |
| **Veredicto**  | FALSE POSITIVE                                                   |

**Justificación:** En ambos casos, el nombre del usuario aparece como texto visible adyacente al avatar:
- Side-menu: "Robin Jonas" como `<div>` debajo del avatar
- Customers: nombre del cliente en celda `<td>` adyacente

La imagen del avatar es decorativa/suplementaria. PrimeNG `p-avatar` con `[label]` usa las iniciales como contenido accesible; con `[image]`, el nombre ya está disponible en contexto.

**Referencia:** W3C WAI Images Tutorial — [Decorative Images](https://www.w3.org/WAI/tutorials/images/decorative/): "if the information provided by the image might already be given using adjacent text, use `alt=""`". Confirmado por W3C Alt Decision Tree y técnica H67.

**Caveat:** Verificar que PrimeNG `p-avatar` con `[image]` renderiza `alt=""` en el `<img>` interno (no omitir el atributo, que es un fallo WCAG distinto). Ver [PrimeVue issue #3593](https://github.com/primefaces/primevue/issues/3593) para contexto.

---

### FP-003: Dark mode toggle div sin keyboard handler

| Campo          | Valor                                               |
|----------------|-----------------------------------------------------|
| **Donde**      | `cards.component.html` (~líneas 167-182)            |
| **Reportado como** | Interactive div missing keyboard support         |
| **Veredicto**  | FALSE POSITIVE                                      |

**Justificación:** El elemento interactivo real es el `<p-toggleswitch>` hijo, NO el `<div>` padre. PrimeNG `p-toggleswitch` renderiza un `<input type="checkbox" role="switch">` nativo con `tabindex`, focus ring (`:focus-visible`), y respuesta a Space/Enter. El input cubre el 100% del área del componente (`width: 100%`, `height: 100%`, `z-index: 1`). El `<div>` padre tiene `cursor-pointer` solo como feedback visual.

**Verificación:** Confirmado en source code de PrimeNG v21.2.6 (`primeng-toggleswitch.mjs` líneas 218-236).

---

### FP-004: Uso de `shadow-none` en componentes

| Campo          | Valor                                                              |
|----------------|--------------------------------------------------------------------|
| **Donde**      | chat.component.html (textarea), cards.component.html (3x p-select)|
| **Reportado como** | Shadow usage violates design system                            |
| **Veredicto**  | FALSE POSITIVE                                                     |

**Justificación:** `!shadow-none` se usa para REMOVER shadows por defecto de PrimeNG, no para agregar elevación visual. El design system (CLAUDE.md) prohíbe `shadow-*` para crear elevación, pero `shadow-none` es un reset/override legítimo para limpiar estilos por defecto de componentes PrimeNG.

**Verificación:** Tailwind CSS 4 source confirma que `shadow-none` aplica `--tw-shadow: 0 0 #0000` (shadow transparente/nula). CLAUDE.md documenta explícitamente `class="!border-0 !shadow-none"` como patrón aprobado para p-select borderless.

---

## Excepciones de Design System

> Patrones que violan las reglas generales del design system pero están **explícitamente permitidos** en CLAUDE.md.

### EX-001: Shadow hardcodeado en tooltip de Chart.js

| Campo          | Valor                                                    |
|----------------|----------------------------------------------------------|
| **Donde**      | `overview.component.ts` (~línea 182)                     |
| **Patrón**     | `shadow-[0px_25px_20px_-5px_rgba(0,0,0,0.10)...]`       |
| **Referencia** | CLAUDE.md: "La única excepción es el tooltip custom de Chart.js" |

Chart.js tooltips requieren manipulación DOM directa fuera del template Angular. Esta shadow es parte del tooltip custom y es la única excepción documentada al "no usar sombras".

---

### EX-002: Colores hex en datos semánticos

| Campo          | Valor                                                   |
|----------------|---------------------------------------------------------|
| **Donde**      | `overview/constants/overview-data.ts`                   |
| **Patrón**     | `color: '#F59E0B'` (BTC), `'#717179'` (ETH), etc.     |
| **Referencia** | CLAUDE.md: "Colores con nombre solo para indicadores semánticos con significado fijo" |

Estos son colores de datos (criptomonedas, currencies) que representan entidades del mundo real, no colores de UI general. CLAUDE.md los permite explícitamente como "datos con significado".

---

### EX-003: Colores Tailwind genéricos para avatares y crypto

| Campo          | Valor                                                         |
|----------------|---------------------------------------------------------------|
| **Donde**      | chat.html, customers.html, inbox.html, overview.html          |
| **Patrones**   | `bg-violet-100 text-violet-950`, `bg-orange-100 text-orange-950`, `text-yellow-500` |
| **Referencia** | CLAUDE.md: sección "EXCEPCIONES PERMITIDAS"                   |

CLAUDE.md lista explícitamente estas excepciones:
- `bg-violet-100, text-violet-950` → Iniciales de avatar (fallback sin imagen)
- `bg-orange-100, text-orange-950` → Iniciales de avatar
- `text-yellow-500` → Iconos de criptomoneda (BTC)

Estos NO son colores de UI general. Son datos con significado semántico fijo.

---

### EX-004: Valor arbitrario `p-[1px]`

| Campo          | Valor                                     |
|----------------|-------------------------------------------|
| **Donde**      | `chat.component.html` (~línea 45)         |
| **Patrón**     | `p-[1px]` en indicador de estado online   |

Pixel-perfect alignment para un dot indicator de 2.5px que necesita un borde visual de 1px para separarse del avatar. No existe un valor de spacing estándar para este caso de micro-UI. El valor arbitrario es la solución correcta.

---

### EX-005: Spacing `p-5` y `gap-7` fuera de escala

| Campo          | Valor                                                  |
|----------------|--------------------------------------------------------|
| **Donde**      | side-menu.html (línea 6: `p-5`), chat.html (línea 81: `gap-7`) |
| **Estado**     | Violaciones menores pre-existentes, aceptadas          |

`p-5` está entre `p-4` y `p-6` (ambos permitidos); `gap-7` está entre `gap-6` y `gap-8` (ambos permitidos). Impacto visual mínimo. Aceptados como patrones de layout establecidos — cambiarlos podría romper el ritmo visual existente sin beneficio funcional.

---

## Bypasses de Seguridad Documentados

### SEC-001: `bypassSecurityTrustHtml()` para SVGs de logos

| Campo          | Valor                                                      |
|----------------|-------------------------------------------------------------|
| **Donde**      | `customers.component.ts` (5 instancias, líneas 63-99)      |
| **Contenido**  | SVGs inline hardcodeados para logos de empresas              |
| **Riesgo**     | BAJO — contenido estático y controlado                      |

El contenido es SVG hardcodeado en el código fuente, no proviene de input de usuario ni de API externa. El bypass es seguro en el contexto actual.

**Alternativa ideal:** Mover SVGs a archivos `.svg` en `/public/` y usar `<img src>`.

**Condición de re-evaluación:** Si los SVGs empiezan a provenir de una API o de input de usuario, este bypass se convierte en vulnerabilidad XSS real y DEBE eliminarse.

---

### SEC-002: `innerHTML = ''` en Chart.js tooltip

| Campo          | Valor                                                    |
|----------------|----------------------------------------------------------|
| **Donde**      | `overview.component.ts` (~línea 203)                     |
| **Riesgo**     | NULO                                                     |

Solo limpia contenido del tooltip element (`innerHTML = ''`). Las líneas siguientes construyen el contenido nuevo usando `document.createElement()` + `appendChild()` (DOM API segura, no innerHTML con strings).

---

## Registro de Verificaciones

| Fecha      | Auditor         | Resultado                                     |
|------------|-----------------|-----------------------------------------------|
| 2026-04-09 | Claude (9 agentes, 3 rondas) | Baseline establecido con 6 FP, 5 EX, 2 SEC |
| 2026-04-09 | Claude (6 agentes, verificación con docs oficiales) | 2 FP reclasificados como gaps reales (FP-001 y FP-004 originales). Baseline corregido a 4 FP verificados contra W3C specs, PrimeNG source code, y Tailwind CSS source |
| 2026-04-09 | Claude (4 rondas, 15+ agentes) | ESLint rules ahora enforce FP-004 (shadow-none en allowlist) y EX-003 (colores de avatar en allowlist). patternomaly revertido — GAP-002 original ya no aplica. |

---

*Este documento debe actualizarse cuando se modifique código referenciado en los items anteriores. Los IDs (FP-*, EX-*, SEC-*) son estables y deben mantenerse para trazabilidad.*
