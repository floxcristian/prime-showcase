export interface ChatMessage {
  id: number;
  attachment: string;
  name: string;
  image: string;
  capName: string;
  type: 'received' | 'sent';
  message: string;
}
