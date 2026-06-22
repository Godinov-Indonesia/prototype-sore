import { Injectable, Logger } from '@nestjs/common';
import { AiEngineService } from '../ai-engine/ai-engine.service';
import { DbQueryTool } from './tools/db-query.tool';
import { WebSearchTool } from './tools/web-search.tool';
import { AgentTool } from './tools/tool.interface';
import { SYSTEM_PROMPTS } from '../ai-engine/prompt.templates';

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);
  private readonly toolsMap: Map<string, AgentTool> = new Map();

  constructor(
    private readonly aiEngine: AiEngineService,
    private readonly dbQueryTool: DbQueryTool,
    private readonly webSearchTool: WebSearchTool,
  ) {
    // Register tools
    this.toolsMap.set(this.dbQueryTool.name, this.dbQueryTool);
    this.toolsMap.set(this.webSearchTool.name, this.webSearchTool);
  }

  async runAgent(prompt: string): Promise<any> {
    this.logger.log(`Running Agent with prompt: "${prompt}"`);
    const client = this.aiEngine.getOpenAiClient();

    if (!client) {
      this.logger.warn('OpenAI Client not available. Simulating agent tool selection...');
      return this.simulateAgent(prompt);
    }

    try {
      const messages: any[] = [
        { role: 'system', content: SYSTEM_PROMPTS.DEFAULT_ASSISTANT },
        { role: 'user', content: prompt },
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
        model: 'gpt-4o-mini',
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
          model: 'gpt-4o-mini',
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
    let answer = '';

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
      answer = `[Agent Mock Answer] I queried the database for you. Currently, the count is: ${JSON.stringify(output)}.`;
    } else if (promptLower.includes('search') || promptLower.includes('find') || promptLower.includes('who') || promptLower.includes('weather')) {
      // Simulate Web Search Tool execution
      this.logger.log('[Simulated Agent] Routing to WebSearchTool...');
      const query = prompt;
      const output = await this.webSearchTool.execute({ query });
      steps.push({
        toolName: this.webSearchTool.name,
        args: { query },
        output,
      });
      answer = `[Agent Mock Answer] I searched the web for "${query}". The result returned is: ${output.results[0].snippet}.`;
    } else {
      // Default direct assistant reply
      answer = `[Agent Mock Answer] Hello! You asked: "${prompt}". Configure OPENAI_API_KEY to test actual agent routing and tool execution.`;
    }

    return {
      answer,
      steps,
    };
  }
}
