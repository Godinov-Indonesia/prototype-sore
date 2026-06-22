import { Controller, Post, Get, Body, UploadedFile, UseInterceptors, ParseFilePipe, MaxFileSizeValidator, FileTypeValidator } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RagService } from './rag.service';
import { QueryRagDto } from './dto/query-rag.dto';

@Controller('rag')
export class RagController {
  constructor(private readonly ragService: RagService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // Max 10MB
          new FileTypeValidator({ fileType: 'text/plain' }), // Accepting txt files for simplicity
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.ragService.uploadDocument(file);
  }

  @Get('documents')
  async listDocuments() {
    return this.ragService.listDocuments();
  }

  @Post('query')
  async queryRag(@Body() dto: QueryRagDto) {
    return this.ragService.queryRag(dto.query, dto.topK);
  }
}
