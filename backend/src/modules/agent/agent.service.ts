import { Injectable, Logger } from '@nestjs/common';
import { AiEngineService } from '../ai-engine/ai-engine.service';
import { DbQueryTool } from './tools/db-query.tool';
import { WebSearchTool } from './tools/web-search.tool';
import { MeetingSummarizerTool } from './tools/meeting-summarizer.tool';
import { QuotationGeneratorTool } from './tools/quotation-generator.tool';
import { ProposalGeneratorTool } from './tools/proposal-generator.tool';
import { FollowupGeneratorTool } from './tools/followup-generator.tool';
import { BusinessInsightTool } from './tools/business-insight.tool';
import { AgentTool } from './tools/tool.interface';
import { SYSTEM_PROMPTS } from '../ai-engine/prompt.templates';
import { PrismaService } from '../../core/database/prisma.service';
import { Subject, Observable } from 'rxjs';
import { MessageEvent } from '@nestjs/common';

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);
  private readonly toolsMap: Map<string, AgentTool> = new Map();

  constructor(
    private readonly aiEngine: AiEngineService,
    private readonly dbQueryTool: DbQueryTool,
    private readonly webSearchTool: WebSearchTool,
    private readonly meetingSummarizerTool: MeetingSummarizerTool,
    private readonly quotationGeneratorTool: QuotationGeneratorTool,
    private readonly proposalGeneratorTool: ProposalGeneratorTool,
    private readonly followupGeneratorTool: FollowupGeneratorTool,
    private readonly businessInsightTool: BusinessInsightTool,
    private readonly prisma: PrismaService,
  ) {
    // Register tools
    this.toolsMap.set(this.dbQueryTool.name, this.dbQueryTool);
    this.toolsMap.set(this.webSearchTool.name, this.webSearchTool);
    this.toolsMap.set(this.meetingSummarizerTool.name, this.meetingSummarizerTool);
    this.toolsMap.set(this.quotationGeneratorTool.name, this.quotationGeneratorTool);
    this.toolsMap.set(this.proposalGeneratorTool.name, this.proposalGeneratorTool);
    this.toolsMap.set(this.followupGeneratorTool.name, this.followupGeneratorTool);
    this.toolsMap.set(this.businessInsightTool.name, this.businessInsightTool);
  }

  async runAgent(prompt: string, file?: Express.Multer.File): Promise<any> {
    let finalPrompt = prompt;
    if (file) {
      const fileContent = file.buffer.toString('utf-8');
      finalPrompt = `User Prompt: ${prompt}\n\n--- Attached File Content (${file.originalname}) ---\n${fileContent}`;
      this.logger.log(`Received file attachment: ${file.originalname} (${file.size} bytes)`);
    }

    this.logger.log(`Running Agent with prompt: "${prompt}"`);
    const client = this.aiEngine.getOpenAiClient();

    if (!client) {
      this.logger.warn('OpenAI/Sumopod Client not available. Simulating agent tool selection...');
      return this.simulateAgent(finalPrompt);
    }

    try {
      const messages: any[] = [
        { role: 'system', content: SYSTEM_PROMPTS.DEFAULT_ASSISTANT },
        { role: 'user', content: finalPrompt },
      ];

      // Format tools for OpenAI
      const formattedTools = Array.from(this.toolsMap.values()).map((tool) => ({
        type: 'function' as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      }));

      // Call OpenAI with tools
      const response = await client.chat.completions.create({
        model: 'deepseek-v4-flash', // Default to Sumopod model
        messages,
        tools: formattedTools,
        tool_choice: 'auto',
      });

      const choice = response.choices[0];
      const toolCalls = choice.message?.tool_calls;

      if (toolCalls && toolCalls.length > 0) {
        // Execute tool calls
        const results: any[] = [];
        messages.push(choice.message); // Add assistant message containing tool calls

        for (const toolCall of toolCalls) {
          const tc = toolCall as any;
          const toolName = tc.function.name;
          const args = JSON.parse(tc.function.arguments);
          this.logger.log(`Executing tool: ${toolName} with args: ${JSON.stringify(args)}`);

          const tool = this.toolsMap.get(toolName);
          if (!tool) {
            throw new Error(`Tool "${toolName}" is not registered.`);
          }

          const output = await tool.execute(args);
          results.push({
            toolName,
            args,
            output,
          });

          // Append tool result message
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolName,
            content: JSON.stringify(output),
          });
        }

        // Send back to OpenAI for final answer
        const finalResponse = await client.chat.completions.create({
          model: 'deepseek-v4-flash',
          messages,
        });

        return {
          answer: finalResponse.choices[0].message?.content || '',
          steps: results,
        };
      }

      // No tool was called
      return {
        answer: choice.message?.content || '',
        steps: [],
      };
    } catch (error: any) {
      this.logger.error(`Agent running failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Local fallback mock execution flow for easy testing
  private async simulateAgent(prompt: string): Promise<any> {
    const promptLower = prompt.toLowerCase();
    const steps: any[] = [];

    if (promptLower.includes('meeting') || promptLower.includes('summar') || promptLower.includes('rapat') || promptLower.includes('transkrip')) {
      this.logger.log('[Simulated Agent] Routing to MeetingSummarizerTool...');
      let meetingText = '';
      if (prompt.includes('--- Attached File Content')) {
        meetingText = prompt.split('--- Attached File Content')[1].trim();
      }
      const output = await this.meetingSummarizerTool.execute({
        meetingText: meetingText || undefined,
        searchQuery: 'transkrip rapat',
      });
      steps.push({
        toolName: this.meetingSummarizerTool.name,
        args: { searchQuery: 'transkrip rapat', meetingText: meetingText ? '(attached file content)' : undefined },
        output,
      });
      return {
        answer: output.error || output.summary || JSON.stringify(output),
        steps,
      };
    }

    if (promptLower.includes('quotation') || promptLower.includes('penawaran') || promptLower.includes('harga')) {
      this.logger.log('[Simulated Agent] Routing to QuotationGeneratorTool...');
      // Try to extract client name from prompt or use default mock
      const clientName = promptLower.includes('klien') || promptLower.includes('client') ? 'PT Mahakarya Indonesia' : 'PT Teknologi Nusantara';
      const items = 'Sewa dedicated desk & coworking space';
      const output = await this.quotationGeneratorTool.execute({ clientName, itemsRequested: items });
      steps.push({
        toolName: this.quotationGeneratorTool.name,
        args: { clientName, itemsRequested: items },
        output,
      });
      return {
        answer: output.quotationText || JSON.stringify(output),
        steps,
      };
    }

    if (promptLower.includes('proposal') || promptLower.includes('proyek') || promptLower.includes('solusi')) {
      this.logger.log('[Simulated Agent] Routing to ProposalGeneratorTool...');
      const clientName = 'PT Mahakarya Indonesia';
      const scope = 'Private office setup 15 pax';
      const output = await this.proposalGeneratorTool.execute({ clientName, projectScope: scope });
      steps.push({
        toolName: this.proposalGeneratorTool.name,
        args: { clientName, projectScope: scope },
        output,
      });
      return {
        answer: output.proposalText || JSON.stringify(output),
        steps,
      };
    }

    if (promptLower.includes('follow up') || promptLower.includes('follow-up') || promptLower.includes('leads') || promptLower.includes('sales log')) {
      this.logger.log('[Simulated Agent] Routing to FollowupGeneratorTool...');
      const clientName = 'PT Mahakarya Indonesia';
      const output = await this.followupGeneratorTool.execute({ clientName });
      steps.push({
        toolName: this.followupGeneratorTool.name,
        args: { clientName },
        output,
      });
      return {
        answer: output.followUpText || JSON.stringify(output),
        steps,
      };
    }

    if (promptLower.includes('insight') || promptLower.includes('strategi') || promptLower.includes('vendor') || promptLower.includes('metrik')) {
      this.logger.log('[Simulated Agent] Routing to BusinessInsightTool...');
      const focusTopic = promptLower.includes('vendor') ? 'vendor analysis' : 'general strategy';
      const output = await this.businessInsightTool.execute({ focusTopic });
      steps.push({
        toolName: this.businessInsightTool.name,
        args: { focusTopic },
        output,
      });
      return {
        answer: output.reportText || JSON.stringify(output),
        steps,
      };
    }

    if (promptLower.includes('session') || promptLower.includes('message') || promptLower.includes('database')) {
      // Simulate Database Tool execution
      this.logger.log('[Simulated Agent] Routing to DbQueryTool...');
      const metric = promptLower.includes('message') ? 'messages_count' : 'sessions_count';
      const output = await this.dbQueryTool.execute({ metric: metric as any });
      steps.push({
        toolName: this.dbQueryTool.name,
        args: { metric },
        output,
      });
      return {
        answer: `[Agent Mock Answer] I queried the database for you. Currently, the count is: ${JSON.stringify(output)}.`,
        steps,
      };
    }

    if (promptLower.includes('search') || promptLower.includes('find') || promptLower.includes('who') || promptLower.includes('weather')) {
      // Simulate Web Search Tool execution
      this.logger.log('[Simulated Agent] Routing to WebSearchTool...');
      const query = prompt;
      const output = await this.webSearchTool.execute({ query });
      steps.push({
        toolName: this.webSearchTool.name,
        args: { query },
        output,
      });
      return {
        answer: `[Agent Mock Answer] I searched the web for "${query}". The result returned is: ${output.results[0].snippet}.`,
        steps,
      };
    }

    // Default direct assistant reply
    return {
      answer: `[Agent Mock Answer] Hello! You asked: "${prompt}". Configure SUMOPOD_API_KEY to test actual agent routing and tool execution.`,
      steps,
    };
  }

  async getTasks() {
    return this.prisma.task.findMany({
      include: {
        employee: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getReminders() {
    return this.prisma.reminder.findMany({
      orderBy: { remindAt: 'asc' },
    });
  }

  async getEmployees() {
    return this.prisma.employee.findMany({
      orderBy: { namaLengkap: 'asc' },
    });
  }

  streamAgent(prompt: string, file?: Express.Multer.File): Observable<MessageEvent> {
    const subject = new Subject<MessageEvent>();

    this.processStreamAgent(prompt, file, subject).catch((err) => {
      subject.next({ type: 'error', data: { message: err.message } });
      subject.complete();
    });

    return subject.asObservable();
  }

  private async processStreamAgent(prompt: string, file: Express.Multer.File | undefined, subject: Subject<MessageEvent>) {
    // Yield execution to allow NestJS to establish connection
    await new Promise((resolve) => setTimeout(resolve, 200));

    let finalPrompt = prompt;
    if (file) {
      const fileContent = file.buffer.toString('utf-8');
      finalPrompt = `User Prompt: ${prompt}\n\n--- Attached File Content (${file.originalname}) ---\n${fileContent}`;
      this.logger.log(`Stream Agent received file attachment: ${file.originalname}`);
    }

    const promptLower = finalPrompt.toLowerCase();

    // 1. Emit status: thinking
    subject.next({ type: 'status', data: { status: 'thinking' } });

    // 2. Identify the correct tool
    let matchedTool: AgentTool | null = null;
    let toolArgs: any = {};

    if (promptLower.includes('meeting') || promptLower.includes('summar') || promptLower.includes('rapat') || promptLower.includes('transkrip')) {
      matchedTool = this.meetingSummarizerTool;
      let meetingText = '';
      if (finalPrompt.includes('--- Attached File Content')) {
        meetingText = finalPrompt.split('--- Attached File Content')[1].trim();
      }
      toolArgs = {
        meetingText: meetingText || undefined,
        searchQuery: 'transkrip rapat',
      };
    } else if (promptLower.includes('quotation') || promptLower.includes('penawaran') || promptLower.includes('harga')) {
      matchedTool = this.quotationGeneratorTool;
      const clientName = promptLower.includes('klien') || promptLower.includes('client') ? 'PT Mahakarya Indonesia' : 'PT Teknologi Nusantara';
      toolArgs = { clientName, itemsRequested: 'Sewa dedicated desk & coworking space' };
    } else if (promptLower.includes('proposal') || promptLower.includes('proyek') || promptLower.includes('solusi')) {
      matchedTool = this.proposalGeneratorTool;
      toolArgs = { clientName: 'PT Mahakarya Indonesia', projectScope: 'Private office setup 15 pax' };
    } else if (promptLower.includes('follow up') || promptLower.includes('follow-up') || promptLower.includes('leads') || promptLower.includes('sales log')) {
      matchedTool = this.followupGeneratorTool;
      toolArgs = { clientName: 'PT Mahakarya Indonesia' };
    } else if (promptLower.includes('insight') || promptLower.includes('strategi') || promptLower.includes('vendor') || promptLower.includes('metrik')) {
      matchedTool = this.businessInsightTool;
      toolArgs = { focusTopic: promptLower.includes('vendor') ? 'vendor analysis' : 'general strategy' };
    } else if (promptLower.includes('session') || promptLower.includes('message') || promptLower.includes('database')) {
      matchedTool = this.dbQueryTool;
      toolArgs = { metric: promptLower.includes('message') ? 'messages_count' : 'sessions_count' };
    } else {
      matchedTool = this.webSearchTool;
      toolArgs = { query: prompt };
    }

    // 3. Emit status: executing_tool
    subject.next({ type: 'status', data: { status: 'executing_tool', toolName: matchedTool.name, args: toolArgs } });

    // 4. Execute tool
    const output = await matchedTool.execute(toolArgs);

    // 5. Emit status: generating_response
    subject.next({ type: 'status', data: { status: 'generating_response' } });

    // 6. Stream tool output
    const resultText = output.quotationText || output.proposalText || output.followUpText || output.reportText || output.summary || JSON.stringify(output, null, 2);
    
    const words = resultText.split(' ');
    for (const word of words) {
      await new Promise((r) => setTimeout(r, 40));
      subject.next({ type: 'content', data: { chunk: word + ' ' } });
    }

    // 7. Emit final result
    subject.next({ type: 'result', data: output });

    // 8. Emit status: done & complete stream
    subject.next({ type: 'status', data: { status: 'done' } });
    subject.complete();
  }
}
