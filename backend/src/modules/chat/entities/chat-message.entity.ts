export class ChatMessageEntity {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  createdAt: Date;
}
