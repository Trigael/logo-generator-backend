import { Injectable, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import Stripe from 'stripe';
import { getSecret } from 'src/utils/helpers.util';

const attempts = 5;
const backoff_time = 5 * 60 * 1000;

@Injectable()
export class QueueService {
  constructor(
    @Optional() @InjectQueue('mailQueue') private readonly mailjetQueue: Queue,
    @Optional() @InjectQueue('stripeQueue') private readonly stripeQueue: Queue, 
) {}

  async addEmailToQueue(payment_id: number, logo_filepaths: string[]) {
    if(getSecret(process.env.NODE_ENV ?? '') == 'dev') return;
    
    await this.mailjetQueue.add('sendLogoEmailAfterPayment', 
        { payment_id }, 
        { attempts: attempts, backoff: backoff_time }
    );
  }

  async addStripeRefundToQueue(charge: Stripe.Charge, payment_id: number) {
    if(getSecret(process.env.NODE_ENV ?? '') == 'dev') return;
    
    await this.mailjetQueue.add('handleStripeRefund', 
        { charge, payment_id }, 
        { attempts: attempts, backoff: backoff_time }
    );
  }
}
