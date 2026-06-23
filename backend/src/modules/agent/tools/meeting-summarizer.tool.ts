import { Injectable, Logger } from '@nestjs/common';
import { AgentTool } from './tool.interface';
import { PrismaService } from '../../../core/database/prisma.service';
import { AiEngineService } from '../../ai-engine/ai-engine.service';
import { VectorDbService } from '../../../core/vector-db/vector-db.service';

@Injectable()
export class MeetingSummarizerTool implements AgentTool {
  name = 'meeting_summarizer';
  description = 'Summarizes a meeting transcript (provided directly or retrieved from RAG database), extracts action items, assigns tasks to employees, and schedules H-1 Day & H-12 Hour email reminders.';
  parameters = {
    type: 'object',
    properties: {
      meetingText: {
        type: 'string',
        description: 'Optional raw meeting transcript text. If empty, the tool will query the RAG database for transcripts.',
      },
      searchQuery: {
        type: 'string',
        description: 'Search query to look up the meeting transcript inside the RAG system if meetingText is not provided. Defaults to "transkrip rapat".',
      },
    },
  };

  private readonly logger = new Logger(MeetingSummarizerTool.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiEngine: AiEngineService,
    private readonly vectorDb: VectorDbService,
  ) {}

  async execute(args: { meetingText?: string; searchQuery?: string }): Promise<any> {
    this.logger.log(`Executing Meeting Summarizer Tool with args: ${JSON.stringify(args)}`);

    let sourceText = args.meetingText || '';

    // If meeting text is not provided, retrieve it from pgvector RAG database
    if (!sourceText) {
      const query = args.searchQuery || 'transkrip rapat';
      this.logger.log(`No meetingText provided. Querying RAG with: "${query}"`);
      
      const queryEmbedding = await this.aiEngine.generateEmbeddings(query);
      const matches = await this.vectorDb.query(queryEmbedding, 5);

      if (matches.length === 0) {
        return {
          error: 'No meeting transcript context found in the RAG database. Please upload a transcript or provide it directly.',
        };
      }

      sourceText = matches.map((match) => match.metadata?.text || '').join('\n\n');
      this.logger.log(`Retrieved RAG context length: ${sourceText.length} characters.`);
    }

    // Retrieve employees from the database
    const employees = await this.prisma.employee.findMany();
    if (employees.length === 0) {
      return {
        error: 'No employees found in the database. Please seed employee directory first.',
      };
    }

    const employeeList = employees
      .map((e) => `ID: ${e.id} | Name: ${e.namaLengkap} | Role: ${e.jabatan} | Dept: ${e.departemen} | Email: ${e.email}`)
      .join('\n');

    const currentTime = new Date().toISOString();

    const systemPrompt = `You are an expert AI meeting summarizer and task manager.
Your job is to analyze the provided meeting transcript, extract clear action items, and assign them to the most suitable employee from the provided employee directory.

Current local time is: ${currentTime}

Available Employee Directory:
${employeeList}

For each action item you find, you must output:
1. title: Concise title of the task
2. description: Detailed description of the task
3. employeeId: The exact ID (uuid) of the selected employee from the directory who is the best fit for this task
4. dueDate: The calculated due date in ISO 8601 format (YYYY-MM-DDTHH:mm:ssZ). If the transcript doesn't specify a due date, default it to 3 days from now.

Return your response strictly as a JSON array of objects, containing 'title', 'description', 'employeeId', and 'dueDate' fields. 
Return only the raw JSON. Do not wrap it in markdown codeblocks (e.g. \`\`\`json ... \`\`\`) or add any extra explanation.`;

    const userPrompt = `Here is the meeting transcript content:\n\n${sourceText}`;

    const completion = await this.aiEngine.generateChatCompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], { temperature: 0.2 });

    let actionItems: any[] = [];
    try {
      // Clean potential markdown blocks
      const cleanCompletion = completion.replace(/```json/g, '').replace(/```/g, '').trim();
      actionItems = JSON.parse(cleanCompletion);
    } catch (e) {
      this.logger.error(`Failed to parse AI action items output. Output was: ${completion}`);
      return {
        error: 'Failed to parse AI output into structured action items.',
        rawOutput: completion,
      };
    }

    const createdTasks: any[] = [];
    const createdReminders: any[] = [];
    const now = new Date();

    for (const item of actionItems) {
      const employee = employees.find((e) => e.id === item.employeeId);
      if (!employee) {
        this.logger.warn(`Matched employee ID ${item.employeeId} not found in DB list. Skipping task creation.`);
        continue;
      }

      const dueDate = new Date(item.dueDate);

      // Create Task
      const task = await this.prisma.task.create({
        data: {
          title: item.title,
          description: item.description,
          dueDate: dueDate,
          employeeId: employee.id,
          status: 'PENDING',
        },
      });

      createdTasks.push({
        id: task.id,
        title: task.title,
        assignedTo: employee.namaLengkap,
        email: employee.email,
        dueDate: task.dueDate,
      });

      // H-1 day (24 hours before dueDate)
      const remindAtH1 = new Date(dueDate.getTime() - 24 * 60 * 60 * 1000);
      // H-12 hours (12 hours before dueDate)
      const remindAtH12 = new Date(dueDate.getTime() - 12 * 60 * 60 * 1000);

      if (remindAtH1 > now) {
        const r1 = await this.prisma.reminder.create({
          data: {
            taskTitle: task.title,
            email: employee.email,
            remindAt: remindAtH1,
            type: 'H-1',
          },
        });
        createdReminders.push({
          id: r1.id,
          taskTitle: r1.taskTitle,
          email: r1.email,
          remindAt: r1.remindAt,
          type: r1.type,
        });
      }

      if (remindAtH12 > now) {
        const r2 = await this.prisma.reminder.create({
          data: {
            taskTitle: task.title,
            email: employee.email,
            remindAt: remindAtH12,
            type: 'H-12H',
          },
        });
        createdReminders.push({
          id: r2.id,
          taskTitle: r2.taskTitle,
          email: r2.email,
          remindAt: r2.remindAt,
          type: r2.type,
        });
      }
    }

    return {
      summary: `Successfully parsed transcript. Created ${createdTasks.length} tasks and scheduled ${createdReminders.length} reminders.`,
      tasks: createdTasks,
      reminders: createdReminders,
    };
  }
}
