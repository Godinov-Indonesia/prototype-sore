import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AiEngineService } from '../../ai-engine/ai-engine.service';
import { VectorDbService } from '../../../core/vector-db/vector-db.service';
import * as fs from 'fs';
import * as path from 'path';

@Processor('document-processing')
@Injectable()
export class DocumentProcessor extends WorkerHost {
  private readonly logger = new Logger(DocumentProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiEngine: AiEngineService,
    private readonly vectorDb: VectorDbService,
  ) {
    super();
  }

  async process(job: Job<{ documentId: string; filePath: string }>): Promise<{ status: string; chunksCount: number }> {
    const { documentId, filePath } = job.data;
    this.logger.log(`Processing document chunking & embeddings for Document: ${documentId}`);

    try {
      // Update status to PROCESSING
      await this.prisma.document.update({
        where: { id: documentId },
        data: { status: 'PROCESSING' },
      });

      // Read document content
      if (!fs.existsSync(filePath)) {
        throw new Error(`Document file not found at path: ${filePath}`);
      }
      const fileContent = fs.readFileSync(filePath, 'utf-8');

      // Smart Chunking based on file extension
      let chunks: string[] = [];
      const ext = path.extname(filePath).toLowerCase();

      if (ext === '.json') {
        try {
          const parsed = JSON.parse(fileContent);
          chunks = this.chunkJson(parsed);
        } catch (e) {
          chunks = this.chunkText(fileContent, 1000, 200);
        }
      } else if (ext === '.csv') {
        chunks = this.chunkCsv(fileContent);
      } else {
        chunks = this.chunkText(fileContent, 1000, 200);
      }

      this.logger.log(`Document split into ${chunks.length} chunks.`);

      // Embed chunks & construct vector records
      const vectors: any[] = [];
      for (let i = 0; i < chunks.length; i++) {
        const chunkText = chunks[i];
        const embedding = await this.aiEngine.generateEmbeddings(chunkText);

        vectors.push({
          id: `${documentId}-chunk-${i}`,
          values: embedding,
          metadata: {
            documentId,
            chunkIndex: i,
            text: chunkText,
          },
        });
      }

      // Save to Vector DB
      await this.vectorDb.upsert(vectors);

      // Update status to COMPLETED
      await this.prisma.document.update({
        where: { id: documentId },
        data: { status: 'COMPLETED' },
      });

      this.logger.log(`Document processing completed successfully for ID: ${documentId}`);
      return { status: 'COMPLETED', chunksCount: chunks.length };
    } catch (error: any) {
      this.logger.error(`Error processing job: ${error.message}`, error.stack);

      // Update status to FAILED
      await this.prisma.document.update({
        where: { id: documentId },
        data: { status: 'FAILED' },
      });

      throw error;
    }
  }

  private chunkText(text: string, chunkSize: number, chunkOverlap: number): string[] {
    const chunks: string[] = [];
    let index = 0;

    if (!text || text.length === 0) return chunks;

    while (index < text.length) {
      const chunk = text.substring(index, index + chunkSize);
      chunks.push(chunk);
      index += chunkSize - chunkOverlap;
      if (index >= text.length || chunkSize <= chunkOverlap) {
        break;
      }
    }
    return chunks;
  }

  private chunkJson(data: any): string[] {
    if (Array.isArray(data)) {
      return data.map((item, idx) => `Item ${idx + 1}: ${JSON.stringify(item)}`);
    }
    if (typeof data === 'object' && data !== null) {
      const keys = Object.keys(data);
      if (keys.length === 1 && Array.isArray(data[keys[0]])) {
        return data[keys[0]].map((item, idx) => `${keys[0]} Item ${idx + 1}: ${JSON.stringify(item)}`);
      }
      if (keys.length === 1 && typeof data[keys[0]] === 'object' && data[keys[0]] !== null) {
        const innerData = data[keys[0]];
        const innerKeys = Object.keys(innerData);
        for (const ik of innerKeys) {
          if (Array.isArray(innerData[ik])) {
            return innerData[ik].map((item, idx) => `${keys[0]} - ${ik} Item ${idx + 1}: ${JSON.stringify(item)}`);
          }
        }
      }
      return [JSON.stringify(data, null, 2)];
    }
    return [String(data)];
  }

  private chunkCsv(csvContent: string): string[] {
    const lines = csvContent.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length === 0) return [];
    const header = lines[0];
    const chunks: string[] = [];
    for (let i = 1; i < lines.length; i++) {
      chunks.push(`Header: ${header}\nRow Data: ${lines[i]}`);
    }
    return chunks;
  }
}
