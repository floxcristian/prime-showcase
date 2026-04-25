// Angular
import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
// PrimeNG
import { MenuItem } from 'primeng/api';
import { BadgeModule } from 'primeng/badge';
import { SelectButton } from 'primeng/selectbutton';
import { AvatarModule } from 'primeng/avatar';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MenuModule } from 'primeng/menu';
import { Skeleton } from 'primeng/skeleton';
import { Textarea } from 'primeng/textarea';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TooltipModule } from 'primeng/tooltip';
// Shared
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
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

const NG_MODULES = [FormsModule, NgClass];
const PRIME_MODULES = [
  BadgeModule,
  SelectButton,
  AvatarModule,
  IconField,
  InputIcon,
  ButtonModule,
  InputTextModule,
  MenuModule,
  Textarea,
  ToggleSwitchModule,
  TooltipModule,
  Skeleton,
];
const LOCAL_COMPONENTS = [EmptyStateComponent];

@Component({
  selector: 'app-chat',
  imports: [NG_MODULES, PRIME_MODULES, LOCAL_COMPONENTS],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'flex-1 h-full overflow-y-auto overflow-x-clip overflow-hidden flex border border-surface rounded-2xl',
  },
})
export class ChatComponent {
  options: string[] = ['Chat', 'Llamada'];
  mediaOptions: string[] = ['Multimedia', 'Enlace', 'Documentos'];
  value = signal('Chat');
  media = signal('Multimedia');
  search = signal('');

  // Profile
  activeChat = signal('Equipo PrimeTek');
  notification = signal(true);
  sound = signal(false);
  download = signal(false);

  /**
   * Master-detail state para mobile (<lg). En desktop los dos paneles son
   * visibles simultáneamente y este signal no afecta el layout (las clases
   * `lg:flex` fuerzan visibilidad en el breakpoint superior).
   *
   * En mobile:
   *   - `false` (default) → lista de chats full-width, messages panel oculto
   *   - `true`            → messages panel full-width (con back button),
   *                         lista oculta
   *
   * Patrón WhatsApp / Telegram / Gmail mobile: drill-in de un solo nivel.
   * El desktop 3-panel es denso y funciona con ratones; mobile requiere
   * que cada panel respire en full-width para ser táctilmente usable.
   */
  protected readonly detailOpen = signal(false);

  /**
   * Trigger del drill-in: seleccionar un chat. Actualiza `activeChat`
   * (driver del highlight en la lista + contenido del messages panel) y
   * abre el detail. En desktop el `detailOpen=true` es no-op (las clases
   * `lg:flex` dominan); en mobile switch a messages panel.
   */
  protected onChatSelected(name: string): void {
    this.activeChat.set(name);
    this.detailOpen.set(true);
  }

  /**
   * Back del drill-in mobile. Regresa a la lista de chats. Desktop ignora
   * (el botón back está con `lg:hidden`).
   */
  protected closeDetail(): void {
    this.detailOpen.set(false);
  }

  chats: ChatItem[] = CHATS;
  filteredChats = computed<ChatItem[]>(() => {
    const term = this.search().trim().toLowerCase();
    if (!term) return this.chats;
    return this.chats.filter(
      c =>
        c.name.toLowerCase().includes(term) ||
        c.lastMessage.toLowerCase().includes(term)
    );
  });
  menuItems: MenuItem[] = CHAT_MENU_ITEMS;
  chatMessages: ChatMessage[] = CHAT_MESSAGES;
  members: ChatMember[] = CHAT_MEMBERS;
  chatMedia: string[] = CHAT_MEDIA;

}
