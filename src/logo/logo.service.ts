/* eslint-disable prettier/prettier */
import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';

// DTOs
import { GenerateLogoDto } from './dto/generate-logo.dto';
import { BuyLogoDto } from './dto/buy-logo.dto';

// Services
import { ImageGeneratorService } from 'src/image-generator/image-generator.service';
import { DatabaseService } from 'src/database/database.service';
import { PaymentsService } from 'src/payments/payments.service';
import { PricesService } from 'src/prices/prices.service';
import { Currencies, Pic_states } from '@prisma/client';
import { UsersService } from 'src/users/users.service';

@Injectable()
export class LogoService {
    constructor(
        private readonly db: DatabaseService,
        private readonly imageGenerator: ImageGeneratorService,
        private readonly paymentsService: PaymentsService,
        private readonly pricesService: PricesService,
        private readonly usersService: UsersService,
    ) {}

    async getLogo(logo_id: number) {
      return await this.db.pics.findUnique({ where: {id_pics: logo_id}})
    }

    async getLogoByPayment(payment_id: number) {
      return await this.db.pics.findMany({ where: {payment_id: payment_id}})
    }

    async generateLogo(body: GenerateLogoDto, session_id?: string) {
        const response = await this.imageGenerator.generateLogo(body)
        
        for(let i = 0; i < response.data.length; i++) {
          // Save picture into DB
          const logo = await this.db.pics.create({ data: {
            url: response.data[i].url, 
            prompt: response.prompt,
            session_id: session_id ?? null
          }})

          response.data[i].id = logo.id_pics
        }

        return response;
    }

    async buyLogo(body: BuyLogoDto) {
        // Retrieving product from Stripe
        const price = await this.pricesService.getPriceOfGeneratedLogo()

        if(!price) return { success: false, error_message: `Price  wasn't found for product: ${process.env.STRIPE_LOGO_PRODUCT_ID}` }

        // Get info for existing user or create new user
        let user: any = await this.usersService.createUser(body.email)
        
        // Users does not exists yet
        user ??= await this.db.users.create({ data: { email: body.email }});      

        // Creating Payment
        const payment = await this.paymentsService.createPaymentForLogos(
          price, 
          body.currency ?? Currencies.EUR, 
          body.email, 
          user.id_user,
          body.logo_ids 
        )

        // Update logo info in DB with its payment id
        for(let i = 0; i < body.logo_ids.length; i++ ) {
          this.db.pics.update({ 
            where: {
                id_pics: body.logo_ids[i]
            },  
            data: { 
                payment_id: payment.payment_id
            }
        })
        }

        return payment
    }

    async getLogosURLs(logo_ids: number[]) {
      let urls: string[] = []

      for(let i = 0; i < logo_ids.length; i++) {
        let resp = await this.db.pics.findFirst({ where: { id_pics: logo_ids[i] }})

        urls.push(resp ? resp.url ?? '' : '')
      }

      return urls
    }

    async updateLogosByPayment(payment_id: number, logo_state: Pic_states) {
      const logos = await this.getLogoByPayment(payment_id)
      
      for(let i = 0; i < logos.length; i++) {
        this.db.pics.update({
          where: { id_pics: logos[i].id_pics },
          data: { state: logo_state }
        })
      }
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
