export interface SidebarNavItem {
  icon: string;
  title: string;
  url?: string;
  children?: SidebarNavItem[];
  expanded?: boolean;
  selectable?: boolean;
}