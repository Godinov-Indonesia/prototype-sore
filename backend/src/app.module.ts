import { Module } from '@nestjs/common';
import { ConfigModule } from './core/config/config.module';
import { DatabaseModule } from './core/database/database.module';
import { QueueModule } from './core/queue/queue.module';
import { VectorDbModule } from './core/vector-db/vector-db.module';
import { SchedulerModule } from './core/scheduler/scheduler.module';
import { AiEngineModule } from './modules/ai-engine/ai-engine.module';
import { ChatModule } from './modules/chat/chat.module';
import { RagModule } from './modules/rag/rag.module';
import { AgentModule } from './modules/agent/agent.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    QueueModule,
    VectorDbModule,
    SchedulerModule,
    AiEngineModule,
    ChatModule,
    RagModule,
    AgentModule,
  ],
})
export class AppModule {}
