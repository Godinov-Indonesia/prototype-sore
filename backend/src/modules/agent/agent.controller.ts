import { Controller, Post, Body } from '@nestjs/common';
import { AgentService } from './agent.service';
import { RunAgentDto } from './dto/run-agent.dto';

@Controller('agent')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Post('run')
  async runAgent(@Body() dto: RunAgentDto) {
    return this.agentService.runAgent(dto.prompt);
  }
}
