// @ts-check
'use strict';

/**
 * @fileoverview Forbids `styleClass` / `[styleClass]` on PrimeNG components
 * where PrimeNG v20 deprecated the input in favor of `class`.
 *
 * PrimeNG v20 introduced a host-binding directive (`primeng/Bind`) that
 * forwards the host `class` attribute onto the component's internal rendered
 * root. Before v20 the only way to target the internal root was the
 * component-specific `styleClass` input; after v20 `styleClass` is
 * redundant with `class` and the PrimeNG docs + type definitions mark it as
 *
 *     @deprecated since v20.0.0, use `class` instead.
 *
 * A showcase repo should track the framework's public API, not parallel
 * legacy shapes — otherwise deprecation warnings leak into the IDE and the
 * codebase drifts from current docs. This rule enforces the migration.
 *
 * Scope:
 *   - Flags `styleClass="..."` (TextAttribute)
 *   - Flags `[styleClass]="expr"` (BoundAttribute)
 *   - Only on component selectors where PrimeNG v20 marked `styleClass` as
 *     deprecated (see `DEPRECATED_STYLECLASS_ELEMENTS` below).
 *
 * Out of scope (not flagged):
 *   - `*StyleClass` sub-element inputs (`paginatorStyleClass`,
 *     `valueStyleClass`, `panelStyleClass`, etc.) — these target
 *     internal sub-elements, not the host, and have no `class` equivalent.
 *   - Components where `styleClass` is still the official API: overlay
 *     containers (p-drawer, p-dialog, p-popover, p-tooltip), picker
 *     wrappers (p-confirmdialog, p-confirmpopup, p-galleria), menus that
 *     render append-to-body (p-menu, p-tieredmenu, p-contextmenu), etc.
 *     For those components the host does not render where the content lives,
 *     so the component exposes `styleClass` as its public theming contract.
 *   - Components not yet migrated in the PrimeNG type defs (p-button,
 *     p-fileupload, p-selectbutton). If PrimeNG later deprecates
 *     `styleClass` on those, add them to DEPRECATED_STYLECLASS_ELEMENTS.
 *
 * Migration:
 *   Before: <p-avatar styleClass="rounded-lg" />
 *   After:  <p-avatar class="rounded-lg" />
 *
 *   Before: <p-avatar [styleClass]="cond ? 'a' : 'b'" />
 *   After:  <p-avatar [ngClass]="cond ? 'a' : 'b'" />
 *           or
 *           <p-avatar [class]="cond ? 'a' : 'b'" />
 */

// Components where PrimeNG v20 marked `styleClass` with
// `@deprecated since v20.0.0, use 'class' instead.`
// Source: node_modules/primeng/types/primeng-*.d.ts (inventoried v21).
// Keep sorted alphabetically for maintenance.
const DEPRECATED_STYLECLASS_ELEMENTS = new Set([
  'p-accordion',
  'p-autocomplete',
  'p-avatar',
  'p-badge',
  'p-blockui',
  'p-card',
  'p-carousel',
  'p-cascadeselect',
  'p-checkbox',
  'p-chip',
  'p-colorpicker',
  'p-dataview',
  'p-datepicker',
  'p-divider',
  'p-dock',
  'p-editor',
  'p-iconfield',
  'p-image',
  'p-inplace',
  'p-inputgroup',
  'p-inputicon',
  'p-inputnumber',
  'p-knob',
  'p-listbox',
  'p-megamenu',
  'p-menubar',
  'p-metergroup',
  'p-multiselect',
  'p-orderlist',
  'p-organizationchart',
  'p-paginator',
  'p-panel',
  'p-panelmenu',
  'p-password',
  'p-progressbar',
  'p-progressspinner',
  'p-radiobutton',
  'p-scrollpanel',
  'p-select',
  'p-skeleton',
  'p-slider',
  'p-splitbutton',
  'p-table',
  'p-tag',
  'p-terminal',
  'p-timeline',
  'p-toast',
  'p-togglebutton',
  'p-toggleswitch',
  'p-toolbar',
  'p-tree',
  'p-treetable',
]);

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        '`styleClass` is deprecated since PrimeNG v20 on most components — use `class` instead. The host `Bind` directive forwards `class` to the internal rendered root, which is now PrimeNG\'s public theming contract.',
      url: '../../docs/rules/no-deprecated-styleclass.md',
    },
    schema: [],
    messages: {
      deprecatedStyleClass:
        '`{{attr}}` on <{{element}}> is deprecated since PrimeNG v20 (use `class` instead). PrimeNG forwards the host `class` to the internal rendered root.',
    },
  },
  create(context) {
    const parserServices = context.sourceCode.parserServices;

    function reportIfStyleClass(element, attr, isBound) {
      if (attr.name !== 'styleClass') return;
      const loc = parserServices.convertNodeSourceSpanToLoc(attr.sourceSpan);
      context.report({
        loc,
        messageId: 'deprecatedStyleClass',
        data: {
          attr: isBound ? '[styleClass]' : 'styleClass',
          element: element.name,
        },
      });
    }

    return {
      Element(node) {
        if (!DEPRECATED_STYLECLASS_ELEMENTS.has(node.name)) return;

        for (const attr of node.attributes || []) {
          reportIfStyleClass(node, attr, false);
        }
        for (const attr of node.inputs || []) {
          reportIfStyleClass(node, attr, true);
        }
      },
    };
  },
};

// Exposed for tests — the canonical list of selectors in scope.
module.exports.DEPRECATED_STYLECLASS_ELEMENTS = DEPRECATED_STYLECLASS_ELEMENTS;
