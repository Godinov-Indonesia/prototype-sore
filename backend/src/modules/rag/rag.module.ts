import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { RagService } from './rag.service';
import { RagController } from './rag.controller';
import { DocumentProcessor } from './processors/document.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'document-processing',
    }),
  ],
  controllers: [RagController],
  providers: [RagService, DocumentProcessor],
  exports: [RagService],
})
export class RagModule {}
