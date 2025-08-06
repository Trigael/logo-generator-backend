import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';

// Services
import { LoggerService } from 'src/logger/logger.service';
import { WebhooksService } from 'src/webhooks/webhooks.service';

@Processor('mailjetQueue')
export class MailjetQueueProcessor extends WorkerHost {
  constructor(
    private readonly logger: LoggerService,
    private readonly webhookService: WebhooksService
) {
    super();
  }

  async process(job: Job) {
    switch(job.name) {
      case 'handleStripeRefund':
        return this.webhookService.handleStripeRefund(job.data.charge, job.data.payment_id)

      case 'test':
        return false
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error(`[StripeQueue] Failed to refund payment ${job.data.payment_id}`,
        {
            metadata: {
                payment_id: job.data.payment_id
            }
        }
    )
  }
}
