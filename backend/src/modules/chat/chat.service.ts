import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { SendMessageDto } from './dto/send-message.dto';

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  async createSession(dto: CreateSessionDto) {
    return this.prisma.session.create({
      data: {
        title: dto.title,
      },
    });
  }

  async listSessions() {
    return this.prisma.session.findMany({
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findSession(id: string) {
    const session = await this.prisma.session.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!session) {
      throw new NotFoundException(`Chat session with ID "${id}" not found`);
    }

    return session;
  }

  async addMessage(sessionId: string, dto: SendMessageDto) {
    // Verify session exists
    await this.findSession(sessionId);

    const message = await this.prisma.message.create({
      data: {
        sessionId,
        role: dto.role,
        content: dto.content,
      },
    });

    // Update session timestamp
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() },
    });

    return message;
  }

  async deleteSession(id: string) {
    await this.findSession(id);
    return this.prisma.session.delete({
      where: { id },
    });
  }
}
