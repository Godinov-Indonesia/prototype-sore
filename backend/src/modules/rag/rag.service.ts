import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../core/database/prisma.service';
import { AiEngineService } from '../ai-engine/ai-engine.service';
import { VectorDbService } from '../../core/vector-db/vector-db.service';
import { SYSTEM_PROMPTS, formatPrompt } from '../ai-engine/prompt.templates';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);
  private readonly uploadDir = path.join(process.cwd(), 'uploads');

  constructor(
    @InjectQueue('document-processing') private readonly queue: Queue,
    private readonly prisma: PrismaService,
    private readonly aiEngine: AiEngineService,
    private readonly vectorDb: VectorDbService,
  ) {
    // Ensure upload directory exists
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async uploadDocument(file: Express.Multer.File) {
    this.logger.log(`Received document file: ${file.originalname}`);

    // Create unique filename
    const uniqueFilename = `${Date.now()}-${file.originalname}`;
    const filePath = path.join(this.uploadDir, uniqueFilename);

    // Save file locally
    fs.writeFileSync(filePath, file.buffer);

    // 1. Save entry to main database with 'PENDING' status
    const doc = await this.prisma.document.create({
      data: {
        name: file.originalname,
        filePath: filePath,
        status: 'PENDING',
      },
    });

    // 2. Push job to BullMQ queue for background processing
    await this.queue.add('process-document', {
      documentId: doc.id,
      filePath: filePath,
    });

    this.logger.log(`Queued background job for document ID: ${doc.id}`);

    return {
      message: 'Document uploaded successfully. Processing in background.',
      documentId: doc.id,
      status: 'PENDING',
    };
  }

  async listDocuments() {
    return this.prisma.document.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async queryRag(query: string, topK: number = 3) {
    this.logger.log(`Querying RAG system: "${query}"`);

    // 1. Generate query embedding vector
    const queryEmbedding = await this.aiEngine.generateEmbeddings(query);

    // 2. Query Vector DB similarity search
    const matches = await this.vectorDb.query(queryEmbedding, topK);

    if (matches.length === 0) {
      return {
        answer: 'No relevant context found in database documents.',
        references: [],
      };
    }

    // 3. Compile context from matches
    const contextText = matches
      .map((match, idx) => `[Document Chunk ${idx + 1}]: ${match.metadata?.text || ''}`)
      .join('\n\n');

    // 4. Construct Prompt
    const systemPrompt = formatPrompt(SYSTEM_PROMPTS.RAG_QUESTION_ANSWERING, {
      context: contextText,
      question: query,
    });

    // 5. Generate Response via LLM
    const answer = await this.aiEngine.generateChatCompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: query },
    ]);

    return {
      answer,
      references: matches.map((match) => ({
        documentId: match.metadata?.documentId,
        chunkIndex: match.metadata?.chunkIndex,
        score: match.score,
        textSnippet: match.metadata?.text?.substring(0, 100) + '...',
      })),
    };
  }
}
