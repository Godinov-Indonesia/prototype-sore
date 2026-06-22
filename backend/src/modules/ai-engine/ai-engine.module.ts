import { Module, Global } from '@nestjs/common';
import { AiEngineService } from './ai-engine.service';

@Global()
@Module({
  providers: [AiEngineService],
  exports: [AiEngineService],
})
export class AiEngineModule {}
