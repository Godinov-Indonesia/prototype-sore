import { Controller, Get, Post, Body, Param, Delete, HttpCode, HttpStatus, Sse, Query, MessageEvent } from '@nestjs/common';
import { ChatService } from './chat.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { Observable } from 'rxjs';

@Controller('chats')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  async createSession(@Body() dto: CreateSessionDto) {
    return this.chatService.createSession(dto);
  }

  @Get()
  async listSessions() {
    return this.chatService.listSessions();
  }

  @Get(':id')
  async findSession(@Param('id') id: string) {
    return this.chatService.findSession(id);
  }

  @Post(':id/messages')
  async addMessage(@Param('id') id: string, @Body() dto: SendMessageDto) {
    return this.chatService.addMessage(id, dto);
  }

  @Sse(':id/messages/stream')
  streamMessage(
    @Param('id') id: string,
    @Query('content') content: string,
  ): Observable<MessageEvent> {
    return this.chatService.streamMessage(id, content);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSession(@Param('id') id: string) {
    await this.chatService.deleteSession(id);
  }
}
