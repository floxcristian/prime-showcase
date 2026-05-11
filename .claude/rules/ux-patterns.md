---
paths:
  - "src/**/*.html"
  - "src/**/*.ts"
---

# UX patterns — feedback, vacíos y errores

Recetas de patrones UX que ningún ESLint atrapa porque son **decisiones de
producto**, no de código. Cubren los huecos que DESIGN.md deja por diseño:
qué mostrar cuando no hay datos, cómo hablarle al usuario cuando algo
falla, cuándo usar toast vs inline, cómo se ve un form en validación.

Cargado on-demand al editar `src/**`.

## Empty states

Patrón canónico: ícono decorativo + título + texto secundario + CTA opcional.

```html
<app-empty-state
  icon="fa-sharp-duotone fa-regular fa-inbox"
  title="Sin correos en tu bandeja"
  description="Cuando recibas un correo, aparecerá aquí."
>
  <p-button label="Redactar nuevo" outlined />
</app-empty-state>
```

Reglas:
- **Icono** — siempre `fa-sharp-duotone fa-regular text-4xl` (decorativo, hero size).
- **Título** — `text-2xl font-medium leading-8 text-color`.
- **Descripción** — `text-muted-color leading-6` (1–2 líneas máximo).
- **CTA** — secundaria por default (`outlined`). Solo primaria si la acción es la siguiente esperada (no opcional).
- **Centrado** — el contenedor padre da el centrado vertical/horizontal con `flex flex-col items-center justify-center`.

Cuándo aplicar:
- Lista sin datos al primer render (no después de filtrar).
- Drop zones de file upload.
- Zero-result de búsqueda — pero con texto distinto: "Sin resultados para `<query>`. Intentá otra búsqueda." + CTA "Limpiar filtros".

Cuándo NO aplicar:
- Estado de carga inicial — usar `<p-skeleton>` (ver `.claude/rules/ssr-and-runtime.md`).
- Error 500 / falla de red — usar el patrón de error abajo.
- Lista vacía POST-filtrado restrictivo — variante "sin resultados", no empty inicial.

## Error states

### Toast — feedback transitorio

```html
<p-toast position="bottom-right" />
```

```typescript
import { MessageService } from 'primeng/api';

private messages = inject(MessageService);

onSaveError(err: Error) {
  this.messages.add({
    severity: 'error',
    summary: 'No se pudo guardar',
    detail: 'Verificá tu conexión y volvé a intentar.',
    life: 5000,
  });
}
```

Reglas:
- **Posición** — `bottom-right` siempre. Coherente entre features.
- **`life`** — 5000ms (errors), 3000ms (success), 4000ms (info/warn). Siempre dismissable.
- **`summary`** — qué falló, en una línea. Empezar con verbo en pasado: "No se pudo guardar", "Falló la subida".
- **`detail`** — qué hacer al respecto. Accionable, no genérico ("Algo salió mal").
- **Severity** — `error` para fallos, `success` para confirmaciones, `info` para acks no críticos, `warn` para advertencias.

Cuándo aplicar:
- Resultado de una acción explícita del usuario (save, delete, upload).
- Notificación push entrante (mensaje, email).
- Feedback de operación background completada.

Cuándo NO aplicar:
- Validación inline de formulario — usar el patrón de validación abajo.
- Error que requiere acción inmediata para continuar — usar `p-confirmdialog`.
- Estado persistente de página rota — usar el bloque inline abajo.

### Bloque inline de error — feature/región rota

Cuando una sección entera no puede renderizar (ej. chart falla a cargar):

```html
@if (chartError()) {
  <div class="border border-surface rounded-2xl p-6 flex flex-col items-center text-center gap-3">
    <i class="fa-sharp-duotone fa-regular fa-triangle-exclamation text-4xl text-muted-color" aria-hidden="true"></i>
    <div class="text-color font-medium leading-6">No se pudo cargar el gráfico</div>
    <div class="text-muted-color leading-6 max-w-md">
      Verificá tu conexión. Si el problema persiste, contactá soporte.
    </div>
    <p-button label="Reintentar" outlined (onClick)="reload()" />
  </div>
}
```

Reglas:
- **Icono triangle-exclamation** sharp-duotone, `text-muted-color` (no rojo — el rojo se reserva para validación inline).
- **Mensaje accionable** — "Reintentar" como primary action, no "Cerrar" / "OK".
- **Mismo container** que el contenido que reemplaza — preserva layout, evita CLS.

### Validación inline de formulario

Aura aplica `--p-form-field-invalid-border-color: {rose.500}` automáticamente cuando el `[invalid]="true"`:

```html
<div class="flex flex-col gap-1">
  <label for="email" class="text-color font-semibold leading-6">Email</label>
  <input
    pInputText
    id="email"
    [(ngModel)]="email"
    [class.ng-invalid]="emailError()"
    [class.ng-dirty]="emailTouched()"
    aria-describedby="email-error"
  />
  @if (emailError()) {
    <small id="email-error" class="text-rose-500 dark:text-rose-400 leading-5" role="alert">
      {{ emailError() }}
    </small>
  }
</div>
```

Reglas:
- **Validación on-blur**, no on-keystroke. Marcar `dirty` solo después del primer blur.
- **Mensaje específico** — "Email inválido" → no. "Falta @ y dominio" → sí.
- **`role="alert"`** + `aria-describedby` para que screen readers anuncien.
- **Color** — `text-rose-500 dark:text-rose-400` (mismo token que Aura usa para invalidBorderColor; ya documentado en DESIGN.md `formField.invalidBorderColor`).

## Confirm dialogs — destructive actions

```html
<p-confirmdialog />
```

```typescript
import { ConfirmationService } from 'primeng/api';

private confirm = inject(ConfirmationService);

onDelete(item: Item) {
  this.confirm.confirm({
    header: 'Eliminar registro',
    message: `Vas a eliminar "${item.name}" y sus 12 dependencias. Esta acción no se puede deshacer.`,
    icon: 'fa-sharp fa-regular fa-triangle-exclamation',
    acceptLabel: 'Eliminar',
    acceptButtonStyleClass: 'p-button-danger',
    rejectLabel: 'Cancelar',
    rejectButtonStyleClass: 'p-button-text',
    accept: () => this.delete(item),
  });
}
```

Reglas de copy:
- **Header** — verbo + objeto: "Eliminar registro", "Cancelar suscripción". Nunca "¿Estás seguro?".
- **Message** — qué pasa exactamente, qué se pierde, si es reversible. Concreto: "se eliminarán 12 ítems vinculados", no "se perderán datos".
- **`acceptLabel`** — el verbo del header. Coincide. "Eliminar", "Cancelar suscripción". Nunca "Sí" / "OK".
- **`rejectLabel`** — siempre "Cancelar" (la acción de salirse del dialog, no de la operación).
- **`acceptButtonStyleClass`** — `p-button-danger` para destructive, `p-button-primary` para benign.

Cuándo aplicar:
- Borrar, archivar permanente, cancelar suscripción, salir sin guardar.
- Acciones bulk que afecten muchos ítems.
- Cualquier acción no reversible o costosa de revertir.

Cuándo NO aplicar:
- Acciones reversibles con un undo de 5s (preferir toast con botón "Deshacer").
- Acciones triviales (toggle, mark as read) — feedback visual basta.

## Loading states — beyond skeleton

### Botones submit con spinner

```html
<p-button
  label="Guardar"
  [loading]="saving()"
  [disabled]="saving() || form.invalid"
  (onClick)="save()"
/>
```

`[loading]` reemplaza el icono por un spinner y deshabilita el click. **Nunca** mostrar spinner externo — usar el built-in.

### Optimistic updates

Cuando la latencia de la operación es alta y la falla es rara:

```typescript
toggleBookmark(item: Item) {
  // Update optimistic
  this.items.update((list) =>
    list.map((i) => (i.id === item.id ? { ...i, bookmarked: !i.bookmarked } : i))
  );

  this.api.toggleBookmark(item.id).subscribe({
    error: (err) => {
      // Rollback + toast
      this.items.update((list) =>
        list.map((i) => (i.id === item.id ? { ...i, bookmarked: item.bookmarked } : i))
      );
      this.messages.add({ severity: 'error', summary: 'No se pudo guardar', life: 3000 });
    },
  });
}
```

Reglas:
- Solo en operaciones idempotentes (toggle, vote, like).
- Rollback siempre con toast informativo.
- **No** combinar con loading state — el cambio aparenta instant.

### Progress feedback

Operaciones largas y bloqueantes (file upload, bulk action):

```html
<p-progressbar [value]="progress()" />
<div class="text-muted-color text-sm leading-5 mt-1">
  {{ uploadedCount() }} de {{ totalCount() }} archivos subidos
</div>
```

## Form patterns

### Layout estándar

Documentado en DESIGN.md "Formularios dentro de cards". Reglas operativas adicionales:

- **Orden de campos** — del más identificatorio al más descriptivo (nombre → email → teléfono → dirección).
- **Required vs optional** — marcar **opcionales** con `(opcional)` al lado del label, no required con asterisco. Patrón Adam Silver / GOV.UK / Polaris.
- **Help text** — `<small class="text-muted-color leading-5">` debajo del input. Siempre antes del primer error.
- **Botones al final** — `Cancelar` (outlined) izquierda, primary derecha. En mobile: stacked (`flex-col`).

### Submit behavior

- **No** auto-submit en cambio de input. Siempre botón explícito.
- **Disabled hasta válido** — `[disabled]="form.invalid || saving()"`.
- **Success path** — toast `severity="success"` + redirect o reset (no ambos).
- **Error path** — focus al primer field con error después de submit fallido (a11y crítico).

```typescript
async onSubmit() {
  if (this.form.invalid) {
    // Focus primer error
    const firstError = document.querySelector('[aria-invalid="true"]') as HTMLElement;
    firstError?.focus();
    return;
  }
  // ... submit
}
```
