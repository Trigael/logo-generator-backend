import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';

import { getSecret } from 'src/utils/helpers.util';

import { PaymentsService } from 'src/payments/payments.service';
import { LoggerService } from 'src/logger/logger.service';
import { OrdersService } from 'src/orders/orders.service';
import { QueueService } from 'src/queue/queue.service';

@Injectable()
export class WebhooksService {
    public stripe: Stripe;

    constructor(
        private readonly paymentService: PaymentsService,
        private readonly ordersService: OrdersService,
        private readonly log: LoggerService,
        private readonly queue: QueueService,
    ) {
        this.stripe = new Stripe(getSecret(process.env.STRIPE_SECRET_KEY ?? ''));
    }

    /**
     * Handles Stripe refunds from Charge
     * Docs: https://docs.stripe.com/api/charges/object
     * @param charge 
     * @param payment_id 
     * @returns 
     */
    async handleStripeRefund(charge: Stripe.Charge, payment_id: number): Promise<{ status: number, data?: object}> {
        try {
            // Updating payments and orders state to REFUNDED
            const payment = await this.paymentService.updatePayment(payment_id, { state: 'REFUNDED' })
            await this.ordersService.updateOrder(payment.order_id, { state: 'REFUNDED' })
        } catch (error) {
            this.log.error(`[STRIPER REFUND] Unexpected error occured during Stripe refund webhook process`, error)
            this.queue.addStripeRefundToQueue(charge, payment_id)
            
            return { status: error.code, data: error }
        }

        return { status: 200 }
    }
}
