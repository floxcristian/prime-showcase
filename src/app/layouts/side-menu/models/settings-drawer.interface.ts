export interface CallLog {
  image: string;
  name: string;
  time: string;
}

export interface EmailRecord {
  image: string;
  name: string;
  time: string;
  title: string;
  text: string;
}

export interface PreferenceItem {
  icon: string;
  title: string;
  checked: boolean;
}

export interface PreferenceGroup {
  title: string;
  prefs: PreferenceItem[];
}

export interface Opportunity {
  title: string;
  link: string;
  image: string;
  text: string;
}
