import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { getSecret } from 'src/utils/helpers.util';

const attempts = 5;
const backoff_time = 5 * 60 * 1000;

@Injectable()
export class QueueService {
  constructor(
    @InjectQueue('mailQueue') private readonly mailjetQueue: Queue, 
) {}

  async addEmailToQueue(payment_id: number) {
    if(getSecret(process.env.NODE_ENV ?? '') == 'dev') return;
    
    await this.mailjetQueue.add('sendLogoEmailAfterPayment', 
        { payment_id }, 
        { attempts: attempts, backoff: backoff_time }
    );
  }
}
