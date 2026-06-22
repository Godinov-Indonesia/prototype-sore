import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class AiEngineService implements OnModuleInit {
  private readonly logger = new Logger(AiEngineService.name);
  private openai: OpenAI | null = null;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (apiKey && apiKey !== 'your-openai-api-key-here') {
      this.openai = new OpenAI({ apiKey });
      this.logger.log('OpenAI SDK initialized successfully.');
    } else {
      this.logger.warn('OPENAI_API_KEY is not configured. Running AI Engine in local MOCK mode.');
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
        const response = await this.openai.chat.completions.create({
          model: options?.model || 'gpt-4o-mini',
          messages,
          temperature: options?.temperature ?? 0.7,
        });
        return response.choices[0]?.message?.content || '';
      } catch (error) {
        this.logger.error('OpenAI chat completion API error, raising error:', error);
        throw error;
      }
    }

    this.logger.log('[Mock AI] Simulated completion generation request received.');
    const lastUserMessage = messages.filter((m) => m.role === 'user').pop()?.content || '';
    return `[Mock response to: "${lastUserMessage.substring(0, 50)}..."] This is a mock AI completion. Please supply a valid OPENAI_API_KEY in your .env file to enable live OpenAI API responses.`;
  }

  async generateEmbeddings(text: string): Promise<number[]> {
    if (this.openai) {
      try {
        const response = await this.openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: text.replace(/\n/g, ' '),
        });
        return response.data[0].embedding;
      } catch (error) {
        this.logger.error('OpenAI embeddings API error, raising error:', error);
        throw error;
      }
    }

    this.logger.log('[Mock AI] Simulated 1536-dim vector embedding creation.');
    // Return a dummy 1536-dimensional embedding vector (standard size for text-embedding-3-small / text-embedding-ada-002)
    return Array.from({ length: 1536 }, () => Math.random() * 2 - 1);
  }
}
