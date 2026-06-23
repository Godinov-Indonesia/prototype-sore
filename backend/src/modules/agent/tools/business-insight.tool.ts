import { Injectable, Logger } from '@nestjs/common';
import { AgentTool } from './tool.interface';
import { AiEngineService } from '../../ai-engine/ai-engine.service';
import { VectorDbService } from '../../../core/vector-db/vector-db.service';

@Injectable()
export class BusinessInsightTool implements AgentTool {
  name = 'business_insight';
  description = 'Analyzes company operational metrics, inventory logs, sales performance, and vendor reports from RAG database to generate structured business insights, strategies, plans, and vendor analysis.';
  parameters = {
    type: 'object',
    properties: {
      focusTopic: {
        type: 'string',
        description: 'Optional focus area for the insight report (e.g. "sales performance", "vendor analysis", "inventory logistics", or "general strategy").',
      },
    },
  };

  private readonly logger = new Logger(BusinessInsightTool.name);

  constructor(
    private readonly aiEngine: AiEngineService,
    private readonly vectorDb: VectorDbService,
  ) {}

  async execute(args: { focusTopic?: string }): Promise<any> {
    const focus = args.focusTopic || 'general strategy';
    this.logger.log(`Executing Business Insight Tool with focus on: ${focus}`);

    // Retrieve relevant documents based on the focus area
    let searchQueries: string[] = [];

    if (focus.includes('vendor')) {
      searchQueries = ['rapor performance vendor', 'vendor performance rating', 'kualitas vendor'];
    } else if (focus.includes('sales')) {
      searchQueries = ['log kinerja sales sales performance', 'sales revenue pencapaian target'];
    } else if (focus.includes('inventory') || focus.includes('logistic')) {
      searchQueries = ['log pergerakan barang inventory movement', 'master data barang purchase request'];
    } else {
      // General focus: compile from all types of data
      searchQueries = [
        'data metrik operasional',
        'rapor performance vendor',
        'log kinerja sales',
        'log pergerakan barang',
      ];
    }

    let compiledContext = '';

    for (const q of searchQueries) {
      const embedding = await this.aiEngine.generateEmbeddings(q);
      const matches = await this.vectorDb.query(embedding, 3);
      compiledContext += `\n\n--- Source Query: ${q} ---\n` + matches.map((m) => m.metadata?.text).join('\n\n');
    }

    const systemPrompt = `You are a Chief Strategy Officer & Principal Business Analyst.
Your task is to analyze the compiled corporate operational data, logs, and reports to deliver deep business insights, strategic plans, and vendor analysis.

CRITICAL: Your analysis must be strictly data-driven and directly based on the numbers, rates, targets, and dates present in the context. Do not make up metrics, names of vendors, or sales figures.

Structure the report with the following sections:
1. Executive Summary
2. Detailed Performance Insights (use specific metrics, names, percentages, and amounts from the data).
3. Strategic Recommendations & Action Plan (practical steps, resource allocations, and process improvements).
4. Vendor Performance and Risks Analysis (list specific vendors, their ratings, delivery rates, and quality issues found in the RAG data).

Data Context:
${compiledContext}

Generate the response in clear, formal business language (Indonesian/English depending on context).`;

    const userPrompt = `Analyze the data and generate a business insight report with focus on: "${focus}".`;

    const report = await this.aiEngine.generateChatCompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], { temperature: 0.2 });

    return {
      focusTopic: focus,
      reportText: report,
    };
  }
}
