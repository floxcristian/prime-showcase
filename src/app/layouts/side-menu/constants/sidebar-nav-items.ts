import { SidebarNavItem } from '../models/sidebar-nav-item.interface';

export const SIDEBAR_NAV_ITEMS: SidebarNavItem[] = [
  { icon: 'pi pi-home', title: 'Overview', url: '' },
  { icon: 'pi pi-comment', title: 'Chat', url: 'chat' },
  { icon: 'pi pi-inbox', title: 'Inbox', url: 'inbox' },
  { icon: 'pi pi-th-large', title: 'Cards', url: 'cards' },
  { icon: 'pi pi-user', title: 'Customers', url: 'customers' },
  { icon: 'pi pi-video', title: 'Movies', url: 'movies' },
];

export const SIDEBAR_NAV_ITEMS_MORE: SidebarNavItem[] = [
  { icon: 'pi pi-cog', title: 'Settings', url: 'settings' },
  { icon: 'pi pi-question-circle', title: 'Help', url: 'help' },
];

// Legacy exports for backward compatibility
export const sampleAppsSidebarNavs = SIDEBAR_NAV_ITEMS;
export const sampleAppsSidebarNavsMore = SIDEBAR_NAV_ITEMS_MORE;