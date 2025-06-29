// Angular
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormsModule } from '@angular/router';
import { RouterModule } from '@angular/router';
// PrimeNG
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { DividerModule } from 'primeng/divider';
import { DrawerModule } from 'primeng/drawer';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { MenuModule } from 'primeng/menu';
import { OverlayBadgeModule } from 'primeng/overlaybadge';
import { ProgressBar } from 'primeng/progressbar';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';

const NG_MODULES = [CommonModule, FormsModule, RouterModule];
const PRIME_MODULES = [
  AvatarModule,
  ButtonModule,
  Checkbox,
  DividerModule,
  DrawerModule,
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
    class: 'flex gap-4 h-full flex-1 w-full overflow-hidden',
  },
})
export class InboxComponent {
  search: string | undefined;
  mobileNavVisible = signal(false);
  activeInboxNav: string = 'Inbox';
  inboxNavs: any;
  tableData: any;
  selectedRows: any = [];
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
        title: 'Navigation',
        navs: [
          { name: 'Inbox', icon: 'pi pi-inbox' },
          { name: 'Starry', icon: 'pi pi-star' },
          { name: 'Drafts', icon: 'pi pi-file-o' },
          { name: 'Important', icon: 'pi pi-file-import' },
          { name: 'Sent', icon: 'pi pi-send' },
          { name: 'Archive', icon: 'pi pi-inbox' },
          { name: 'Spam', icon: 'pi pi-info-circle' },
          { name: 'Trash', icon: 'pi pi-trash' },
        ],
      },
      {
        title: 'Other',
        navs: [
          { name: 'Security', icon: 'pi pi-tag' },
          { name: 'Update', icon: 'pi pi-tag' },
          { name: 'Marketing', icon: 'pi pi-tag' },
          { name: 'HR', icon: 'pi pi-tag' },
        ],
      },
    ];

    this.tableData = [
      {
        id: 1,
        bookmarked: false,
        image: 'https://www.primefaces.org/cdn/primevue/images/landing/apps/avatar12.jpg',
        active: false,
        name: 'Brook Simmons',
        type: 'Security',
        time: '3:24 PM',
        title: 'Important Account Update',
        message: "Dear customer, we've made updates to enhance your account security. Please log in to review and complete the necessary steps. Thank you for choosing ABC Corporation.",
      },
      {
        id: 2,
        bookmarked: false,
        image: 'https://www.primefaces.org/cdn/primevue/images/landing/apps/avatar2.png',
        active: false,
        name: 'Dianne Russell',
        type: 'Update',
        time: '11:24 AM',
        title: 'Weekly Project Update',
        message: 'Hi team, attached is the weekly project update. Kindly review the progress and come prepared for our discussion in the upcoming meeting on [Date and Time].',
      },
      {
        id: 3,
        bookmarked: true,
        image: 'https://www.primefaces.org/cdn/primevue/images/landing/apps/avatar13.jpg',
        active: false,
        name: 'Amy Elsner',
        type: 'Security',
        time: '9:24 AM',
        title: 'Urgent: Security Alert - Account Compromise',
        message: 'Dear user, we detected unauthorized access to your account. Take immediate action to secure your account. Follow the provided link to reset your password. Thank you.',
      },
      {
        id: 4,
        bookmarked: false,
        image: 'https://www.primefaces.org/cdn/primevue/images/landing/apps/main-avatar.png',
        active: false,
        name: 'Jacob Jones',
        type: 'Marketing',
        time: 'Jan 21',
        title: 'Exclusive Offer Inside - Limited Time Only',
        message: "Greetings, check out our exclusive offer! Don't miss this limited-time deal. Details enclosed in the attached flyer. Act fast; the offer expires on [Date].",
      },
      {
        id: 5,
        bookmarked: false,
        image: '',
        active: false,
        name: 'Cameron Watson',
        capName: 'CW',
        type: 'HR',
        time: 'Jan 15',
        title: 'Employee Appreciation Event - Save the Date',
        message: 'Hello team, mark your calendars for our upcoming Employee Appreciation Event on [Date]. Stay tuned for more details and get ready for a day of celebration!',
      },
      {
        id: 6,
        bookmarked: true,
        image: '',
        active: false,
        name: 'Wade Warren',
        capName: 'WW',
        type: 'Invoice',
        time: 'Jan 12',
        title: 'Your Recent Purchase - Order Confirmation',
        message: 'Hi Wade Warren, secure your spot at the XYZ Conference 2024 with early bird registration. Enjoy discounted rates until [Date].',
      },
      {
        id: 7,
        bookmarked: false,
        image: 'https://www.primefaces.org/cdn/primevue/images/landing/apps/avatar7.png',
        active: false,
        name: 'Guy Hawkins',
        type: 'Events',
        time: 'Jan 11',
        title: 'Early Bird Registration Open - XYZ Conference 2024',
        message: ' Attention users, we have scheduled system maintenance on Jan 17. Expect minimal service disruption during this period. Thank you for your understanding.',
      },
      {
        id: 8,
        bookmarked: false,
        image: 'https://www.primefaces.org/cdn/primevue/images/landing/apps/avatar8.png',
        active: false,
        name: 'Annette Black',
        type: '',
        time: 'Jan 8',
        title: 'Upcoming System Maintenance Notice',
        message: "Dear valued customer, as a token of appreciation, we're offering exclusive discounts for VIP customers. Explore the savings in the attached catalog. Expires [Date].",
      },
      {
        id: 9,
        bookmarked: true,
        image: 'https://www.primefaces.org/cdn/primevue/images/landing/apps/avatar10.jpg',
        active: false,
        name: 'Darrell Steward',
        type: 'Discount',
        time: 'Jan 4',
        title: 'Special Discounts for VIP Customers',
        message: 'Hello Darrell Steward, stay updated with our latest news and highlights in the January edition of our newsletter. Enjoy the read!',
      },
      {
        id: 10,
        bookmarked: true,
        image: '',
        active: false,
        name: 'Jerome Bell',
        capName: 'JB',
        type: 'Newsletter',
        time: 'Jan 2',
        title: 'Monthly Newsletter - January Edition',
        message: "Dear user, we've updated our Terms of Service. Please review the changes to ensure compliance. Your continued use of our services implies acceptance. Thank you.",
      },
    ];
  }

  selectNavItem(navName: string) {
    this.activeInboxNav = navName;
    this.mobileNavVisible.set(false);
  }
}