import { Injectable, Logger } from '@nestjs/common';
import { AgentTool } from './tool.interface';
import { AiEngineService } from '../../ai-engine/ai-engine.service';
import { VectorDbService } from '../../../core/vector-db/vector-db.service';

@Injectable()
export class QuotationGeneratorTool implements AgentTool {
  name = 'quotation_generator';
  description = 'Generates a professional Quotation for a client based on client profiles, rate cards, and katalog products retrieved from RAG database.';
  parameters = {
    type: 'object',
    properties: {
      clientName: {
        type: 'string',
        description: 'Name of the client (e.g. "PT Teknologi Nusantara").',
      },
      itemsRequested: {
        type: 'string',
        description: 'Items, services, or products requested by the client (e.g., "Sewa Coworking Dedicated Desk 5 pax").',
      },
    },
    required: ['clientName', 'itemsRequested'],
  };

  private readonly logger = new Logger(QuotationGeneratorTool.name);

  constructor(
    private readonly aiEngine: AiEngineService,
    private readonly vectorDb: VectorDbService,
  ) {}

  async execute(args: { clientName: string; itemsRequested: string }): Promise<any> {
    this.logger.log(`Executing Quotation Generator Tool for Client: ${args.clientName}`);

    // Retrieve client details from pgvector RAG database
    const clientQueryEmbedding = await this.aiEngine.generateEmbeddings(args.clientName);
    const clientMatches = await this.vectorDb.query(clientQueryEmbedding, 3);
    const clientContext = clientMatches.map((m) => m.metadata?.text).join('\n\n');

    // Retrieve product catalog & rate card details from RAG
    const itemQueryEmbedding = await this.aiEngine.generateEmbeddings(args.itemsRequested);
    const itemMatches = await this.vectorDb.query(itemQueryEmbedding, 5);
    const itemContext = itemMatches.map((m) => m.metadata?.text).join('\n\n');

    const systemPrompt = `You are a professional Quotation Specialist at PT SAI Inspirasi Kolaborasi.
Your task is to generate a comprehensive, professional business quotation strictly using the provided client profile, product catalog, and rate card context.

Do not hallucinate or make up prices or terms that are not matching the provided context. If information is missing, state it clearly in the notes instead of fabricating.

Ensure the quotation includes:
1. Header: PT SAI Inspirasi Kolaborasi (Co-working space & business services).
2. Reference: Quotation Number (QUO-${Date.now().toString().substring(7)}) and Date (Current date).
3. Client Information: Details of the client derived from client context.
4. Description of Goods/Services: Table of requested items with pricing from catalog/rate cards.
5. Totals: Subtotal, VAT (if applicable), and Total.
6. Payment Terms & T&C: Strictly based on retrieved company policies.

Context for Client:
${clientContext}

Context for Products / Rates:
${itemContext}

Generate the response in clear, formal business language (Indonesian/English depending on context).`;

    const userPrompt = `Generate a quotation for ${args.clientName} requesting: "${args.itemsRequested}".`;

    const quotation = await this.aiEngine.generateChatCompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], { temperature: 0.2 });

    return {
      clientName: args.clientName,
      itemsRequested: args.itemsRequested,
      quotationText: quotation,
    };
  }
}
