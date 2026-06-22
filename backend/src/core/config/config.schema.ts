import { z } from 'zod';

export const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  OPENAI_API_KEY: z.string().min(1),
  VECTOR_DB_PROVIDER: z.enum(['pinecone', 'weaviate', 'chroma']).default('pinecone'),
  PINECONE_API_KEY: z.string().optional(),
  PINECONE_ENVIRONMENT: z.string().optional(),
  PINECONE_INDEX: z.string().optional(),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
});

export type EnvConfig = z.infer<typeof envSchema>;
