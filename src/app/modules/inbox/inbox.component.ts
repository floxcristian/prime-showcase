// Angular
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
import { TooltipModule } from 'primeng/tooltip';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { TRANSPARENT_TABLE_TOKENS } from '../../shared/tokens/table-tokens';
import { InboxNavGroup, InboxMessage } from './models/inbox.interface';
import {
  INBOX_NAV_GROUPS,
  INBOX_MESSAGES,
} from './constants/inbox-data';

const NG_MODULES = [FormsModule, NgClass];
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
  TooltipModule,
];
const LOCAL_COMPONENTS = [EmptyStateComponent];
@Component({
  selector: 'app-inbox',
  imports: [NG_MODULES, PRIME_MODULES, LOCAL_COMPONENTS],
  templateUrl: './inbox.component.html',
  styleUrl: './inbox.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'flex gap-4 h-full flex-1 w-full overflow-auto',
  },
})
export class InboxComponent {
  search = signal<string | undefined>(undefined);

  activeInboxNav = signal('Bandeja');

  inboxNavs: InboxNavGroup[] = INBOX_NAV_GROUPS;

  tableData = signal<InboxMessage[]>(INBOX_MESSAGES);

  filteredTableData = computed<InboxMessage[]>(() => {
    const term = (this.search() ?? '').trim().toLowerCase();
    if (!term) return this.tableData();
    return this.tableData().filter(
      m =>
        m.name.toLowerCase().includes(term) ||
        m.title.toLowerCase().includes(term) ||
        m.message.toLowerCase().includes(term)
    );
  });

  selectedRows = signal<InboxMessage[]>([]);

  toggleBookmark(message: InboxMessage): void {
    this.tableData.update(data =>
      data.map(d => d === message ? { ...d, bookmarked: !d.bookmarked } : d)
    );
  }

  tableTokens = {
    ...TRANSPARENT_TABLE_TOKENS,
    header: { ...TRANSPARENT_TABLE_TOKENS.header, padding: '1rem' },
  };
}
