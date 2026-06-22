import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Run every hour to perform basic database cleanup or check system health
  @Cron(CronExpression.EVERY_HOUR)
  async handleHourlyCleanup() {
    this.logger.log('Starting hourly maintenance cron job...');
    try {
      // For instance, cleaning up documents that have been in 'PENDING' for more than 24 hours
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const deleted = await this.prisma.document.deleteMany({
        where: {
          status: 'PENDING',
          createdAt: {
            lt: yesterday,
          },
        },
      });

      if (deleted.count > 0) {
        this.logger.log(`Cleaned up ${deleted.count} expired pending documents.`);
      } else {
        this.logger.log('No expired pending documents found.');
      }
    } catch (error) {
      this.logger.error('Failed to run hourly maintenance cron job:', error);
    }
  }
}
