export interface NavLeaf {
  title: string;
  url: string;
  icon?: string;
}

export interface NavSection {
  id: string;
  title: string;
  icon: string;
  children: NavLeaf[];
}

export interface NavModule {
  id: string;
  title: string;
  icon: string;
  sections: NavSection[];
}
