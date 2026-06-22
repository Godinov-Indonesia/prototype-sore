import { Injectable } from '@nestjs/common';
import { AgentTool } from './tool.interface';
import { PrismaService } from '../../../core/database/prisma.service';

@Injectable()
export class DbQueryTool implements AgentTool {
  name = 'db_query';
  description = 'Query basic statistics from the internal chat application database, such as counting total chat sessions or total messages.';
  parameters = {
    type: 'object',
    properties: {
      metric: {
        type: 'string',
        enum: ['sessions_count', 'messages_count'],
        description: 'The internal metric to retrieve.',
      },
    },
    required: ['metric'],
  };

  constructor(private readonly prisma: PrismaService) {}

  async execute(args: { metric: 'sessions_count' | 'messages_count' }): Promise<any> {
    if (args.metric === 'sessions_count') {
      const count = await this.prisma.session.count();
      return { sessionsCount: count };
    } else if (args.metric === 'messages_count') {
      const count = await this.prisma.message.count();
      return { messagesCount: count };
    }
    return { error: 'Unknown metric' };
  }
}
