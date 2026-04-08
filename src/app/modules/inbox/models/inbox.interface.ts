export interface InboxNavItem {
  name: string;
  icon: string;
}

export interface InboxNavGroup {
  title: string;
  navs: InboxNavItem[];
}

export interface InboxMessage {
  id: number;
  bookmarked: boolean;
  image: string;
  active: boolean;
  name: string;
  capName?: string;
  type: string;
  time: string;
  title: string;
  message: string;
}
