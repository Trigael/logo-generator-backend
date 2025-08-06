import {
  Controller,
  Post,
  Req,
  Res,
  Headers,
  Inject,
} from '@nestjs/common';
import { Request, Response } from 'express';
import Stripe from 'stripe';

import { getSecret } from 'src/utils/helpers.util';

import { WebhooksService } from './webhooks.service';
import { LoggerService } from 'src/logger/logger.service';

@Controller('webhooks')
export class WebhooksController {
    public stripe: Stripe;

    constructor(
        private readonly webhookService: WebhooksService,
        private readonly log: LoggerService,
    ) {
        this.stripe = new Stripe(getSecret(process.env.STRIPE_SECRET_KEY ?? ''));
    }

    @Post("stripe")
    async handleStripeWebhook(
      @Req() req: Request,
      @Res() res: Response,
      @Headers('stripe-signature') signature: string,
    ) {
      let event: Stripe.Event;

      try {
        event = this.stripe.webhooks.constructEvent(
          req.body, 
          signature,
          process.env.STRIPE_WEBHOOK_KEY!,
        );
      } catch (err) {
        this.log.error('[Stripe Webhook] Error verifying Stripe webhook', err)

        return res.status(400).send(`Webhook Error: ${err.message}`);
      }

      // Handle refund event
      if (event.type === 'charge.refunded') {
        const response = await this.webhookService.handleStripeRefund(event.data.object, Number(event.data.object.metadata?.payment_id))

        if(response.status == 200) {
            res.status(200).json({ received: true });
        } else {
            return res.status(response.status).send(response.data ?? 'Unexpected error occured');
        }
      }

      return res.status(200).json({ received: true });
    }
}   
