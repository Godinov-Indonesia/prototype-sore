import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class VectorDbService {
  private readonly logger = new Logger(VectorDbService.name);
  // Simple in-memory fallback store for development
  private inMemoryDb: Map<string, { values: number[]; metadata?: any }> = new Map();

  constructor(private readonly configService: ConfigService) {}

  async upsert(vectors: { id: string; values: number[]; metadata?: any }[]): Promise<void> {
    const provider = this.configService.get<string>('VECTOR_DB_PROVIDER');
    const apiKey = this.configService.get<string>('PINECONE_API_KEY');

    this.logger.log(`Upserting ${vectors.length} vectors using provider: ${provider}`);

    // Update in-memory fallback database
    for (const vec of vectors) {
      this.inMemoryDb.set(vec.id, { values: vec.values, metadata: vec.metadata });
    }

    if (provider === 'pinecone' && apiKey && apiKey !== 'your-pinecone-api-key-here') {
      try {
        const environment = this.configService.get<string>('PINECONE_ENVIRONMENT');
        const indexName = this.configService.get<string>('PINECONE_INDEX');
        this.logger.log(`[Pinecone Index: ${indexName} in ${environment}] Mocking upsert call to Pinecone API...`);
        // Actual Pinecone integration would be called here.
      } catch (error) {
        this.logger.error('Pinecone upsert failed, fell back to memory:', error);
      }
    }
  }

  async query(vector: number[], topK: number, filter?: any): Promise<any[]> {
    const provider = this.configService.get<string>('VECTOR_DB_PROVIDER');
    this.logger.log(`Querying top ${topK} matches using provider: ${provider}`);

    const results: { id: string; score: number; metadata?: any }[] = [];

    // Cosine similarity comparison for mock database
    for (const [id, item] of this.inMemoryDb.entries()) {
      if (item.values.length === vector.length) {
        const score = this.cosineSimilarity(vector, item.values);
        results.push({ id, score, metadata: item.metadata });
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}
