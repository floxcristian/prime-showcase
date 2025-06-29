// Angular
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
// PrimeNG
import { MenuItem } from 'primeng/api';
import { BadgeModule } from 'primeng/badge';
import { ChartModule } from 'primeng/chart';
import { SelectButton } from 'primeng/selectbutton';
import { AvatarModule } from 'primeng/avatar';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MenuModule } from 'primeng/menu';
import { Textarea } from 'primeng/textarea';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
// Mocks
import { CHATS } from './mocks/chats';
import { CHAT_MESSAGES } from './mocks/chat-messages';
import { CHAT_MEMBERS } from './mocks/chat-members';
import { CHAT_MEDIA } from './mocks/chat-media';
import { CHAT_MENU_ITEMS } from './constants/chat-menu-items';
// Models
import { ChatItem } from './models/chat-item.interface';
import { ChatMessage } from './models/chat-message.interface';
import { ChatMember } from './models/chat-member.interface';

const NG_MODULES = [CommonModule, FormsModule, RouterModule];
const PRIME_MODULES = [
  BadgeModule,
  ChartModule,
  SelectButton,
  AvatarModule,
  IconField,
  InputIcon,
  ButtonModule,
  InputTextModule,
  MenuModule,
  Textarea,
  ToggleSwitchModule,
];

@Component({
  selector: 'app-chat',
  imports: [NG_MODULES, PRIME_MODULES],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'flex-1 h-full overflow-y-auto overflow-x-clip overflow-hidden flex border border-surface rounded-2xl',
  },
})
export class ChatComponent {
  options: string[] = ['Chat', 'Call'];
  mediaOptions: string[] = ['Media', 'Link', 'Docs'];
  value: string = 'Chat';
  media: string = 'Media';
  search: string = '';

  // Profile
  activeChat: string = 'PrimeTek Team';
  notification: boolean = true;
  sound: boolean = false;
  download: boolean = false;

  chats: ChatItem[] = CHATS;
  menuItems: MenuItem[] = CHAT_MENU_ITEMS;
  chatMessages: ChatMessage[] = CHAT_MESSAGES;
  members: ChatMember[] = CHAT_MEMBERS;
  chatMedia: string[] = CHAT_MEDIA;

  ngOnInit() {}
}
