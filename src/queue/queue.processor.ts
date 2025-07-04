import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';

// Services
import { LoggerService } from 'src/logger/logger.service';
import { MailService } from 'src/mail/mail.service';

@Processor('mailjetQueue')
export class MailjetQueueProcessor extends WorkerHost {
  constructor(
    private readonly logger: LoggerService,
    private readonly mailjetService: MailService
) {
    super();
  }

  async process(job: Job) {
    return this.mailjetService.sendLogoEmailAfterPayment(job.data.payment_id, job.data.logo_filepaths);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error(`[MailQueue] Failed to send mail to confirm payment ${job.data.payment_id}`,
        {
            metadata: {
                payment_id: job.data.payment_id
            }
        }
    )
  }
}
