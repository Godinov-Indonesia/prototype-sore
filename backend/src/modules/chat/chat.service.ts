import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { AiEngineService } from '../ai-engine/ai-engine.service';
import { VectorDbService } from '../../core/vector-db/vector-db.service';
import { Subject, Observable } from 'rxjs';
import { MessageEvent } from '@nestjs/common';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiEngine: AiEngineService,
    private readonly vectorDb: VectorDbService,
  ) {}

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
    // 1. Verify session exists and fetch message history
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!session) {
      throw new NotFoundException(`Chat session with ID "${sessionId}" not found`);
    }

    // 2. Save user message
    await this.prisma.message.create({
      data: {
        sessionId,
        role: 'user',
        content: dto.content,
      },
    });

    // 3. Search pgvector RAG database using user message content
    const queryEmbedding = await this.aiEngine.generateEmbeddings(dto.content);
    const matches = await this.vectorDb.query(queryEmbedding, 3);
    
    // Compile context from matches
    const contextText = matches
      .map((match, idx) => `[Document Context ${idx + 1}]: ${match.metadata?.text || ''}`)
      .join('\n\n');

    // 4. Construct System Prompt with context
    const systemPrompt = `You are a helpful AI Company Assistant at PT SAI Inspirasi Kolaborasi.
Your task is to answer user questions using the provided document context.

CRITICAL INSTRUCTIONS:
- You must strictly base your answers on the provided document context.
- If the context does not contain the answer, politely explain that you do not know or that there is no matching information in the database.
- Do not fabricate or hallucinate details.

Retrieved Document Context:
${contextText || 'No matching document context found.'}`;

    // 5. Construct conversation history messages list
    const conversationHistory: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: systemPrompt },
    ];

    // Append past messages in session
    for (const msg of session.messages) {
      conversationHistory.push({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      });
    }

    // Append current user message
    conversationHistory.push({
      role: 'user',
      content: dto.content,
    });

    // 6. Generate response from AI Engine
    const aiResponseText = await this.aiEngine.generateChatCompletion(conversationHistory);

    // 7. Save AI assistant message
    const aiMessage = await this.prisma.message.create({
      data: {
        sessionId,
        role: 'assistant',
        content: aiResponseText,
      },
    });

    // 8. Update session timestamp
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() },
    });

    return aiMessage;
  }

  async deleteSession(id: string) {
    await this.findSession(id);
    return this.prisma.session.delete({
      where: { id },
    });
  }

  streamMessage(sessionId: string, content: string): Observable<MessageEvent> {
    const subject = new Subject<MessageEvent>();

    this.processStreamMessage(sessionId, content, subject).catch((err) => {
      subject.next({ type: 'error', data: { message: err.message } });
      subject.complete();
    });

    return subject.asObservable();
  }

  private async processStreamMessage(sessionId: string, content: string, subject: Subject<MessageEvent>) {
    // Yield execution to allow NestJS to establish connection
    await new Promise((resolve) => setTimeout(resolve, 200));

    // 1. Verify session exists
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!session) {
      throw new NotFoundException(`Chat session with ID "${sessionId}" not found`);
    }

    // 2. Save user message
    await this.prisma.message.create({
      data: {
        sessionId,
        role: 'user',
        content,
      },
    });

    // 3. Emit status: thinking
    subject.next({ type: 'status', data: { status: 'thinking' } });

    // 4. Retrieve context
    const queryEmbedding = await this.aiEngine.generateEmbeddings(content);
    const matches = await this.vectorDb.query(queryEmbedding, 3);
    const contextText = matches
      .map((match, idx) => `[Document Context ${idx + 1}]: ${match.metadata?.text || ''}`)
      .join('\n\n');

    // 5. Build system prompt
    const systemPrompt = `You are a helpful AI Company Assistant at PT SAI Inspirasi Kolaborasi.
Your task is to answer user questions using the provided document context.

CRITICAL INSTRUCTIONS:
- You must strictly base your answers on the provided document context.
- If the context does not contain the answer, politely explain that you do not know.
- Do not fabricate or hallucinate.

Retrieved Document Context:
${contextText || 'No matching document context found.'}`;

    // 6. Build messages array
    const conversationHistory: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: systemPrompt },
    ];
    for (const msg of session.messages) {
      conversationHistory.push({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      });
    }
    conversationHistory.push({
      role: 'user',
      content,
    });

    // 7. Emit status: generating_response
    subject.next({ type: 'status', data: { status: 'generating_response' } });

    const client = this.aiEngine.getOpenAiClient();
    let aiResponseText = '';

    if (client) {
      try {
        const responseStream = await client.chat.completions.create({
          model: 'deepseek-v4-flash',
          messages: conversationHistory,
          stream: true,
        });

        for await (const chunk of responseStream) {
          const choice = chunk.choices[0];
          const thinkingChunk = (choice.delta as any)?.reasoning_content || '';
          const contentChunk = choice.delta?.content || '';

          if (thinkingChunk) {
            subject.next({ type: 'thinking', data: { chunk: thinkingChunk } });
          }
          if (contentChunk) {
            aiResponseText += contentChunk;
            subject.next({ type: 'content', data: { chunk: contentChunk } });
          }
        }
      } catch (error: any) {
        throw new Error(`AI Streaming failed: ${error.message}`);
      }
    } else {
      // Mock streaming
      const mockThinking = [
        'Checking document repository for vendor guidelines...',
        'Found matching SOP section on vendor selection criteria.',
        'Extracting vendor registration steps and payment terms...',
      ];

      for (const t of mockThinking) {
        await new Promise((r) => setTimeout(r, 600));
        subject.next({ type: 'thinking', data: { chunk: t + ' ' } });
      }

      subject.next({ type: 'status', data: { status: 'generating_response' } });

      const mockResponse = `[Mock AI RAG Response] Based on the retrieved SOP vendor documentation:
1. Vendor registration requires NDA & PKS signing.
2. Invoice payment terms are net 14 days after receipt.
(Configure SUMOPOD_API_KEY in .env for actual AI streaming responses).`;

      const words = mockResponse.split(' ');
      for (const word of words) {
        await new Promise((r) => setTimeout(r, 80));
        aiResponseText += word + ' ';
        subject.next({ type: 'content', data: { chunk: word + ' ' } });
      }
    }

    // 8. Save AI assistant message
    const aiMessage = await this.prisma.message.create({
      data: {
        sessionId,
        role: 'assistant',
        content: aiResponseText.trim(),
      },
    });

    // 9. Emit final result (Omitted for chat messages streaming to prevent message duplication on frontend)

    // 10. Update session timestamp
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() },
    });

    // 11. Emit status: done & complete stream
    subject.next({ type: 'status', data: { status: 'done' } });
    subject.complete();
  }
}
