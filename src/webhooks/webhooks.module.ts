import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';

import { PaymentsModule } from 'src/payments/payments.module';
import { LoggerModule } from 'src/logger/logger.module';
import { OrdersModule } from 'src/orders/orders.module';
import { QueueModule } from 'src/queue/queue.module';

@Module({
  imports: [
    PaymentsModule,
    OrdersModule,
    LoggerModule,
    QueueModule,
  ],
  controllers: [WebhooksController],
  providers: [WebhooksService],
  exports: [WebhooksService],
})
export class WebhooksModule {}
