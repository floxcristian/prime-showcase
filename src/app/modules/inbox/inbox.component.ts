// Angular
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
// PrimeNG
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { DividerModule } from 'primeng/divider';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { MenuModule } from 'primeng/menu';
import { OverlayBadgeModule } from 'primeng/overlaybadge';
import { ProgressBar } from 'primeng/progressbar';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { InboxNavGroup, InboxMessage } from './models/inbox.interface';

const NG_MODULES = [FormsModule, RouterModule, NgClass];
const PRIME_MODULES = [
  AvatarModule,
  ButtonModule,
  Checkbox,
  DividerModule,
  IconField,
  InputIcon,
  InputTextModule,
  MenuModule,
  OverlayBadgeModule,
  ProgressBar,
  TableModule,
  Tag,
];
@Component({
  selector: 'app-inbox',
  imports: [NG_MODULES, PRIME_MODULES],
  templateUrl: './inbox.component.html',
  styleUrl: './inbox.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'flex gap-4 h-full flex-1 w-full overflow-auto',
  },
})
export class InboxComponent implements OnInit {
  search: string | undefined;

  activeInboxNav: string = 'Bandeja';

  inboxNavs: InboxNavGroup[] = [];

  tableData: InboxMessage[] = [];

  selectedRows: InboxMessage[] = [];

  tableTokens = {
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

  ngOnInit() {
    this.inboxNavs = [
      {
        title: 'Navegación',
        navs: [
          { name: 'Bandeja', icon: 'pi pi-inbox' },
          { name: 'Destacados', icon: 'pi pi-star' },
          { name: 'Borradores', icon: 'pi pi-file-o' },
          { name: 'Importantes', icon: 'pi pi-file-import' },
          { name: 'Enviados', icon: 'pi pi-send' },
          { name: 'Archivo', icon: 'pi pi-inbox' },
          { name: 'Spam', icon: 'pi pi-info-circle' },
          { name: 'Papelera', icon: 'pi pi-trash' },
        ],
      },
      {
        title: 'Otros',
        navs: [
          { name: 'Seguridad', icon: 'pi pi-tag' },
          { name: 'Actualización', icon: 'pi pi-tag' },
          { name: 'Marketing', icon: 'pi pi-tag' },
          { name: 'RRHH', icon: 'pi pi-tag' },
        ],
      },
    ];
    this.tableData = [
      {
        id: 1,
        bookmarked: false,
        image:
          'https://www.primefaces.org/cdn/primevue/images/landing/apps/avatar12.jpg',
        active: false,
        name: 'Brook Simmons',
        type: 'Seguridad',
        time: '3:24 PM',
        title: 'Actualización importante de cuenta',
        message:
          'Estimado cliente, hemos realizado actualizaciones para mejorar la seguridad de su cuenta. Inicie sesión para revisar y completar los pasos necesarios. Gracias por elegir ABC Corporation.',
      },
      {
        id: 2,
        bookmarked: false,
        image:
          'https://www.primefaces.org/cdn/primevue/images/landing/apps/avatar2.png',
        active: false,
        name: 'Dianne Russell',
        type: 'Actualización',
        time: '11:24 AM',
        title: 'Actualización semanal del proyecto',
        message:
          'Hola equipo, adjunto la actualización semanal del proyecto. Revisen el progreso y vengan preparados para nuestra discusión en la próxima reunión.',
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
          'Estimado usuario, detectamos acceso no autorizado a su cuenta. Tome acción inmediata para asegurarla. Siga el enlace proporcionado para restablecer su contraseña.',
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
          'Saludos, ¡consulte nuestra oferta exclusiva! No se pierda esta promoción por tiempo limitado. Detalles en el folleto adjunto.',
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
          'Hola equipo, marquen sus calendarios para nuestro próximo Evento de Reconocimiento al Empleado. ¡Estén atentos para más detalles y prepárense para un día de celebración!',
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
        title: 'Su compra reciente - Confirmación de pedido',
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
          'Atención usuarios, hemos programado mantenimiento del sistema el 17 de enero. Esperen mínima interrupción del servicio. Gracias por su comprensión.',
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
          'Estimado cliente, como muestra de agradecimiento, ofrecemos descuentos exclusivos para clientes VIP. Explore los ahorros en el catálogo adjunto.',
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
          'Hola Darrell Steward, manténgase al día con nuestras últimas noticias y destacados en la edición de enero de nuestro boletín. ¡Disfrute la lectura!',
      },
      {
        id: 10,
        bookmarked: true,
        image: '',
        active: false,
        name: 'Jerome Bell',
        capName: 'JB',
        type: 'Boletín',
        time: '2 Ene',
        title: 'Boletín mensual - Edición de enero',
        message:
          'Estimado usuario, hemos actualizado nuestros Términos de Servicio. Revise los cambios para asegurar el cumplimiento. El uso continuo de nuestros servicios implica aceptación. Gracias.',
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
          'Saludos viajero, explore nuestros paquetes de viaje exclusivos diseñados para usted. Planifique su próxima aventura con XYZ Travel.',
      },
      {
        id: 12,
        bookmarked: false,
        image: '',
        active: false,
        name: 'Robert Fox',
        capName: 'RF',
        type: 'Invitación',
        time: '12.12.2023',
        title: 'Invitación a Ámsterdam',
        message:
          'Hola Robert Fox, está invitado a nuestro próximo webinar sobre Ámsterdam. Únase a nosotros para una sesión reveladora. ¡Reserve su lugar ahora!',
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
        title: 'Novedades - Descubre los últimos libros',
        message:
          'Amantes de los libros, ¡descubran nuestras últimas novedades! Exploren el catálogo adjunto y sumérjanse en el mundo de los nuevos lanzamientos.',
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
        message: 'Demo exclusiva de nuestro último producto el jueves.',
      },
      {
        id: 15,
        bookmarked: false,
        image: '',
        active: false,
        name: 'Jerome Bell',
        capName: 'JB',
        type: 'Boletín',
        time: '10.01.2023',
        title: 'Boletín mensual - Edición de enero',
        message:
          'Estimado usuario, hemos actualizado nuestros Términos de Servicio. Revise los cambios para asegurar el cumplimiento. El uso continuo de nuestros servicios implica aceptación. Gracias.',
      },
    ];
  }
}
