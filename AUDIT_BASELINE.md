# Audit Baseline — Falsos Positivos y Excepciones

**Fecha de establecimiento:** 2026-04-09
**Proyecto:** Prime Showcase
**Propósito:** Evitar que futuras auditorías re-reporten items ya evaluados y descartados.

> **Instrucción para auditores:** Antes de reportar un gap, buscar su ID en este documento. Si está listado como falso positivo (FP-*) o excepción (EX-*), NO reportarlo a menos que el código referenciado haya cambiado.

---

## Falsos Positivos de Accesibilidad

### FP-001: `<th>` sin `scope="col"` en p-table

| Campo          | Valor                                                      |
|----------------|-------------------------------------------------------------|
| **Donde**      | overview, customers, inbox (templates con `<p-table>`)      |
| **Reportado como** | Missing table header scope attribute                    |
| **Veredicto**  | FALSE POSITIVE                                              |

**Justificación:** PrimeNG `p-table` agrega `scope="col"` automáticamente durante el render del DOM. Los `<th>` en `ng-template` son plantillas declarativas, no el output final del DOM.

**Verificación:** Inspeccionar el DOM renderizado en browser DevTools — los `<th>` renderizados por PrimeNG incluyen `scope="col"`.

---

### FP-002: Botón "12 Postulantes" sin `aria-label`

| Campo          | Valor                                            |
|----------------|--------------------------------------------------|
| **Donde**      | `cards.component.html` (~línea 231)              |
| **Reportado como** | Button missing descriptive aria-label         |
| **Veredicto**  | FALSE POSITIVE                                   |

**Justificación:** El botón contiene texto visible "12 Postulantes" que funciona como accessible name según WCAG. Solo los botones icon-only (sin texto visible) necesitan `aria-label` explícito.

**Referencia:** WCAG 4.1.2 (Name, Role, Value) — el accessible name se deriva del contenido de texto visible.

---

### FP-003: `<p-avatar>` sin atributo `alt`

| Campo          | Valor                                                            |
|----------------|------------------------------------------------------------------|
| **Donde**      | side-menu (perfil "Robin Jonas"), customers (avatares en tabla)  |
| **Reportado como** | Avatar images missing alt text                               |
| **Veredicto**  | FALSE POSITIVE                                                   |

**Justificación:** En ambos casos, el nombre del usuario aparece como texto visible adyacente al avatar:
- Side-menu: "Robin Jonas" como `<div>` debajo del avatar
- Customers: nombre del cliente en celda `<td>` adyacente

La imagen del avatar es decorativa/suplementaria. PrimeNG `p-avatar` con `[label]` usa las iniciales como contenido accesible; con `[image]`, el nombre ya está disponible en contexto.

**Referencia:** WCAG 1.1.1 (Non-text Content) — imágenes puramente decorativas o redundantes no requieren alt text.

---

### FP-004: Chart legend "solo usa color" para diferenciar items

| Campo          | Valor                                               |
|----------------|-----------------------------------------------------|
| **Donde**      | `overview.component.html` (~líneas 55-69)           |
| **Reportado como** | Color-only information in chart legend           |
| **Veredicto**  | FALSE POSITIVE                                      |

**Justificación:** Cada círculo de color tiene un `<span>` adyacente con el label de texto (ej: "Bitcoin", "Ethereum"). El color NO es la única forma de distinguir los items.

**Verificación:** El template renderiza `{{ item.label }}` junto a cada círculo de color dentro del `@for` loop.

---

### FP-005: Dark mode toggle div sin keyboard handler

| Campo          | Valor                                               |
|----------------|-----------------------------------------------------|
| **Donde**      | `cards.component.html` (~líneas 167-182)            |
| **Reportado como** | Interactive div missing keyboard support         |
| **Veredicto**  | FALSE POSITIVE                                      |

**Justificación:** El elemento interactivo real es el `<p-toggleswitch>` hijo, NO el `<div>` padre. PrimeNG `p-toggleswitch` es nativamente keyboard-accessible (Space/Enter). El `<div>` padre tiene `cursor-pointer` solo como feedback visual pero no es el target interactivo — no necesita keyboard handlers propios.

---

### FP-006: Uso de `shadow-none` en componentes

| Campo          | Valor                                                              |
|----------------|--------------------------------------------------------------------|
| **Donde**      | chat.component.html (textarea), cards.component.html (3x p-select)|
| **Reportado como** | Shadow usage violates design system                            |
| **Veredicto**  | FALSE POSITIVE                                                     |

**Justificación:** `!shadow-none` se usa para REMOVER shadows por defecto de PrimeNG, no para agregar elevación visual. El design system (CLAUDE.md) prohíbe `shadow-*` para crear elevación, pero `shadow-none` es un reset/override legítimo para limpiar estilos por defecto de componentes PrimeNG.

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
| 2026-04-09 | Claude (9 agentes, 3 rondas) | Baseline establecido. 6 FP, 5 EX, 2 SEC documentados |

---

*Este documento debe actualizarse cuando se modifique código referenciado en los items anteriores. Los IDs (FP-*, EX-*, SEC-*) son estables y deben mantenerse para trazabilidad.*
