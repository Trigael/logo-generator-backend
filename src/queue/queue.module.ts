import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QueueService } from './queue.service';
import { LoggerModule } from 'src/logger/logger.module';
import { getSecret } from 'src/utils/helpers.util';

@Module({
  imports: [
    ...(process.env.NODE_ENV === 'dev'
    ? []
    : [
        BullModule.forRoot({
          connection: {
            url: getSecret(process.env.REDIS_URL ?? ''),
          },
        }),
        BullModule.registerQueue({ name: 'mailQueue' }),
      ]),
    
    LoggerModule,
  ],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
