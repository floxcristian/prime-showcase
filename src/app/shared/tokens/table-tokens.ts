import type { DataTableDesignTokens } from '@primeuix/themes/types/datatable';

// Shared design tokens for <p-table> (prop [dt]).
// Makes header/headerCell/row transparent so the table inherits its host
// card's background instead of imposing the theme's surface-0.
//
// Callers that need overrides (e.g. aligning header height with a sibling
// panel in a multi-pane layout) compose via spread. See inbox.component.ts.
export const TRANSPARENT_TABLE_TOKENS: DataTableDesignTokens = {
  header: {
    background: 'transparent',
  },
  headerCell: {
    background: 'transparent',
  },
  row: {
    background: 'transparent',
  },
};
