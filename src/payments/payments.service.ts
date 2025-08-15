import { HttpService } from '@nestjs/axios';
import { forwardRef, Inject, Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import * as fs from 'fs/promises';
import * as path from 'path';
import { mkdirSync, existsSync } from 'fs';
import { order_items, order_states, orders, payment_states, payments, Prisma } from '@prisma/client';

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
import { getCurrencySymbol, getSecret, createZipFromUrls } from 'src/utils/helpers.util';
import { LoggerService } from 'src/logger/logger.service';
import { QueueService } from 'src/queue/queue.service';
import { S3Service } from 'src/s3/s3.service';

import axios from 'axios';

@Injectable()
export class PaymentsService {
    public stripe: Stripe;

    constructor(
        private readonly db: DatabaseService,
        private readonly httpService: HttpService,
        private readonly mailService: MailService,
        private readonly usersService: UsersService,
        private readonly logger: LoggerService,
        private readonly queue: QueueService,
        private readonly s3: S3Service,

        @Inject(forwardRef(() => LogoService))
        private readonly logoService: LogoService,
        
        @Inject(forwardRef(() => OrdersService))
        private readonly ordersService: OrdersService,
    ) {
        this.stripe = new Stripe(getSecret(process.env.STRIPE_SECRET_KEY ?? ''));
    }

    async getPayment(payment_id: number) {
        return await this.db.payments.findUnique({ where: {id_payment: payment_id }})
    }

    async getPaymentByStripeID(stripe_id: string): Promise<payments | null> {
        return await this.db.payments.findFirst({ where: { stripe_id: stripe_id }})
    }

    async updatePayment(payment_id: number, data: Prisma.paymentsUpdateInput): Promise<payments> {
        return await this.db.payments.update({
            where: { id_payment: payment_id },
            data
        })
    }

    async updatePaymentByStripeID(stripe_id: string, payment_state: payment_states) {
        const payment = await this.getPaymentByStripeID(stripe_id)
        
        return await this.db.payments.update({
            where: {id_payment: payment?.id_payment},
            data: { state: payment_state }
        })
    }

    async createPaymentForLogos(order: orders, order_items: Order_item[]): Promise<payments> {
        const user = await this.usersService.getUser(order.user_id)

        if(!user) {
            this.logger.error(`[PaymentService] User not found. Payment cancelled for order ${order.id_order}.`, {
                metadata: { order, order_items }
            })
            throw new InternalErrorException(`[PaymentService] User not found. Payment cancelled.`)
        }

        // Create payment in DB
        let db_response: any = await this.db.payments.create({ data: {
            order_id: order.id_order,
            user_id: order.user_id
        } })

        let images = await this.ordersService.getOrdersLogoFilepaths(order.id_order, true)
        
        // Creating products for stripe payment
        const products = {
            price_data: {
                currency: order.currency.toLocaleLowerCase(),
                product_data: {
                    name: "Custom generated logo",
                    images: images.watermarked_filepaths,
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
        db_response.images = images.watermarked_filepaths

        return db_response
    }

    async verifyPayment(body: VerifyPaymentDto) {
        console.log(`[PaymentService] Veryfing payment ${body.session_id}`)
        try {
          const session = await this.stripe.checkout.sessions.retrieve(body.session_id); 
          
          if (session.payment_status == 'paid') {
            const payment = await this._completePayment(body.session_id)
            const order: orders | null = payment ? await this.ordersService.getOrder(payment?.order_id) : null

            if(!order) return { payment_state: 'VERIFIED', ...payment }

            // Logging payment intent
            this.logger.log(`Payment ${payment?.id_payment} was successfuly verified`, {
                metadata: {
                    payment_id: payment?.id_payment,
                    session_id: body.session_id,
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

    async createStripeInvoice(session_id: string): Promise<string> {
      const session = await this.stripe.checkout.sessions.retrieve(session_id);

      const email = session.customer_details?.email;
      const name = session.customer_details?.name ?? 'Zákazník';
      const amount = session.amount_total;
      const currency = session.currency;

      if (!email || !amount || !currency) {
        throw new InternalErrorException('Missing Stripe data')
      }

      const customer = await this.getOrCreateStripeCustomer(email, name);

      await this.stripe.invoiceItems.create({
        customer: customer.id,
        amount,
        currency,
        description: 'Custom logo creation',
      });

      const invoice: any = await this.stripe.invoices.create({
        customer: customer.id,
        auto_advance: true,
      });

      const finalized = await this.stripe.invoices.finalizeInvoice(invoice.id);

      const invoicePdfUrl = finalized.invoice_pdf;

      if (!invoicePdfUrl) throw new InternalErrorException(`Failed to retrieve PDF file of invoice`);

      const localPath = await this.downloadInvoicePdf(invoicePdfUrl, invoice.id);

      return localPath;
    }

    private async getOrCreateStripeCustomer(email: string, name?: string) {
      const existing = await this.stripe.customers.list({ email, limit: 1 });

      if (existing.data.length > 0) return existing.data[0];
        
      return await this.stripe.customers.create({ email, name });
    }

    private async downloadInvoicePdf(pdfUrl: string, invoiceId: string): Promise<string> {
      const dir = path.join(process.cwd(), 'public/invoices');
      const filename = `invoice-${invoiceId}.pdf`;
      const fullPath = path.join(dir, filename);
          
      try {
        if (!existsSync(dir)) {
          await fs.mkdir(dir, { recursive: true });
        }
      
        const response = await axios.get(pdfUrl, { responseType: 'arraybuffer' });

        await fs.writeFile(fullPath, response.data);
      
        const relativePath = path.relative(process.cwd(), fullPath);

        return relativePath;
      } catch (err) {
        console.error(`[downloadInvoicePdf] Error occured during invoice download:`, err);

        throw err;
      }
    }

    //#region PRIVATE FUNCTIONS
    // Docs: https://docs.stripe.com/api/checkout/sessions/create
    private async _createStripeTransaction(
        payment_id: number,
        email: string,
        products: any[]
    ) {
        try {
            const session = await this.stripe.checkout.sessions.create({
              payment_method_types: ['card'],
              mode: 'payment',
              line_items: products,
              customer_email: email,
              success_url: `${getSecret(process.env.FRONTEND_URL ?? '')}/thank-you?session_id={CHECKOUT_SESSION_ID}`,
              cancel_url: `${getSecret(process.env.FRONTEND_URL ?? '')}/payment-cancelled?session_id={CHECKOUT_SESSION_ID}`,
              metadata: { 
                payment_id: payment_id
              } 
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

    private async _completePayment(stripe_id: string): Promise<payments | null> {
        const payment: payments | null = await this.getPaymentByStripeID(stripe_id)

        if (!payment) {
            console.error(`[PaymentService] Payment not found for stripe_id=${stripe_id}`)
            return null
        }
        
        if(payment.state == payment_states.COMPLETED) return payment

        // Updating payments state
        await this.updatePayment(payment.id_payment, { 
            state: payment_states.COMPLETED 
        })

        // Updating order state
        await this.ordersService.updateOrder(payment.order_id, {
            state: order_states.COMPLETED,
            completed_at: new Date(),
        })

        payment.state = payment_states.COMPLETED
        
        // Updating Logos state
        const product_types_included = await this._updatedOrderItems(payment.order_id, true)

        if(product_types_included.generated_logo) {
            // Getting logos, zip and invoice
            const logo_urls = await this.ordersService.getOrdersLogoFilepaths(payment.order_id, true, false)
            const zip = await createZipFromUrls(logo_urls.filepaths, `generated_logos-${payment.id_payment}`)
            const invoicePath = await this.createStripeInvoice(stripe_id);

            // Send email with logo
            try {
                await this.mailService.sendLogoEmailAfterPayment(
                    payment.id_payment,
                    [zip, invoicePath]
                )

                // Delete attachment files
                await fs.unlink(path.join(process.cwd(), zip));
                await fs.unlink(path.join(process.cwd(), invoicePath));
            } catch (err) {
                this.logger.warn(`[PaymentsService._completePayment] Sending confirmation email for payment ${payment.id_payment} failed. Adding it into the queue. Error: ${err}`, { metadata: { payment_id: payment.id_payment } })
                
                // Failed to send email, adding it to queue
                this.queue.addEmailToQueue(payment.id_payment, [zip, invoicePath])
            }

            // Delete watermarked images
            for(let i = 0; i < logo_urls.watermarked_filepaths.length; i++) {
                if(logo_urls.watermarked_filepaths[0].length > 0) await this.s3.deleteFile(logo_urls[i].watermarked_filepaths)
            }
        }

        return payment
    }

    async _updatedOrderItems(order_id: number, logo_bought: boolean) {
        const order_items: order_items[] = await this.db.order_items.findMany({ 
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
