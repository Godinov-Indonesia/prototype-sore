import { Injectable, Logger } from '@nestjs/common';
import { AgentTool } from './tool.interface';
import { AiEngineService } from '../../ai-engine/ai-engine.service';
import { VectorDbService } from '../../../core/vector-db/vector-db.service';

@Injectable()
export class ProposalGeneratorTool implements AgentTool {
  name = 'proposal_generator';
  description = 'Generates a professional business Proposal for a client based on client profiles, corporate SOPs, and service catalogs retrieved from RAG database.';
  parameters = {
    type: 'object',
    properties: {
      clientName: {
        type: 'string',
        description: 'Name of the client (e.g. "PT Mahakarya Indonesia").',
      },
      projectScope: {
        type: 'string',
        description: 'Scope or details of the solution being proposed (e.g. "Sewa private office 20 pax & event space").',
      },
    },
    required: ['clientName', 'projectScope'],
  };

  private readonly logger = new Logger(ProposalGeneratorTool.name);

  constructor(
    private readonly aiEngine: AiEngineService,
    private readonly vectorDb: VectorDbService,
  ) {}

  async execute(args: { clientName: string; projectScope: string }): Promise<any> {
    this.logger.log(`Executing Proposal Generator Tool for Client: ${args.clientName}`);

    // Retrieve client details from pgvector RAG database
    const clientQueryEmbedding = await this.aiEngine.generateEmbeddings(args.clientName);
    const clientMatches = await this.vectorDb.query(clientQueryEmbedding, 3);
    const clientContext = clientMatches.map((m) => m.metadata?.text).join('\n\n');

    // Retrieve corporate profile / SOPs / offerings from RAG
    const sopQueryEmbedding = await this.aiEngine.generateEmbeddings(`PT SAI Inspirasi Kolaborasi coworking space fasilitas SOP`);
    const sopMatches = await this.vectorDb.query(sopQueryEmbedding, 5);
    const sopContext = sopMatches.map((m) => m.metadata?.text).join('\n\n');

    const systemPrompt = `You are a corporate Business Development Manager at PT SAI Inspirasi Kolaborasi.
Your task is to generate a professional, compelling, and structured corporate business proposal.
Use ONLY the provided context (Client profile and PT SAI Inspirasi Kolaborasi SOPs/facilities) to construct the proposal.

Do not fabricate company statistics, prices, or locations. All plans and specifications must strictly mirror the company's real data from the context.

The proposal structure must include:
1. Title: Business Proposal for ${args.clientName}
2. Executive Summary
3. Client Profile & Business Need Assessment
4. Proposed Solution: Detailed workspace offering, including facilities and benefits (co-working, dedicated desks, meeting rooms, etc. as specified in context).
5. Commercial Terms (pricing estimate using rate cards from context).
6. About PT SAI Inspirasi Kolaborasi (facilities, values, locations from SOP/policies context).

Context for Client:
${clientContext}

Context for SOP & Policies:
${sopContext}

Generate the response in clear, professional corporate language (Indonesian/English depending on context).`;

    const userPrompt = `Generate a business proposal for ${args.clientName} with the following scope: "${args.projectScope}".`;

    const proposal = await this.aiEngine.generateChatCompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], { temperature: 0.3 });

    return {
      clientName: args.clientName,
      projectScope: args.projectScope,
      proposalText: proposal,
    };
  }
}
