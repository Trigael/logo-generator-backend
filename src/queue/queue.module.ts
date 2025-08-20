import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QueueService } from './queue.service';
import { LoggerModule } from 'src/logger/logger.module';

const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'dev';

@Module({
  imports: [
    BullModule.forRoot(
      isDev
        ? {
            // Dev config – without retry, no spam errors
            connection: {
              host: '127.0.0.1',
              port: 6379,
              retryStrategy: () => null, 
              enableOfflineQueue: false,
            },
          }
        : {
            // Configuration for other enviroments
            connection: {
              url: process.env.REDIS_URL!,
            },
          },
    ),
    BullModule.registerQueue({ name: 'mailQueue' }),
    LoggerModule,
  ],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
