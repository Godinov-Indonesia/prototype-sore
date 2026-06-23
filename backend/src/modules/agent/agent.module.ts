import { Module } from '@nestjs/common';
import { AgentService } from './agent.service';
import { AgentController } from './agent.controller';
import { DbQueryTool } from './tools/db-query.tool';
import { WebSearchTool } from './tools/web-search.tool';
import { MeetingSummarizerTool } from './tools/meeting-summarizer.tool';
import { QuotationGeneratorTool } from './tools/quotation-generator.tool';
import { ProposalGeneratorTool } from './tools/proposal-generator.tool';
import { FollowupGeneratorTool } from './tools/followup-generator.tool';
import { BusinessInsightTool } from './tools/business-insight.tool';

@Module({
  controllers: [AgentController],
  providers: [
    AgentService,
    DbQueryTool,
    WebSearchTool,
    MeetingSummarizerTool,
    QuotationGeneratorTool,
    ProposalGeneratorTool,
    FollowupGeneratorTool,
    BusinessInsightTool,
  ],
})
export class AgentModule {}
