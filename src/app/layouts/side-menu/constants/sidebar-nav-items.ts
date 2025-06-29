import { SidebarNavItem } from '../models/sidebar-nav-item.interface';

export const SIDEBAR_NAV_ITEMS: SidebarNavItem[] = [
  { 
    icon: 'pi pi-home', 
    title: 'Overview', 
    url: '',
    selectable: true
  },
  { 
    icon: 'pi pi-comment', 
    title: 'Chat', 
    url: 'chat',
    selectable: true
  },
  { 
    icon: 'pi pi-inbox', 
    title: 'Inbox', 
    url: 'inbox',
    selectable: true
  },
  { 
    icon: 'pi pi-th-large', 
    title: 'Cards', 
    url: 'cards',
    selectable: true
  },
  {
    icon: 'pi pi-users',
    title: 'Management',
    selectable: false,
    expanded: false,
    children: [
      { 
        icon: 'pi pi-user', 
        title: 'Customers', 
        url: 'customers',
        selectable: true
      },
      { 
        icon: 'pi pi-users', 
        title: 'Teams', 
        url: 'teams',
        selectable: true
      },
      { 
        icon: 'pi pi-building', 
        title: 'Organizations', 
        url: 'organizations',
        selectable: true
      }
    ]
  },
  {
    icon: 'pi pi-play',
    title: 'Media',
    selectable: false,
    expanded: false,
    children: [
      { 
        icon: 'pi pi-video', 
        title: 'Movies', 
        url: 'movies',
        selectable: true
      },
      { 
        icon: 'pi pi-music', 
        title: 'Music', 
        url: 'music',
        selectable: true
      },
      { 
        icon: 'pi pi-images', 
        title: 'Gallery', 
        url: 'gallery',
        selectable: true
      }
    ]
  },
  {
    icon: 'pi pi-chart-line',
    title: 'Analytics',
    selectable: false,
    expanded: false,
    children: [
      { 
        icon: 'pi pi-chart-bar', 
        title: 'Reports', 
        url: 'reports',
        selectable: true
      },
      { 
        icon: 'pi pi-chart-pie', 
        title: 'Statistics', 
        url: 'statistics',
        selectable: true
      },
      { 
        icon: 'pi pi-trending-up', 
        title: 'Trends', 
        url: 'trends',
        selectable: true
      }
    ]
  }
];

export const SIDEBAR_NAV_ITEMS_MORE: SidebarNavItem[] = [
  { 
    icon: 'pi pi-cog', 
    title: 'Settings', 
    url: 'settings',
    selectable: true
  },
  { 
    icon: 'pi pi-question-circle', 
    title: 'Help', 
    url: 'help',
    selectable: true
  },
];

// Legacy exports for backward compatibility
export const sampleAppsSidebarNavs = SIDEBAR_NAV_ITEMS;
export const sampleAppsSidebarNavsMore = SIDEBAR_NAV_ITEMS_MORE;