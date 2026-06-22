import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { envSchema } from './config.schema';

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      validate: (config) => {
        const parsed = envSchema.safeParse(config);
        if (!parsed.success) {
          console.error('❌ Environment validation failed:', parsed.error.format());
          throw new Error('Config validation error');
        }
        return parsed.data;
      },
    }),
  ],
  exports: [NestConfigModule],
})
export class ConfigModule {}
