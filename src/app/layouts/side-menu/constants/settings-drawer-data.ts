import type { CallLog, EmailRecord, PreferenceGroup, Opportunity } from '../models/settings-drawer.interface';

export const CALL_LOGS: CallLog[] = [
  {
    image: 'https://www.primefaces.org/cdn/primevue/images/landing/apps/avatar6.png',
    name: 'Brook Simmons',
    time: '02.02.2024 | 45 min',
  },
  {
    image: 'https://www.primefaces.org/cdn/primevue/images/landing/apps/avatar12.jpg',
    name: 'Jacob Jones',
    time: '02.02.2024 | 45 min',
  },
  {
    image: 'https://www.primefaces.org/cdn/primevue/images/landing/apps/avatar13.jpg',
    name: 'Annette Black',
    time: '02.03.2024 | 13 min',
  },
  {
    image: 'https://www.primefaces.org/cdn/primevue/images/landing/apps/avatar9.jpg',
    name: 'Arlene McCoy',
    time: '02.03.2024 | 14 min',
  },
  {
    image: 'https://www.primefaces.org/cdn/primevue/images/landing/apps/avatar10.jpg',
    name: 'Arlene Simmons',
    time: '02.03.2024 | 14 min',
  },
  {
    image: 'https://www.primefaces.org/cdn/primevue/images/landing/apps/avatar11.jpg',
    name: 'Michael Brown',
    time: '02.04.2024 | 20 min',
  },
];

export const EMAIL_RECORDS: EmailRecord[] = [
  {
    image: 'https://www.primefaces.org/cdn/primevue/images/landing/apps/avatar2.png',
    name: 'Brook Simmons',
    time: '3:24 PM',
    title: 'Potencia tu negocio',
    text: 'Automatiza, analiza y acelera tus procesos empresariales...',
  },
  {
    image: 'https://www.primefaces.org/cdn/primevue/images/landing/apps/avatar7.png',
    name: 'Jacob Jones',
    time: '23.12.2023',
    title: 'Revolución en flujos de trabajo',
    text: 'Experimenta una revolución en flujos de trabajo optimizados...',
  },
  {
    image: 'https://www.primefaces.org/cdn/primevue/images/landing/apps/avatar8.png',
    name: 'Annette Black',
    time: '17.12.2023',
    title: 'Innovación al alcance',
    text: 'Con nuestra solución SaaS, la innovación está a tu alcance...',
  },
  {
    image: 'https://www.primefaces.org/cdn/primevue/images/landing/apps/avatar11.jpg',
    name: 'Arlene McCoy',
    time: '17.06.2023',
    title: 'Integración sin esfuerzo',
    text: 'Intégrate sin esfuerzo con tus herramientas favoritas...',
  },
  {
    image: 'https://www.primefaces.org/cdn/primevue/images/landing/apps/avatar13.jpg',
    name: 'Arlene Simmons',
    time: '17.04.2023',
    title: 'Transforma tu empresa',
    text: 'Empodera a tu equipo con herramientas de última generación...',
  },
  {
    image: 'https://www.primefaces.org/cdn/primevue/images/landing/apps/avatar2.png',
    name: 'Michael Brown',
    time: '05.01.2024',
    title: 'Colaboración de nueva generación',
    text: 'Experimenta el futuro de la colaboración empresarial...',
  },
];

export const PREFERENCES: PreferenceGroup[] = [
  {
    title: 'Correo electrónico',
    prefs: [
      { icon: 'pi pi-bell', title: 'Notificaciones', checked: true },
      { icon: 'pi pi-inbox', title: 'Boletín informativo', checked: false },
      { icon: 'pi pi-sync', title: 'Actualizaciones de producto', checked: false },
    ],
  },
  {
    title: 'Teléfono',
    prefs: [
      { icon: 'pi pi-mobile', title: 'Llamadas', checked: true },
      { icon: 'pi pi-volume-down', title: 'Buzón de voz', checked: false },
      { icon: 'pi pi-comments', title: 'Mensajes SMS', checked: false },
    ],
  },
  {
    title: 'Redes sociales',
    prefs: [
      { icon: 'pi pi-clock', title: 'Publicación automática', checked: true },
      { icon: 'pi pi-user', title: 'Mensaje directo', checked: false },
    ],
  },
  {
    title: 'Privacidad de datos',
    prefs: [
      { icon: 'pi pi-box', title: 'Compartir datos con terceros', checked: true },
      { icon: 'pi pi-file', title: 'Cookies', checked: false },
    ],
  },
];

export const OPPORTUNITIES: Opportunity[] = [
  {
    title: 'Apollo',
    link: 'https://apollo.primeng.org',
    image: 'https://primefaces.org/cdn/primeng/images/layouts/apollo-ng.jpg',
    text: 'Mantén tu aplicación fresca con Apollo, la plantilla más nueva y moderna disponible.',
  },
  {
    title: 'Ultima',
    link: 'https://ultima.primeng.org/',
    image: 'https://primefaces.org/cdn/primeng/images/layouts/ultima-ng.jpg',
    text: 'Eleva la intuitividad de tu aplicación con la interfaz premium Material Design de Ultima.',
  },
  {
    title: 'Diamond',
    link: 'https://diamond.primeng.org/',
    image: 'https://primefaces.org/cdn/primeng/images/layouts/diamond-ng.jpg',
    text: 'Maneja operaciones complejas con elegancia gracias al diseño robusto y potente de Diamond.',
  },
  {
    title: 'Atlantis',
    link: 'https://atlantis.primeng.org/',
    image: 'https://primefaces.org/cdn/primeng/images/layouts/atlantis-ng.jpg',
    text: 'Potencia las capacidades y personalización de tu aplicación con la plantilla Atlantis.',
  },
  {
    title: 'Verona',
    link: 'https://verona.primeng.org/',
    image: 'https://primefaces.org/cdn/primeng/images/layouts/verona-ng.jpg',
    text: 'Logra sofisticación y sutileza con el diseño minimalista de Verona centrado en el contenido.',
  },
  {
    title: 'Freya',
    link: 'https://freya.primeng.org/',
    image: 'https://primefaces.org/cdn/primeng/images/layouts/freya-ng.jpg',
    text: 'Dale a tu aplicación un look elegante y actualizado con la plantilla premium Freya.',
  },
];
