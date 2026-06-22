import { Module } from '@nestjs/common';
import { AgentService } from './agent.service';
import { AgentController } from './agent.controller';
import { DbQueryTool } from './tools/db-query.tool';
import { WebSearchTool } from './tools/web-search.tool';

@Module({
  controllers: [AgentController],
  providers: [AgentService, DbQueryTool, WebSearchTool],
})
export class AgentModule {}
