import { HttpService } from '@nestjs/axios';
import { forwardRef, Inject, Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { Currencies, Payment_states, Pic_states } from '@prisma/client';

// DTOs
import { VerifyPaymentDto } from './dto/verify-payment.dto';

// Services
import { DatabaseService } from 'src/database/database.service';
import { MailService } from 'src/mail/mail.service';
import { LogoService } from 'src/logo/logo.service';
import { getCurrencySymbol } from 'src/utils/helpers.util';

@Injectable()
export class PaymentsService {
    constructor(
        private readonly db: DatabaseService,
        private readonly httpService: HttpService,
        private readonly mailService: MailService,
        @Inject(forwardRef(() => LogoService))
        private readonly logoService: LogoService,
    ) {}

    async getPayment(payment_id: number) {
        return await this.db.payments.findUnique({ where: {id_payment: payment_id }})
    }

    async getPaymentByStripeID(stripe_id: string) {
        return await this.db.payments.findFirst({ where: { stripe_id: stripe_id }})
    }

    async updatePaymentByStripeID(stripe_id: string, payment_state: Payment_states) {
        const payment = await this.getPaymentByStripeID(stripe_id)
        
        return await this.db.payments.update({
            where: {id_payment: payment?.id_payment},
            data: { state: payment_state }
        })
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
        const stripe_repsonse = await this._createStripeTransaction(
            db_response.payment_id, 
            email, 
            [
                {
                    price: price_id,
                    quantity: 1,
                }
            ]
        )

        if(stripe_repsonse.success) {
            await this.db.payments.update({ where: {id_payment: db_response.id_payment}, data: { stripe_id: stripe_repsonse.stripe_id } })
        }

        return stripe_repsonse
    }

    async createPaymentForLogos(
        price: number,
        currency: Currencies,
        email: string,
        user_id: number,
        logos_id: number[]
    ) {
        // Create log in DB
        const db_response: any = await this.db.payments.create({ 
            data: { user_id, price: price, currency: `${currency.toUpperCase()}` as Currencies }
        })

        // Updating payment_id and user_id for each logo
        if(logos_id) {
            for(let i = 0; i < logos_id.length; i++) {
                await this.db.pics.update({
                    where: { id_pics: logos_id[i]},
                    data: { 
                        payment_id: db_response.id_payment,
                        user_id: user_id,
                    }
                })
            }
        }

        // Creating products
        const images = await this.logoService.getLogosURLs(logos_id)
        const products = {
            price_data: {
                currency: currency.toLocaleLowerCase(),
                product_data: {
                    name: "Custom generated logo",
                    images: images,
                    // description: "Handmade cotton t-shirt.",
                    // shippable: false,
                    // metadata: { "sku": "T-SHIRT-BLACK-M", "designer": "Alex" },
                    // tax_code: "txcd_10000000",
                },
                unit_amount: price * 100, // Needs to be in cents
            },
            quantity: logos_id.length,
        }

        // Create payment in Stripe
        const stripe_repsonse = await this._createStripeTransaction(
            db_response.payment_id, 
            email,
            [products]
        )

        if(stripe_repsonse.success) {
            await this.db.payments.update({ where: {id_payment: db_response.id_payment}, data: { stripe_id: stripe_repsonse.stripe_id } })
        }

        return stripe_repsonse
    }

    async verifyPayment(body: VerifyPaymentDto) {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '');

        try {
          const session = await stripe.checkout.sessions.retrieve(body.session_id);
          const payment = await this.getPaymentByStripeID(body.session_id)
        
          if (session.payment_status === 'paid') {
            this._completePayment(body.session_id)

            return { 
                payment_state: 'PAID',
                payment_id: body.session_id,
                price: payment?.price,
                currency: payment?.currency,
                currency_symbol: getCurrencySymbol(payment?.currency ?? 'EUR'),
                date: payment?.created_at 
            };
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
            const payment = await this.getPaymentByStripeID(body.session_id)
          
            this._completePayment(session.id)

            // Update payment and logo states
            this.updatePaymentByStripeID(body.session_id, Payment_states.COMPLETED)
            if(payment) this.logoService.updateLogosByPayment(payment?.id_payment, Pic_states.ACTIVE)   
        }
        
        return true
    }

    //#region PRIVATE FUNCTIONS
    // Docs: https://docs.stripe.com/api/checkout/sessions/create
    private async _createStripeTransaction(
        payment_id: number,
        email: string,
        products: any[]
    ) {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '');
        
        try {
            const session = await stripe.checkout.sessions.create({
              payment_method_types: ['card'],
              mode: 'payment',
              line_items: products,
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
        const payment: any = await this.getPaymentByStripeID(stripe_id)
        const logo: any[] = await this.logoService.getLogoByPayment(payment.id_payment)

        if(payment.state == Payment_states.COMPLETED) return

        // Updating payments state
        await this.db.payments.update({ 
            where: { id_payment: payment.id_payment },
            data: { state: Payment_states.COMPLETED }
        })

        payment.state = Payment_states.COMPLETED
        
        // Updating Logos state
        if(logo) {
            for(let i = 0; i < logo.length; i++) {
                await this.db.pics.update({
                    where: { id_pics: logo[i].id_pics },
                    data: { state: Pic_states.ACTIVE }
                })
            }
            
            // Send email with logo
            this.mailService.sendLogoEmailAfterPayment(payment.id_payment)
        }
    }
    //#endregion
}
