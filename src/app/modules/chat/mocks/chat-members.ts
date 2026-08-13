import { demoAsset } from '../../../shared/constants/demo-assets';
import { ChatMember } from '../models/chat-member.interface';

export const CHAT_MEMBERS: ChatMember[] = [
  {
    name: 'Robin Jonas',
    capName: 'RJ',
    image: demoAsset('avatar2.png'),
  },
  {
    name: 'Cameron Williamson',
    capName: 'CW',
    image: demoAsset('avatar11.jpg'),
  },
  {
    name: 'Eleanor Pena',
    capName: 'EP',
    image: demoAsset('avatar5.png'),
  },
  {
    name: 'Arlene McCoy',
    capName: 'AM',
    image: demoAsset('avatar8.png'),
  },
  { name: 'Dianne Russell', capName: 'DR', image: '' },
];
