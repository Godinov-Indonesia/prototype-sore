import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class VectorDbService {
  private readonly logger = new Logger(VectorDbService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async upsert(vectors: { id: string; values: number[]; metadata?: any }[]): Promise<void> {
    this.logger.log(`Upserting ${vectors.length} vectors to PostgreSQL via pgvector`);

    for (const vec of vectors) {
      const { id, values, metadata } = vec;
      const documentId = metadata?.documentId;
      const chunkIndex = metadata?.chunkIndex;
      const content = metadata?.text || '';

      const vectorStr = JSON.stringify(values);

      try {
        const sql = `
          INSERT INTO "document_chunks" ("id", "document_id", "chunk_index", "content", "embedding")
          VALUES ($1, $2, $3, $4, '${vectorStr}'::vector)
          ON CONFLICT ("id") DO UPDATE SET
            "document_id" = EXCLUDED."document_id",
            "chunk_index" = EXCLUDED."chunk_index",
            "content" = EXCLUDED."content",
            "embedding" = EXCLUDED."embedding"
        `;
        await this.prisma.$executeRawUnsafe(sql, id, documentId, chunkIndex, content);
      } catch (error) {
        this.logger.error(`Failed to upsert chunk vector ${id}:`, error);
        throw error;
      }
    }
  }

  async query(vector: number[], topK: number, filter?: any): Promise<any[]> {
    this.logger.log(`Querying top ${topK} matches using pgvector`);

    const vectorStr = JSON.stringify(vector);

    try {
      const sql = `
        SELECT
          "id",
          "document_id" AS "documentId",
          "chunk_index" AS "chunkIndex",
          "content" AS "text",
          1 - ("embedding" <=> '${vectorStr}'::vector) AS "score"
        FROM "document_chunks"
        ORDER BY "embedding" <=> '${vectorStr}'::vector
        LIMIT $1
      `;
      const matches: any[] = await this.prisma.$queryRawUnsafe(sql, topK);

      return matches.map((match) => ({
        id: match.id,
        score: Number(match.score),
        metadata: {
          documentId: match.documentId,
          chunkIndex: Number(match.chunkIndex),
          text: match.text,
        },
      }));
    } catch (error) {
      this.logger.error('pgvector similarity search failed:', error);
      throw error;
    }
  }
}
