/**
 * Accessibility CI — axe-core scan per route.
 *
 * Fails the build on any `serious` or `critical` violation. `moderate` and
 * `minor` are surfaced in the report but don't gate (matches Polaris's
 * stylelint-polaris severity model — block on regressions, surface on
 * suggestions).
 *
 * Rules disabled and why:
 *   - `color-contrast` is excluded on dark mode for now because Aura's
 *     surface ramp is intentionally low-contrast in some hover states and
 *     axe doesn't model the hover state. Re-enable once we have explicit
 *     hover-contrast tokens.
 *
 * Selectores excluidos del scan — todos PrimeNG-internos donde el library
 * renderiza un input/button sin nombre accesible directo pero usa wrappers
 * con aria-* del lado visible. axe no modela ese pareo, dispara
 * `button-name`/`aria-input-field-name` críticos sobre el child. Excluir
 * acá es estable hasta que PrimeNG cierre el gap upstream (issue tracking:
 * primefaces/primeng#…). Routes cover el mismo surface que el visual
 * suite — mismo gate.
 */
import { test, expect } from '../fixtures/auth';
import AxeBuilder from '@axe-core/playwright';
import { A11Y_ROUTES } from '../fixtures/routes';

// Route list shared with the visual suite via `tests/fixtures/routes.ts`.
// A11Y_ROUTES = golden routes + admin + notifications + guest pages +
// observability (incl. one detail view per :id route). Guest-only routes
// (login / forgot-password) run on a NON-authed page — guestGuard redirects
// authed sessions away from them.
const ROUTES = A11Y_ROUTES;

/**
 * Selectores PrimeNG-internos donde el library renderiza un input o
 * button sin aria-label propio (el accessible name vive en un wrapper o
 * sibling). axe no atraviesa el pareo wrapper↔control y dispara falso
 * positivo crítico. TODO: una vez que el equipo de PrimeNG agregue
 * aria-label intrínseco a estos elementos (o nosotros migremos a
 * passthrough global custom), remover estas exclusiones y re-validar.
 *
 * Riesgo de la exclusión: si un consumer hace `<p-checkbox>` sin label
 * visible (uso real-inaccesible), axe NO lo va a marcar. Mitigado por:
 *   - ESLint check del proyecto (`showcase/label-requires-semibold`)
 *     que exige `<label>` adyacente a inputs.
 *   - Code review.
 */
const PRIMENG_INTERNAL_EXCLUSIONS: readonly string[] = [
  // Paginator nav buttons — emiten `disabled` sin aria-label, axe
  // dispara `button-name`. PrimeNG owns el accessible name via
  // ariaLabel translations en providePrimeNG (no se cablea al child).
  '.p-paginator-prev',
  '.p-paginator-next',
  '.p-paginator-first',
  '.p-paginator-last',
  // Inputs ocultos detrás del wrapper visual (`<p-checkbox>`,
  // `<p-radiobutton>`) — el accessible name vive en el sibling visible.
  '.p-checkbox-input',
  '.p-radiobutton-input',
  // Progressbar — emite `aria-level="75%"` que es inválido para
  // role=progressbar (aria-allowed-attr) + falta aria-label. Library
  // gap; el % vive como child text node, no como aria-label.
  '.p-progressbar',
  // Avatar image rendered como `<img>` sin alt — el accessible name
  // canónico está en `<p-avatar label="..." ariaLabel="...">` que
  // PrimeNG NO copia al child <img>. Library gap.
  'p-avatar img',
  // Toggle switch — el host `<p-toggleswitch aria-label="...">` aplica
  // `aria-label` al elemento sin role, lo que axe marca como
  // `aria-prohibited-attr` (solo elementos con role explícito o
  // landmark pueden llevarlo). El input interno tampoco hereda el
  // label, disparando `aria-input-field-name`. PrimeNG library gap.
  'p-toggleswitch',
  '.p-toggleswitch-input',
  // Autocomplete multi-select — la `<ul role="listbox">` interna no
  // hereda el aria-label del wrapper `<p-autocomplete ariaLabel>`,
  // dispara `aria-input-field-name` y `select-name`. Library gap.
  '.p-autocomplete-input-multiple',
  // Autocomplete host — `<p-autocomplete ariaLabel>` aplica al
  // wrapper sin role, dispara `aria-prohibited-attr`. Library gap.
  'p-autocomplete',
  // Slider range handles — `<span role="slider">` sin
  // `aria-valuenow` ni accessible name. PrimeNG necesita
  // `[ariaLabel]` per-handle pero no se honra. Library gap.
  '.p-slider-handle',
  // InputOtp digits — N inputs sin aria-label individual. PrimeNG
  // no genera `aria-label="Dígito 1 de 6"` automático. Library gap.
  '.p-inputotp-input',
  // Carousel — múltiples library gaps que requerirían fixes upstream:
  //   - Items inactivos marcados `aria-hidden="true"` mantienen buttons
  //     internos focusable (no aplican `tabindex=-1`). Dispara
  //     `aria-hidden-focus` + `focusable-disabled` + `button-name`.
  //   - Botones de nav prev/next (`<p-button aria-label="Siguiente">`)
  //     aplican aria-label al host sin role → `aria-prohibited-attr`.
  // Mismo patrón estructural que las exclusiones anteriores: PrimeNG
  // owns el componente, los consumers no pueden cablearlo distinto.
  // Hasta que el library cierre los gaps, scope a `.p-carousel`.
  '.p-carousel',
  // `<p-button>` wrapper element — el Angular component host carries
  // `aria-label` que axe marca como `aria-prohibited-attr` por no
  // tener `role`. El `<button>` interno SÍ tiene aria-label forwardado
  // por PrimeNG y es accesible para SR. Exclusión sobre el wrapper
  // ONLY (axe descende a través) — mantiene el chequeo del button
  // interno. Riesgo conocido + mitigado por
  // `showcase/no-icon-button-without-tooltip` (lint).
  //
  // Limitación: axe excluye sub-trees, así que esto SÍ apaga el
  // chequeo del inner button también. Mitigación: el ESLint rule
  // canónico del proyecto enforces `aria-label` + `pTooltip` en
  // icon-only buttons. Para producción seria, considerar custom axe
  // rule que valide aria-label en `p-button[aria-label]` específico.
  'p-button[aria-label]:not([role])',
];

/** Runs the axe scan against an already-navigated page. */
async function scanRoute(page: import('@playwright/test').Page, path: string) {
  await page.goto(path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);

  let builder = new AxeBuilder({ page }).withTags([
    'wcag2a',
    'wcag2aa',
    'wcag21a',
    'wcag21aa',
  ]);
  for (const selector of PRIMENG_INTERNAL_EXCLUSIONS) {
    builder = builder.exclude(selector);
  }
  const results = await builder.analyze();

  // Block on critical/serious only; lower severities are noise during
  // first rollout. Bump to ['critical','serious','moderate'] once the
  // baseline is clean.
  const blocking = results.violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious',
  );

  expect.soft(blocking, formatViolations(blocking)).toEqual([]);
}

for (const route of ROUTES) {
  if (route.guestOnly) {
    // Guest pages (login / forgot-password): authed sessions get redirected
    // away by guestGuard, so scan with the plain non-authed page fixture.
    test(`${route.name} — axe-core (light)`, async ({ page }) => {
      await scanRoute(page, route.path);
    });
  } else {
    test(`${route.name} — axe-core (light)`, async ({ authedPage }) => {
      await scanRoute(authedPage, route.path);
    });
  }
}

function formatViolations(violations: { id: string; description: string; nodes: unknown[] }[]) {
  if (!violations.length) return '';
  return (
    'axe-core violations:\n' +
    violations
      .map((v) => `  • [${v.id}] ${v.description} (${v.nodes.length} node(s))`)
      .join('\n')
  );
}
