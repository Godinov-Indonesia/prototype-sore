import { Module, Global } from '@nestjs/common';
import { VectorDbService } from './vector-db.service';

@Global()
@Module({
  providers: [VectorDbService],
  exports: [VectorDbService],
})
export class VectorDbModule {}
