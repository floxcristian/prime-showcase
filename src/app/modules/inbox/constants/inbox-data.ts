import { InboxNavGroup, InboxMessage } from '../models/inbox.interface';

export const INBOX_NAV_GROUPS: InboxNavGroup[] = [
  {
    title: 'Navegaci\u00f3n',
    navs: [
      { name: 'Bandeja', icon: 'fa-sharp fa-regular fa-inbox' },
      { name: 'Destacados', icon: 'fa-sharp fa-regular fa-star' },
      { name: 'Borradores', icon: 'fa-sharp fa-regular fa-file' },
      { name: 'Importantes', icon: 'fa-sharp fa-regular fa-file-import' },
      { name: 'Enviados', icon: 'fa-sharp fa-regular fa-paper-plane' },
      { name: 'Archivo', icon: 'fa-sharp fa-regular fa-inbox' },
      { name: 'Spam', icon: 'fa-sharp fa-regular fa-circle-info' },
      { name: 'Papelera', icon: 'fa-sharp fa-regular fa-trash' },
    ],
  },
  {
    title: 'Otros',
    navs: [
      { name: 'Seguridad', icon: 'fa-sharp fa-regular fa-tag' },
      { name: 'Actualizaci\u00f3n', icon: 'fa-sharp fa-regular fa-tag' },
      { name: 'Marketing', icon: 'fa-sharp fa-regular fa-tag' },
      { name: 'RRHH', icon: 'fa-sharp fa-regular fa-tag' },
    ],
  },
];

export const INBOX_MESSAGES: InboxMessage[] = [
  {
    id: 1,
    bookmarked: false,
    image:
      'https://www.primefaces.org/cdn/primevue/images/landing/apps/avatar12.jpg',
    active: false,
    name: 'Brook Simmons',
    type: 'Seguridad',
    time: '3:24 PM',
    title: 'Actualizaci\u00f3n importante de cuenta',
    message:
      'Estimado cliente, hemos realizado actualizaciones para mejorar la seguridad de su cuenta. Inicie sesi\u00f3n para revisar y completar los pasos necesarios. Gracias por elegir ABC Corporation.',
  },
  {
    id: 2,
    bookmarked: false,
    image:
      'https://www.primefaces.org/cdn/primevue/images/landing/apps/avatar2.png',
    active: false,
    name: 'Dianne Russell',
    type: 'Actualizaci\u00f3n',
    time: '11:24 AM',
    title: 'Actualizaci\u00f3n semanal del proyecto',
    message:
      'Hola equipo, adjunto la actualizaci\u00f3n semanal del proyecto. Revisen el progreso y vengan preparados para nuestra discusi\u00f3n en la pr\u00f3xima reuni\u00f3n.',
  },
  {
    id: 3,
    bookmarked: true,
    image:
      'https://www.primefaces.org/cdn/primevue/images/landing/apps/avatar13.jpg',
    active: false,
    name: 'Amy Elsner',
    type: 'Seguridad',
    time: '9:24 AM',
    title: 'Urgente: Alerta de seguridad - Cuenta comprometida',
    message:
      'Estimado usuario, detectamos acceso no autorizado a su cuenta. Tome acci\u00f3n inmediata para asegurarla. Siga el enlace proporcionado para restablecer su contrase\u00f1a.',
  },
  {
    id: 4,
    bookmarked: false,
    image:
      'https://www.primefaces.org/cdn/primevue/images/landing/apps/main-avatar.png',
    active: false,
    name: 'Jacob Jones',
    type: 'Marketing',
    time: '21 Ene',
    title: 'Oferta exclusiva - Solo por tiempo limitado',
    message:
      'Saludos, \u00a1consulte nuestra oferta exclusiva! No se pierda esta promoci\u00f3n por tiempo limitado. Detalles en el folleto adjunto.',
  },
  {
    id: 5,
    bookmarked: false,
    image: '',
    active: false,
    name: 'Cameron Watson',
    capName: 'CW',
    type: 'RRHH',
    time: '15 Ene',
    title: 'Evento de reconocimiento al empleado - Reserva la fecha',
    message:
      'Hola equipo, marquen sus calendarios para nuestro pr\u00f3ximo Evento de Reconocimiento al Empleado. \u00a1Est\u00e9n atentos para m\u00e1s detalles y prep\u00e1rense para un d\u00eda de celebraci\u00f3n!',
  },
  {
    id: 6,
    bookmarked: true,
    image: '',
    active: false,
    name: 'Wade Warren',
    capName: 'WW',
    type: 'Factura',
    time: '12 Ene',
    title: 'Su compra reciente - Confirmaci\u00f3n de pedido',
    message:
      'Hola Wade Warren, asegure su lugar en la Conferencia XYZ 2024 con registro anticipado. Disfrute de tarifas con descuento.',
  },
  {
    id: 7,
    bookmarked: false,
    image:
      'https://www.primefaces.org/cdn/primevue/images/landing/apps/avatar7.png',
    active: false,
    name: 'Guy Hawkins',
    type: 'Eventos',
    time: '11 Ene',
    title: 'Registro anticipado abierto - Conferencia XYZ 2024',
    message:
      'Atenci\u00f3n usuarios, hemos programado mantenimiento del sistema el 17 de enero. Esperen m\u00ednima interrupci\u00f3n del servicio. Gracias por su comprensi\u00f3n.',
  },
  {
    id: 8,
    bookmarked: false,
    image:
      'https://www.primefaces.org/cdn/primevue/images/landing/apps/avatar8.png',
    active: false,
    name: 'Annette Black',
    type: '',
    time: '8 Ene',
    title: 'Aviso de mantenimiento programado del sistema',
    message:
      'Estimado cliente, como muestra de agradecimiento, ofrecemos descuentos exclusivos para clientes VIP. Explore los ahorros en el cat\u00e1logo adjunto.',
  },
  {
    id: 9,
    bookmarked: true,
    image:
      'https://www.primefaces.org/cdn/primevue/images/landing/apps/avatar10.jpg',
    active: false,
    name: 'Darrell Steward',
    type: 'Descuento',
    time: '4 Ene',
    title: 'Descuentos especiales para clientes VIP',
    message:
      'Hola Darrell Steward, mant\u00e9ngase al d\u00eda con nuestras \u00faltimas noticias y destacados en la edici\u00f3n de enero de nuestro bolet\u00edn. \u00a1Disfrute la lectura!',
  },
  {
    id: 10,
    bookmarked: true,
    image: '',
    active: false,
    name: 'Jerome Bell',
    capName: 'JB',
    type: 'Bolet\u00edn',
    time: '2 Ene',
    title: 'Bolet\u00edn mensual - Edici\u00f3n de enero',
    message:
      'Estimado usuario, hemos actualizado nuestros T\u00e9rminos de Servicio. Revise los cambios para asegurar el cumplimiento. El uso continuo de nuestros servicios implica aceptaci\u00f3n. Gracias.',
  },
  {
    id: 11,
    bookmarked: false,
    image:
      'https://www.primefaces.org/cdn/primevue/images/landing/apps/avatar11.jpg',
    active: false,
    name: 'Onyama Limba',
    type: '',
    time: '2 Ene',
    title: 'Paquetes de viaje exclusivos para usted',
    message:
      'Saludos viajero, explore nuestros paquetes de viaje exclusivos dise\u00f1ados para usted. Planifique su pr\u00f3xima aventura con XYZ Travel.',
  },
  {
    id: 12,
    bookmarked: false,
    image: '',
    active: false,
    name: 'Robert Fox',
    capName: 'RF',
    type: 'Invitaci\u00f3n',
    time: '12.12.2023',
    title: 'Invitaci\u00f3n a \u00c1msterdam',
    message:
      'Hola Robert Fox, est\u00e1 invitado a nuestro pr\u00f3ximo webinar sobre \u00c1msterdam. \u00danase a nosotros para una sesi\u00f3n reveladora. \u00a1Reserve su lugar ahora!',
  },
  {
    id: 13,
    bookmarked: true,
    image: '',
    active: false,
    name: 'Courtney Henry',
    capName: 'CH',
    type: '',
    time: '12.09.2023',
    title: 'Novedades - Descubre los \u00faltimos libros',
    message:
      'Amantes de los libros, \u00a1descubran nuestras \u00faltimas novedades! Exploren el cat\u00e1logo adjunto y sum\u00e9rjanse en el mundo de los nuevos lanzamientos.',
  },
  {
    id: 14,
    bookmarked: true,
    image:
      'https://www.primefaces.org/cdn/primevue/images/landing/apps/avatar9.jpg',
    active: false,
    name: 'Arlene McCoy',
    type: '',
    time: '12.04.2023',
    title: 'Demo de nuevo producto',
    message: 'Demo exclusiva de nuestro \u00faltimo producto el jueves.',
  },
  {
    id: 15,
    bookmarked: false,
    image: '',
    active: false,
    name: 'Jerome Bell',
    capName: 'JB',
    type: 'Bolet\u00edn',
    time: '10.01.2023',
    title: 'Bolet\u00edn mensual - Edici\u00f3n de enero',
    message:
      'Estimado usuario, hemos actualizado nuestros T\u00e9rminos de Servicio. Revise los cambios para asegurar el cumplimiento. El uso continuo de nuestros servicios implica aceptaci\u00f3n. Gracias.',
  },
];
