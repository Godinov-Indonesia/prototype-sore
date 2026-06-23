import { Injectable, Logger } from '@nestjs/common';
import { AgentTool } from './tool.interface';
import { AiEngineService } from '../../ai-engine/ai-engine.service';
import { VectorDbService } from '../../../core/vector-db/vector-db.service';

@Injectable()
export class FollowupGeneratorTool implements AgentTool {
  name = 'followup_generator';
  description = 'Generates a personalized follow-up email/message for a client based on their past interaction history and notes retrieved from RAG database.';
  parameters = {
    type: 'object',
    properties: {
      clientName: {
        type: 'string',
        description: 'Name of the client or contact person (e.g. "PT Mahakarya Indonesia" or "Hanifan").',
      },
      contextTopic: {
        type: 'string',
        description: 'Optional additional context or focus topic for the follow-up (e.g. "Penawaran Coworking Space").',
      },
    },
    required: ['clientName'],
  };

  private readonly logger = new Logger(FollowupGeneratorTool.name);

  constructor(
    private readonly aiEngine: AiEngineService,
    private readonly vectorDb: VectorDbService,
  ) {}

  async execute(args: { clientName: string; contextTopic?: string }): Promise<any> {
    this.logger.log(`Executing Follow Up Generator Tool for Client: ${args.clientName}`);

    // Retrieve client details & interaction logs from pgvector RAG database
    // Querying using client name + "riwayat interaksi leads sales"
    const queryStr = `${args.clientName} riwayat interaksi leads sales status negosiasi kontak`;
    const interactionQueryEmbedding = await this.aiEngine.generateEmbeddings(queryStr);
    const matches = await this.vectorDb.query(interactionQueryEmbedding, 5);
    const interactionContext = matches.map((m) => m.metadata?.text).join('\n\n');

    const systemPrompt = `You are a professional Account Manager at PT SAI Inspirasi Kolaborasi.
Your task is to generate a personalized and professional follow-up email/message for the client.
You must base this message strictly on the client's past interaction history, dates, notes, and topics of interest retrieved from context.

Do not hallucinate meetings, quotes, or commitments that are not in the context.

Key elements of the follow-up:
1. Subject line (compelling and professional).
2. Salutation matching the contact name from the context.
3. Reference to the last interaction (e.g., date, topic discussed, or items pending).
4. Clear call-to-action (e.g., scheduling a call, asking for feedback on a proposal, or setting up a tour).
5. Professional closing signature.

Context for Client Interaction History:
${interactionContext}

Generate the response in clear, professional business language (Indonesian/English depending on context).`;

    const userPrompt = `Generate a follow-up email for ${args.clientName}${args.contextTopic ? ` regarding ${args.contextTopic}` : ''}.`;

    const followUp = await this.aiEngine.generateChatCompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], { temperature: 0.2 });

    return {
      clientName: args.clientName,
      followUpText: followUp,
    };
  }
}
