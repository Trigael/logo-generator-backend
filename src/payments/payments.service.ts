import { HttpService } from '@nestjs/axios';
import { forwardRef, Inject, Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { Order_items, Order_states, Orders, Payment_states, Payments, Prisma } from '@prisma/client';

// DTOs
import { VerifyPaymentDto } from './dto/verify-payment.dto';

// Services
import { DatabaseService } from 'src/database/database.service';
import { MailService } from 'src/mail/mail.service';
import { LogoService } from 'src/logo/logo.service';
import { Order_item } from 'src/utils/types.util';
import { UsersService } from 'src/users/users.service';
import { InternalErrorException } from 'src/utils/exceptios';
import { OrdersService } from 'src/orders/orders.service';
import { getCurrencySymbol } from 'src/utils/helpers.util';
import { LoggerService } from 'src/logger/logger.service';

@Injectable()
export class PaymentsService {
    constructor(
        private readonly db: DatabaseService,
        private readonly httpService: HttpService,
        private readonly mailService: MailService,
        private readonly usersService: UsersService,
        private readonly logger: LoggerService,

        @Inject(forwardRef(() => LogoService))
        private readonly logoService: LogoService,
        
        @Inject(forwardRef(() => OrdersService))
        private readonly ordersService: OrdersService,
    ) {}

    async getPayment(payment_id: number) {
        return await this.db.payments.findUnique({ where: {id_payment: payment_id }})
    }

    async getPaymentByStripeID(stripe_id: string): Promise<Payments | null> {
        return await this.db.payments.findFirst({ where: { stripe_id: stripe_id }})
    }

    async updatePayment(payment_id: number, data: Prisma.PaymentsUpdateInput): Promise<Payments> {
        return await this.db.payments.update({
            where: { id_payment: payment_id },
            data
        })
    }

    async updatePaymentByStripeID(stripe_id: string, payment_state: Payment_states) {
        const payment = await this.getPaymentByStripeID(stripe_id)
        
        return await this.db.payments.update({
            where: {id_payment: payment?.id_payment},
            data: { state: payment_state }
        })
    }
    
    // async createPayment(
    //     amount: number,
    //     currency: Currencies,
    //     email: string,
    //     user_id: number,
    //     price_id: string,
    // ) {
    //     // Create log in DB
    //     const db_response: any = await this.db.payments.create({ 
    //         data: { user_id, price: amount, currency: `${currency.toUpperCase()}` as Currencies }
    //     })

    //     // Create payment in Stripe
    //     const stripe_repsonse = await this._createStripeTransaction(
    //         db_response.payment_id, 
    //         email, 
    //         [
    //             {
    //                 price: price_id,
    //                 quantity: 1,
    //             }
    //         ]
    //     )

    //     if(stripe_repsonse.success) {
    //         await this.db.payments.update({ where: {id_payment: db_response.id_payment}, data: { stripe_id: stripe_repsonse.stripe_id } })
    //     }

    //     return stripe_repsonse
    // }

    async createPaymentForLogos(order: Orders, order_items: Order_item[]): Promise<Payments> {
        const user = await this.usersService.getUser(order.user_id)

        if(!user) throw new InternalErrorException(`[PaymentService] User not found. Payment cancelled.`)
        
        // Create payment in DB
        let db_response: any = await this.db.payments.create({ data: {
            order_id: order.id_order,
            user_id: order.user_id
        } })

        // Creating products for stripe payment
        const products = {
            price_data: {
                currency: order.currency.toLocaleLowerCase(),
                product_data: {
                    name: "Custom generated logo",
                    // images: images,
                    // description: "Handmade cotton t-shirt.",
                    // shippable: false,
                    // metadata: { "sku": "T-SHIRT-BLACK-M", "designer": "Alex" },
                    // tax_code: "txcd_10000000",
                },
                unit_amount: order_items[0].price, // Needs to be in cents
            },
            quantity: order_items.length,
        }

        // Create payment in Stripe
        const stripe_repsonse = await this._createStripeTransaction(
            db_response.payment_id, 
            user.email,
            [products]
        )

        if(stripe_repsonse.success) {
            db_response =  await this.db.payments.update({ 
                where: {id_payment: db_response.id_payment}, 
                data: { stripe_id: stripe_repsonse.stripe_id } 
            })
        }

        db_response.stripe = stripe_repsonse

        return db_response
    }

    async verifyPayment(body: VerifyPaymentDto) {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '');

        try {
          const session = await stripe.checkout.sessions.retrieve(body.session_id); 
        
          if (session.payment_status === 'paid') {
            const payment = await this._completePayment(body.session_id)
            const order: Orders | null = payment ? await this.ordersService.getOrder(payment?.order_id) : null

            if(!order) return { payment_state: 'PAID', ...payment }

            // Logging payment intent
            this.logger.log(`Payment ${payment?.id_payment} was successfuly verified`, {
                metadata: {
                    payment_id: payment?.id_payment
                }
            })

            return { 
                payment_state: 'PAID',
                ...payment,
                amount: order.total_amount_cents / 100,
                currency: order.currency,
                currency_symbol: getCurrencySymbol(order.currency)
            };
          } else {
            return { payment_state: 'UNPAID' };
          }
        } catch (err) {
            console.error(`[PaymentsService.verifyPayment] Verification failed. ${err}`)
            return { 
                payment_state: 'NOT_FOUND',
                error_message: err 
            };
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
            const payment = await this.getPaymentByStripeID(session.id)

            this.logger.log(
                `Payment ${payment?.id_payment} was successfuly paid for`, {
                metadata: {
                    payment_id: payment?.id_payment
                }
            })
          
            await this._completePayment(session.id)
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

            // Logging payment intent
            this.logger.log(`Payment created for ${email}`, {
                metadata: {
                    stripe_session: session,
                    payment_id: payment_id
                }
            })
      
            return { success: true, payment_url: session.url, payment_id, stripe_id: session.id }
        } catch(err) {
            console.log(err)
            return { success: false, payment_id }
        }
    }

    private async _completePayment(stripe_id: string): Promise<Payments | null> {
        const payment: Payments | null = await this.getPaymentByStripeID(stripe_id)

        if (!payment) {
            console.error(`[PaymentService] Payment not found for stripe_id=${stripe_id}`)
            return null
        }
        
        if(payment.state == Payment_states.COMPLETED) return payment

        // Updating payments state
        await this.updatePayment(payment.id_payment, { 
            state: Payment_states.COMPLETED 
        })

        // Updating order state
        const order = await this.ordersService.updateOrder(payment.order_id, {
            state: Order_states.COMPLETED,
            completed_at: new Date(),
        })

        payment.state = Payment_states.COMPLETED
        
        // Updating Logos state
        const product_types_included = await this._updatedOrderItems(payment.order_id, true)

        if(product_types_included.generated_logo) {
            // Send email with logo
            this.mailService.sendLogoEmailAfterPayment(payment.id_payment)
        }

        return payment
    }

    async _updatedOrderItems(order_id: number, logo_bought: boolean) {
        const order_items: Order_items[] = await this.db.order_items.findMany({ 
            where: { order_id: order_id }
        }) 
        let product_types_included = {
            generated_logo: false
        }

        for(let i = 0; i < order_items.length; i++) {
            if(order_items[i].archived_logo_id == null) continue 

            const archived_logo = await this.db.archived_logos.findFirst({
                where: { id_archived_logo: order_items[i].archived_logo_id! }
            })

            if(!archived_logo) continue 

            await this.db.prompted_logos.update({
                where: { id_prompted_logo: archived_logo.prompted_logo_id },
                data: { bought: logo_bought }
            })

            product_types_included.generated_logo = true
        }

        return product_types_included
    }
    //#endregion
}
