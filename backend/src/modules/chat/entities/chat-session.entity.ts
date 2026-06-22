import { Message } from '@prisma/client';

export class ChatSessionEntity {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messages?: Message[];
}
