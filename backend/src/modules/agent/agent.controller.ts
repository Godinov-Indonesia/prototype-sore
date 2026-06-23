import { Controller, Post, Get, Body, UseInterceptors, UploadedFile, Sse, Query, MessageEvent } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AgentService } from './agent.service';
import { RunAgentDto } from './dto/run-agent.dto';
import { Observable } from 'rxjs';

@Controller('agent')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Post('run')
  @UseInterceptors(FileInterceptor('file'))
  async runAgent(
    @Body() dto: RunAgentDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.agentService.runAgent(dto.prompt, file);
  }

  @Get('run/stream')
  @Sse()
  streamAgent(
    @Query('prompt') prompt: string,
  ): Observable<MessageEvent> {
    return this.agentService.streamAgent(prompt);
  }

  @Post('run/stream')
  @UseInterceptors(FileInterceptor('file'))
  @Sse()
  streamAgentPost(
    @Body() dto: RunAgentDto,
    @UploadedFile() file?: Express.Multer.File,
  ): Observable<MessageEvent> {
    return this.agentService.streamAgent(dto.prompt, file);
  }

  @Get('tasks')
  async getTasks() {
    return this.agentService.getTasks();
  }

  @Get('reminders')
  async getReminders() {
    return this.agentService.getReminders();
  }

  @Get('employees')
  async getEmployees() {
    return this.agentService.getEmployees();
  }
}
