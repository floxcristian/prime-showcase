import { SafeHtml } from '@angular/platform-browser';

export interface CustomerCompany {
  name: string;
  logo: CompanyLogoKey;
}

export interface Customer {
  id: number;
  image: string;
  active: boolean | undefined;
  name: string;
  capName?: string;
  title: string;
  company: CustomerCompany;
  email: string;
  lead: string;
  status: 'Activo' | 'Inactivo' | 'Prospecto';
}

export type CompanyLogoKey = 'mistranet' | 'britemank' | 'zentrailms' | 'streamlinz' | 'wavelength';

export type CompanyLogos = Record<CompanyLogoKey | string, SafeHtml>;
