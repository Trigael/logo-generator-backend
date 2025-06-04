/* eslint-disable prettier/prettier */
import { Injectable } from '@nestjs/common';

import { GenerateLogoDto } from './dto/generate-logo.dto';
import { BuyLogoDto } from './dto/buy-logo.dto';

import { ImageGeneratorService } from 'src/image-generator/image-generator.service';
import { DatabaseService } from 'src/database/database.service';
import { PaymentsService } from 'src/payments/payments.service';
import Stripe from 'stripe';

@Injectable()
export class LogoService {
    constructor(
        private readonly db: DatabaseService,
        private readonly imageGenerator: ImageGeneratorService,
        private readonly paymentsService: PaymentsService,
    ) {}

    async getLogo(logo_id: number) {
      return await this.db.pics.findUnique({ where: {id_pics: logo_id}})
    }

    async getLogoByPayment(payment_id: number) {
      return await this.db.pics.findFirst({ where: {payment_id: payment_id}})
    }

    async generateLogo(body: GenerateLogoDto, session_id?: string) {
        const response = await this.imageGenerator.generateLogo(body)
        
        // Save picture into DB
        const logo = await this.db.pics.create({ data: {
          url: response.data[0].url, 
          prompt: response.prompt,
          session_id: session_id ?? null
        }})

        response.data.id = logo.id_pics

        return response;
    }

    async buyLogo(body: BuyLogoDto) {
        // Retrieving product from Stripe
        const price: any = await this._findStripeProductPrice(process.env.STRIPE_LOGO_PRODUCT_ID, body.currency)

        if(!price.price_found) return { success: false, error_message: `Price or the currency wasn't found for product: ${process.env.STRIPE_LOGO_PRODUCT_ID}` }

        // Getting user info
        let user: any = await this.db.users.findFirst({ where: {email: body.email}})

        // Users does not exists yet
        user ??= await this.db.users.create({ data: { email: body.email }});      

        // Creating Payment
        const payment = await this.paymentsService.createPayment(price.price?.amount, price.price?.currency, body.email, user.id_user, price.price.priceId)

        // Update logo info in DB with its payment id
        this.db.pics.update({ 
            where: {
                id_pics: body.logo_id
            },  
            data: { 
                payment_id: payment.payment_id
            }
        })

        return payment
    }

    // #region PRIVATE FUNCTIONS
    private async _findStripeProductPrice(product_id, currency) {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '');
        const userCurrency = currency?.toLowerCase() ?? "eur"; // from user, fallback to EUR

        const prices = await stripe.prices.list({ product: product_id ?? 'prod_SQL6Q8xF7BtwwO' });
        const activePrices = prices.data.filter(price => price.active);
        const reversedPrices = activePrices.slice().reverse();

        // Try to find a price for requested currency
        let chosenPrice = reversedPrices.find(price => price.currency === userCurrency);

        // Fallback: use EUR if requested currency is not available
        chosenPrice ??= reversedPrices.find(price => price.currency === "eur");

        // Fallback: use first price if nothing else
        chosenPrice ??= reversedPrices[0];

        if (!chosenPrice) {
          return {
            price_found: false
          }
        }

        return {
          price_found: true,
          price: {
            amount: chosenPrice.unit_amount,
            currency: chosenPrice.currency,
            priceId: chosenPrice.id
          }
        };

    }
    // #endregion
}
