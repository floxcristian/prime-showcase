// @ts-check
'use strict';

const { collectElementClassStrings } = require('../utils');

/**
 * @fileoverview Enforces text-link visuals on `<a>` elements.
 *
 * CLAUDE.md design rule: un `<a>` que vive en contenido (no como wrapper de nav
 * item o de `<p-button>`) es un link de texto y lleva SIEMPRE la misma pila:
 *
 *     font-medium cursor-pointer transition-colors duration-150 underline
 *     text-primary hover:text-primary-emphasis
 *
 * Por que este set:
 *   - `text-primary` / `hover:text-primary-emphasis` son los tokens del preset
 *     Aura — cambiar la paleta primary en app.config.ts propaga automaticamente
 *     a todos los links. No hay `text-blue-500` hardcoded.
 *   - `font-medium` da peso suficiente para que el link se lea como accion sin
 *     ser tan fuerte como un label (font-semibold) o un titulo (font-bold).
 *   - `underline` es la affordance estandar de link. Tailwind Preflight remueve
 *     el underline del user agent default, por eso hay que declararlo.
 *   - `cursor-pointer` refuerza la affordance para mouse.
 *   - `transition-colors duration-150` suaviza el cambio de text-primary ->
 *     text-primary-emphasis al hover (150ms = sweet spot Stripe/Linear).
 *
 * Exenciones (el <a> NO es un link de texto, es wrapper semantico):
 *   1. `[routerLink]` / `routerLink` — nav item enrutado, usa su propio estilo
 *      (text-muted-color + routerLinkActive). Ver side-menu.component.
 *   2. `href` estatico que empieza con `#` — skip link o ancla in-page,
 *      tiene estilo de accesibilidad propio (sr-only / focus:not-sr-only).
 *   3. Contiene un <p-button> (o <button pButton>) como hijo — el <a> envuelve
 *      el boton para darle navegacion; el styling vive en el boton. Ver
 *      settings-drawer.component.
 *
 * El scan agrega TODAS las class strings del elemento (static + bound, a traves
 * de class/[ngClass]/[class]/*StyleClass) y verifica que las 7 clases requeridas
 * aparezcan. Cada clase faltante se reporta con un mensaje propio para que el
 * fix sea mecanico.
 */

const REQUIRED_CLASSES = [
  'font-medium',
  'cursor-pointer',
  'transition-colors',
  'duration-150',
  'underline',
  'text-primary',
  'hover:text-primary-emphasis',
];

function buildClassRegex(cls) {
  // Escape `:` for the regex (word boundary fails on `:`).
  const escaped = cls.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Match as a whole token: preceded by start/whitespace, followed by end/whitespace.
  return new RegExp(`(^|\\s)${escaped}(\\s|$)`);
}

const CLASS_REGEXES = REQUIRED_CLASSES.map((cls) => ({ cls, re: buildClassRegex(cls) }));

function hasAttrName(node, name) {
  for (const attr of node.attributes || []) {
    if (attr.name === name) return true;
  }
  for (const input of node.inputs || []) {
    if (input.name === name) return true;
  }
  return false;
}

function hasStaticAttrStartsWith(node, name, prefix) {
  for (const attr of node.attributes || []) {
    if (attr.name === name && typeof attr.value === 'string' && attr.value.startsWith(prefix)) {
      return true;
    }
  }
  return false;
}

function containsPButton(node) {
  const children = node.children || [];
  for (const child of children) {
    if (!child || !child.name) continue;
    if (child.name === 'p-button') return true;
    if (hasAttrName(child, 'pButton')) return true;
  }
  return false;
}

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        '<a> text links must use the canonical class set (font-medium, cursor-pointer, transition-colors, duration-150, underline, text-primary, hover:text-primary-emphasis). Exempt: routerLink, href="#...", wrapper of <p-button>.',
      url: '../../docs/rules/anchor-link-classes.md',
    },
    schema: [],
    messages: {
      missingClass:
        '<a> text link is missing "{{className}}". Required set: font-medium cursor-pointer transition-colors duration-150 underline text-primary hover:text-primary-emphasis.',
    },
  },
  create(context) {
    const parserServices = context.sourceCode.parserServices;

    return {
      Element(node) {
        if (node.name !== 'a') return;

        // Exemption 1: routerLink (nav item)
        if (hasAttrName(node, 'routerLink')) return;

        // Exemption 2: href starts with "#" (skip link / in-page anchor)
        if (hasStaticAttrStartsWith(node, 'href', '#')) return;

        // Exemption 3: wraps a <p-button> (semantic wrapper)
        if (containsPButton(node)) return;

        // Collect all class strings from the element
        const classStrings = collectElementClassStrings(node);
        const combined = classStrings.join(' ');

        for (const { cls, re } of CLASS_REGEXES) {
          if (re.test(combined)) continue;
          context.report({
            loc: parserServices.convertNodeSourceSpanToLoc(node.sourceSpan),
            messageId: 'missingClass',
            data: { className: cls },
          });
        }
      },
    };
  },
};
