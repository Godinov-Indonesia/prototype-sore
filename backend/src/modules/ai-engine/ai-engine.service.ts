import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class AiEngineService implements OnModuleInit {
  private readonly logger = new Logger(AiEngineService.name);
  private openai: OpenAI | null = null;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const sumopodApiKey = this.configService.get<string>('SUMOPOD_API_KEY');
    const sumopodBaseUrl = this.configService.get<string>('SUMOPOD_BASE_URL');
    const openaiApiKey = this.configService.get<string>('OPENAI_API_KEY');

    if (sumopodApiKey && sumopodApiKey !== 'your-sumopod-api-key-here') {
      this.openai = new OpenAI({
        apiKey: sumopodApiKey,
        baseURL: sumopodBaseUrl || 'https://api.sumopod.com/v1',
      });
      this.logger.log('Sumopod AI provider initialized successfully.');
    } else if (openaiApiKey && openaiApiKey !== 'your-openai-api-key-here') {
      this.openai = new OpenAI({ apiKey: openaiApiKey });
      this.logger.log('OpenAI SDK initialized successfully.');
    } else {
      this.logger.warn('Neither SUMOPOD_API_KEY nor OPENAI_API_KEY is configured. Running AI Engine in local MOCK mode.');
    }
  }

  getOpenAiClient(): OpenAI | null {
    return this.openai;
  }

  async generateChatCompletion(
    messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
    options?: { temperature?: number; model?: string },
  ): Promise<string> {
    if (this.openai) {
      try {
        const defaultModel = this.configService.get<string>('SUMOPOD_MODEL') || 'deepseek-r1';
        const model = options?.model || defaultModel;
        const response = await this.openai.chat.completions.create({
          model,
          messages,
          temperature: options?.temperature ?? 0.7,
        });
        return response.choices[0]?.message?.content || '';
      } catch (error) {
        this.logger.error('AI API chat completion error, raising error:', error);
        throw error;
      }
    }

    this.logger.log('[Mock AI] Simulated completion generation request received.');
    const lastUserMessage = messages.filter((m) => m.role === 'user').pop()?.content || '';
    return `[Mock response to: "${lastUserMessage.substring(0, 50)}..."] This is a mock AI completion. Please supply a valid SUMOPOD_API_KEY or OPENAI_API_KEY in your .env file to enable live responses.`;
  }

  async generateEmbeddings(text: string): Promise<number[]> {
    if (this.openai) {
      try {
        const embeddingModel = this.configService.get<string>('SUMOPOD_EMBEDDING_MODEL') || 'text-embedding-3-small';
        const response = await this.openai.embeddings.create({
          model: embeddingModel,
          input: text.replace(/\n/g, ' '),
        });
        return response.data[0].embedding;
      } catch (error) {
        this.logger.error('AI API embeddings error, raising error:', error);
        throw error;
      }
    }

    this.logger.log('[Mock AI] Simulated 1536-dim vector embedding creation.');
    // Return a dummy 1536-dimensional embedding vector (standard size for text-embedding-3-small / text-embedding-ada-002)
    return Array.from({ length: 1536 }, () => Math.random() * 2 - 1);
  }
}
