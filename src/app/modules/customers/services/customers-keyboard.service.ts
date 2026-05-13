import { isPlatformBrowser } from '@angular/common';
import { DestroyRef, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent } from 'rxjs';

/**
 * Shortcut declarativo registrado por componentes. Cada shortcut tiene
 * un key combination (e.g. "cmd+k", "?", "n", "j"), un handler, y un
 * label legible para el `?` help overlay.
 */
export interface KeyboardShortcut {
  /** Key combo en formato lower-case con `+` separator. Soporta
   * modificadores `cmd|ctrl|alt|shift` + single key. Semantics:
   *   - `cmd+X` — modificador "primary" del OS: ⌘ en Mac, Ctrl en
   *     Windows/Linux. Patrón VSCode / GitHub / Linear.
   *   - `ctrl+X` — Control LITERAL en todos los OS. Útil cuando el
   *     atajo debe matchear con el atajo nativo (ej: Ctrl+R refresh
   *     en navegadores).
   *   - `shift+?`, `alt+X` — modificadores literales sin cross-OS
   *     mapping.
   *
   * Ejemplos:
   *   - `cmd+k` — ⌘K en Mac, Ctrl+K en Windows/Linux.
   *   - `ctrl+enter` — Ctrl+Enter literal en TODOS los OS (incluído
   *     Mac, donde NO mapea a ⌘+Enter).
   *   - `j`, `k`, `enter`, `escape` — single keys.
   */
  combo: string;
  /** Label legible para el help overlay. */
  label: string;
  /** Sección/category para agrupar en el help overlay. */
  section: string;
  /** Handler async-friendly. Recibe el KeyboardEvent por si necesita
   * preventDefault custom o lectura de target. */
  handler: (event: KeyboardEvent) => void;
  /** Si true, el shortcut se ignora cuando el foco está en un input/
   * textarea/contenteditable. Default true — bigtech (Linear, Notion,
   * Stripe) siempre disable shortcuts en input context para no
   * interferir con typing. `j` en un input es texto, no nav. */
  ignoreInInputs?: boolean;
}

/**
 * Modificadores siempre-activos en input context. Estos shortcuts
 * funcionan incluso con foco en `<input>` / `<textarea>` porque su
 * intención es global (abrir search/help). Patrón Linear/Notion/
 * Stripe/Slack: ⌘K abre command palette desde cualquier campo, y
 * `?` el help overlay.
 */
const ALWAYS_ON_COMBOS: ReadonlySet<string> = new Set(['cmd+k', '?']);

/**
 * Service global de keyboard shortcuts para el módulo customers.
 *
 * **Architecture**:
 *   - Single global `keydown` listener en `document` (capture: false).
 *   - Shortcuts registrados via `register()` retornando un Disposable
 *     que el componente puede usar con `DestroyRef` para cleanup auto.
 *   - Cross-platform: `cmd+X` mapea a `Meta` en macOS y `Ctrl` en
 *     Windows/Linux automáticamente. `ctrl+X` es literal Control en
 *     ambos OS — permite declarar atajos platform-específicos.
 *   - Input context skip por default (Linear/Notion: shortcuts off
 *     en input/textarea/contenteditable, excepto whitelist).
 *
 * **Por qué service y no directive**: shortcuts no son per-element,
 * son global keyboard handlers. Component-level (CustomersComponent)
 * inyecta el service y registra sus shortcuts en constructor; al
 * destruirse el componente, el DestroyRef hook unregistra todo.
 *
 * **Mock backend N/A**: shortcuts son client-side puros. No hay
 * persistence (los user shortcuts custom de Linear/Notion sí
 * persisten en backend, pero v1 con presets fixed es suficiente).
 */
@Injectable({ providedIn: 'root' })
export class CustomersKeyboardService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly shortcuts = signal<readonly KeyboardShortcut[]>([]);

  /** Stream público para que el help overlay liste shortcuts
   * agrupados por section. */
  readonly registered = this.shortcuts.asReadonly();

  /**
   * Detección de macOS. Prioriza `navigator.userAgentData.platform`
   * (UA-CH, no deprecated, no spoofeada por iPadOS) con fallback a
   * `navigator.platform` (deprecated pero universalmente soportado).
   * iPadOS reporta "MacIntel" en el legacy platform pero "iOS" en
   * userAgentData — el UA-CH es más preciso.
   */
  private readonly isMac = detectMac(this.platformId);

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return; // SSR
    fromEvent<KeyboardEvent>(document, 'keydown')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => this.handleKeydown(event));
  }

  /**
   * Registra una colección de shortcuts. Retorna disposable cleanup
   * para cuando el componente que llamó se destruya. Defensive copy
   * del array — si el caller muta el array después del register, no
   * afecta a nuestro state interno.
   */
  register(shortcuts: KeyboardShortcut[]): () => void {
    const frozen = shortcuts.map((s) => ({ ...s }));
    this.shortcuts.update((curr) => [...curr, ...frozen]);
    return () => {
      this.shortcuts.update((curr) => curr.filter((s) => !frozen.includes(s)));
    };
  }

  /**
   * Mapeo human-readable del combo para el `?` help overlay.
   * `cmd+k` → `⌘K` (macOS) o `Ctrl+K` (Windows/Linux).
   */
  formatCombo(combo: string): string {
    const parts = combo.toLowerCase().split('+');
    return parts
      .map((p) => {
        if (p === 'cmd') return this.isMac ? '⌘' : 'Ctrl';
        if (p === 'ctrl') return this.isMac ? '⌃' : 'Ctrl';
        if (p === 'alt') return this.isMac ? '⌥' : 'Alt';
        if (p === 'shift') return '⇧';
        if (p === 'enter') return '↵';
        if (p === 'escape' || p === 'esc') return 'Esc';
        if (p === 'arrowup') return '↑';
        if (p === 'arrowdown') return '↓';
        if (p === 'arrowleft') return '←';
        if (p === 'arrowright') return '→';
        return p.length === 1 ? p.toUpperCase() : p;
      })
      .join(this.isMac ? '' : '+');
  }

  // ── Internal ──────────────────────────────────────────────────────

  private handleKeydown(event: KeyboardEvent): void {
    const combo = this.normalizeCombo(event);
    const matches = this.shortcuts().filter((s) => this.matchCombo(s.combo, combo));
    if (matches.length === 0) return;

    if (this.isInputContext(event.target as Element | null)) {
      // Solo whitelist explícita (Cmd+K, ?) corre en input context.
      // El check se hace sobre los matches DECLARADOS por el caller —
      // si un consumer declara `cmd+k` Y `n`, ambos matches pueden
      // estar acá; filtramos por allow-list.
      const alwaysOn = matches.filter((m) => ALWAYS_ON_COMBOS.has(m.combo.toLowerCase()));
      // Honor `ignoreInInputs: false` explícito como override del
      // consumer (raro, pero permitido — ej: para shortcuts dentro de
      // un mini-editor donde Cmd+B debe bold).
      const optedIn = matches.filter((m) => m.ignoreInInputs === false);

      for (const m of [...alwaysOn, ...optedIn]) {
        event.preventDefault();
        m.handler(event);
      }
      return;
    }

    for (const m of matches) {
      event.preventDefault();
      m.handler(event);
    }
  }

  /**
   * Construye combo string desde KeyboardEvent. Branch por OS:
   *   - macOS: `metaKey` (⌘) → 'cmd', `ctrlKey` (⌃) → 'ctrl'.
   *     Distintos físicamente, distintos lógicamente.
   *   - Windows/Linux: `ctrlKey` → 'cmd' (modificador "primary" del
   *     OS), `metaKey` (Win/Super) → no es estándar para atajos.
   *   - El consumer que declare `cmd+k` recibe ⌘K en Mac y Ctrl+K
   *     en Windows. Quien declare `ctrl+k` recibe Control+K en
   *     ambos OS (literal, no mapeado).
   */
  private normalizeCombo(event: KeyboardEvent): string {
    const parts: string[] = [];
    if (this.isMac) {
      if (event.metaKey) parts.push('cmd');
      if (event.ctrlKey) parts.push('ctrl');
    } else {
      if (event.ctrlKey) parts.push('cmd');
      // En Windows/Linux ignoramos metaKey (tecla Win/Super) — no es
      // convención de atajos cross-OS.
    }
    if (event.altKey) parts.push('alt');
    if (event.shiftKey) parts.push('shift');
    const key = event.key.toLowerCase();
    if (key !== 'control' && key !== 'meta' && key !== 'alt' && key !== 'shift') {
      parts.push(key);
    }
    return parts.join('+');
  }

  private matchCombo(declared: string, actual: string): boolean {
    return declared.toLowerCase() === actual.toLowerCase();
  }

  private isInputContext(target: Element | null): boolean {
    if (!target) return false;
    const tag = target.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
    if ((target as HTMLElement).isContentEditable) return true;
    return false;
  }
}

/**
 * Detección de macOS robusta. `navigator.userAgentData.platform` es
 * UA-CH (no deprecated), `navigator.platform` es legacy pero universal.
 *
 * Por qué el fallback importa: en iPadOS, `navigator.platform` reporta
 * `"MacIntel"` (mismo que Mac desktop), pero `userAgentData.platform`
 * reporta `"iOS"`. Para nuestro caso (mapear cmd → Meta en Mac), un
 * iPad con teclado físico SÍ debería tratarse como Mac — userAgentData
 * lo distingue de Mac desktop correctamente, pero ambos quieren Meta
 * mapping. Resultado: tratamos iOS como Mac (Meta convention) y los
 * demás como no-Mac. La detección NO usa el resultado UA-CH directamente
 * para evitar errores de tipo en TS (la API es experimental en lib.dom),
 * solo lo usa cuando está disponible runtime.
 */
function detectMac(platformId: object): boolean {
  if (!isPlatformBrowser(platformId)) return false;
  if (typeof navigator === 'undefined') return false;
  // UA-CH primario (no deprecated). Tipo `unknown` porque la API es
  // experimental en lib.dom; cast seguro via runtime checks.
  const uaData = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData;
  if (uaData && typeof uaData.platform === 'string') {
    return /mac|ios/i.test(uaData.platform);
  }
  // Fallback legacy (deprecated por MDN pero universal). Incluye
  // "MacIntel" (Mac), "iPhone", "iPad", "MacPPC".
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform);
}
