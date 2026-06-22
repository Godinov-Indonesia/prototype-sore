import { Controller, Get, Post, Body, Param, Delete, HttpCode, HttpStatus } from '@nestjs/common';
import { ChatService } from './chat.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { SendMessageDto } from './dto/send-message.dto';

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

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSession(@Param('id') id: string) {
    await this.chatService.deleteSession(id);
  }
}
