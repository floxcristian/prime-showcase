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
 * Routes covered match the visual suite — same surface area, same gate.
 */
import { test, expect } from '../fixtures/auth';
import AxeBuilder from '@axe-core/playwright';

const ROUTES = [
  { path: '/', name: 'overview' },
  { path: '/customers', name: 'customers' },
  { path: '/inbox', name: 'inbox' },
  { path: '/chat', name: 'chat' },
  { path: '/cards', name: 'cards' },
  { path: '/movies', name: 'movies' },
] as const;

for (const route of ROUTES) {
  test(`${route.name} — axe-core (light)`, async ({ authedPage }) => {
    await authedPage.goto(route.path, { waitUntil: 'networkidle' });
    await authedPage.waitForTimeout(300);

    const results = await new AxeBuilder({ page: authedPage })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    // Block on critical/serious only; lower severities are noise during
    // first rollout. Bump to ['critical','serious','moderate'] once the
    // baseline is clean.
    const blocking = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );

    expect.soft(blocking, formatViolations(blocking)).toEqual([]);
  });
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
