import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { Currencies, Payment_states, Pic_states } from '@prisma/client';

import { DatabaseService } from 'src/database/database.service';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { MailService } from 'src/mail/mail.service';

@Injectable()
export class PaymentsService {
    constructor(
        private readonly db: DatabaseService,
        private readonly httpService: HttpService,
        private readonly mailService: MailService,
    ) {}

    async getPayment(payment_id: number) {
        return await this.db.payments.findUnique({ where: {id_payment: payment_id }})
    }
    
    async createPayment(
        amount: number,
        currency: Currencies,
        email: string,
        user_id: number,
        price_id: string,
    ) {
        // Create log in DB
        const db_response: any = await this.db.payments.create({ 
            data: { user_id, price: amount, currency: `${currency.toUpperCase()}` as Currencies }
        })

        // Create payment in Stripe
        const stripe_repsonse = await this._createStripeTransaction(db_response.payment_id, price_id, email)

        if(stripe_repsonse.success) {
            await this.db.payments.update({ where: {id_payment: db_response.id_payment}, data: { stripe_id: stripe_repsonse.stripe_id } })
        }

        return stripe_repsonse
    }

    async verifyPayment(body: VerifyPaymentDto) {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '');

        try {
          const session = await stripe.checkout.sessions.retrieve(body.session_id);
                
          if (session.payment_status === 'paid') {
            this._completePayment(body.session_id)
            return { payment_state: 'PAID' };
          } else {
            return { payment_state: 'UNPAID' };
          }
        } catch {
            return { payment_state: 'NOT_FOUND' };
        }
    }

    async webhookForStripe(body: any, req: any) {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '');
        const sig = req.headers['stripe-signature'];
        const event = stripe.webhooks.constructEvent(
          body, sig, process.env.STRIPE_WEBHOOK_SECRET ?? ''
        );
    
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;
          
            this._completePayment(session.id)
        }
        
        return true
    }

    //#region PRIVATE FUNCTIONS
    // Docs: https://docs.stripe.com/api/checkout/sessions/create
    private async _createStripeTransaction(
        payment_id: number,
        price_id: string,
        email: string,
    ) {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '');
        
        try {
            const session = await stripe.checkout.sessions.create({
              payment_method_types: ['card'],
              mode: 'payment',
              line_items: [{
                price: price_id,
                quantity: 1,
              }],
              customer_email: email,
              success_url: `${process.env.FRONTEND_URL}/thank-you?session_id={CHECKOUT_SESSION_ID}`,
              cancel_url: `${process.env.FRONTEND_URL}/payment-cancelled`,
              // metadata: { ... } // add order id etc. if needed
            });
      
            return { success: true, payment_url: session.url, payment_id, stripe_id: session.id }
        } catch(err) {
            console.log(err)
            return { success: false, payment_id }
        }
    }

    private async _completePayment(stripe_id: string) {
        const payment: any = this.db.payments.findFirst({ where: {stripe_id: `${stripe_id}`}})
        const logo: any = this.db.pics.findFirst({ where: {payment_id: payment.id_payment}});
        
        if(payment.state == Payment_states.COMPLETED) return

        // Updating payments state
        this.db.payments.update({ 
            where: { id_payment: payment.id_payment },
            data: { state: Payment_states.COMPLETED }
        })
        
        // Updating Logos state
        if(logo) {
            this.db.pics.update({
                where: { id_pics: logo.id_pics },
                data: { state: Pic_states.ACTIVE }
            })

            // Send email with logo
            this.mailService.sendLogoEmailAfterPayment(payment.id_payment)
        }
    }
    //#endregion
}
