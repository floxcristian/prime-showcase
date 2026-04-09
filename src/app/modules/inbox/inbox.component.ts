// Angular
import {
  ChangeDetectionStrategy,
  Component,
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
import {
  INBOX_NAV_GROUPS,
  INBOX_MESSAGES,
} from './constants/inbox-data';

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
export class InboxComponent {
  search: string | undefined;

  activeInboxNav: string = 'Bandeja';

  inboxNavs: InboxNavGroup[] = INBOX_NAV_GROUPS;

  tableData: InboxMessage[] = INBOX_MESSAGES;

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
}
