/* eslint-disable prettier/prettier */
import { forwardRef, Inject, Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import * as fs from 'fs';
import * as path from 'path';
import { unlink } from 'fs/promises';

// DTOs
import { GenerateLogoDto } from './dto/generate-logo.dto';
import { BuyLogoDto } from './dto/buy-logo.dto';

// Services
import { ImageGeneratorService } from 'src/image-generator/image-generator.service';
import { DatabaseService } from 'src/database/database.service';
import { PaymentsService } from 'src/payments/payments.service';
import { PricesService } from 'src/prices/prices.service';
import { Archived_logos, Currencies, Orders, Prisma, Prompted_logos, Users } from '@prisma/client';
import { UsersService } from 'src/users/users.service';
import { OrdersService } from 'src/orders/orders.service';
import { Order_item } from 'src/utils/types.util';
import { ProductTypesService } from 'src/product_types/product_types.service';
import { getSecret } from 'src/utils/helpers.util';
import { CONFIG_OPTIONS, ConfigService } from 'src/config/config.service';
import { S3Service } from 'src/s3/s3.service';

@Injectable()
export class LogoService {

    constructor(
        private readonly db: DatabaseService,
        private readonly imageGenerator: ImageGeneratorService,
        private readonly pricesService: PricesService,
        private readonly usersService: UsersService,
        private readonly ordersService: OrdersService,
        private readonly productTypesService: ProductTypesService,
        private readonly config: ConfigService,
        private readonly s3: S3Service,
        
        @Inject(forwardRef(() => PaymentsService))
        private readonly paymentsService: PaymentsService,
    ) {}

    async createArchivedLogo(data: Prisma.Archived_logosCreateInput): Promise<Archived_logos> {
      return await this.db.archived_logos.create({ data })
    }

    async getOrCreateArchivedLogo(prompted_logo_id: number): Promise<Archived_logos> {
      const logo = await this.db.archived_logos.findFirst({
        where: { prompted_logo_id: prompted_logo_id }
      })

      if(!logo) {
        return await this.createArchivedLogo({ 
          prompted_logo: { connect: { id_prompted_logo: prompted_logo_id } 
        }})
      }

      return logo
    }

    async getArchivedLogo(archived_logo_id: number): Promise<Archived_logos | null> {
      return await this.db.archived_logos.findFirst({
        where: { id_archived_logo: archived_logo_id }
      })
    }


    async getPromptedLogo(logo_id: number) {
      return await this.db.prompted_logos.findUnique({ 
        where: {id_prompted_logo: logo_id}
      })
    }

    async createPromptedLogo(data: Prisma.Prompted_logosCreateInput) {
      return await this.db.prompted_logos.create({ data })
    }

    async deleteUnboughtLogosOlderThan(days: number) {
      const targetDate = new Date();

      targetDate.setDate(targetDate.getDate() - days);
      
      const filepaths_for_logos: string[] = []
      const logos_to_delete = await this.db.prompted_logos.findMany({
        where: {
          created_at: {
            lt: targetDate,
          },
          bought: false,
        },
      });

      // Extracting filepaths for logos
      for(let i = 0; i < logos_to_delete.length; i++) {
        filepaths_for_logos.push(logos_to_delete[i].filepath_to_logo ?? '')
      }

      // Deleting all selected images localy
      filepaths_for_logos.forEach(filepath => {
        this.s3.deleteFile(filepath)
      });

      return await this.db.prompted_logos.deleteMany({
        where: {
          created_at: {
            lt: targetDate,
          },
          bought: false,
        },
      });
    }

    async generateLogo(body: GenerateLogoDto, session_id?: string) {
        const amount = await this.config.get(CONFIG_OPTIONS.AMOUNT_OF_PICS_TO_GENERATE) as number
        const response = await this.imageGenerator.generateLogo(
          body, 
          amount
        )
        const now = new Date()

        for(let i = 0; i < response.data.length; i++) {
          // Save picture into DB
          const logo: Prompted_logos = await this.createPromptedLogo({
            prompt: { connect: { id_prompt: response.prompt.id_prompt}},
            url_to_logo: response.data[i].url,
            url_valid_to: new Date(now.getTime() + 60 * 60 * 1000)
          })

          response.data[i].id = logo.id_prompted_logo
        }

        return response;
    }

    async generateLogoWithPromptRefactoring(body: GenerateLogoDto, session_id?: string) {
      const amount = await this.config.get(CONFIG_OPTIONS.AMOUNT_OF_PICS_TO_GENERATE) as number
      const response = await this.imageGenerator.generateLogoWitchChatGPTPrompts(
        body, 
        amount
      )

      for(let i = 0; i < response.data.length; i++) {
          // Save picture into DB
          const logo: Prompted_logos = await this.createPromptedLogo({
            prompt: { connect: { id_prompt: response.id_prompt}},
            id_from_model: response.data[i].id,
            url_to_logo: response.data[i].image_url,
            filepath_to_logo: response.data[i].image_url.substring(response.data[i].image_url.indexOf('generated')),
          })

          response.data[i].id = logo.id_prompted_logo
        }

      return response;
    }

    async updatePromptedLogo(id: number, data: Prisma.Prompted_logosUpdateInput) {
      return await this.db.prompted_logos.update({ 
        where: { id_prompted_logo: id },
        data: data
      })
    }

    async updateArchivedLogo(id: number, data: Prisma.Archived_logosUpdateInput) {
      return await this.db.archived_logos.update({ 
        where: { id_archived_logo: id },
        data: data
      })
    }

    async buyLogo(body: BuyLogoDto) {
        // Get info for existing user or create new user
        let user: Users = await this.usersService.getOrCreateGuestUser(body.email)
        
        // Users does not exists yet
        user ??= await this.usersService.getOrCreateGuestUser(body.email)

        let order_item: Order_item[] = []
        let prompted_logo = await this.productTypesService.getGeneratedLogoProductType()
        let prompted_logo_price = await this.pricesService.getPriceOfGeneratedLogo(body.currency ?? Currencies.EUR)

        // Format logo_ids into order_items
        for(let i = 0; i < body.logo_ids.length; i++) {
          const archived_logo = await this.getOrCreateArchivedLogo(body.logo_ids[i])
          
          order_item.push({
            product_type_id: prompted_logo?.id_product_type ?? 1,
            product_type_name: prompted_logo?.name ?? '',
            amount: 1,
            price: prompted_logo_price?.amount_cents ?? 0,
            product_id: archived_logo.id_archived_logo
          })

          // Move logo to 'Archived' folder
          await this.moveLogotoArchived(body.logo_ids[i], archived_logo.id_archived_logo)
        }
        
        // Create order
        const order: Orders = await this.ordersService.createOrder(
          user.id_user, body.currency ?? Currencies.EUR, order_item
        )

        // Creating Payment
        const payment = await this.paymentsService.createPaymentForLogos(
          order, order_item
        )

        return payment
    }

    async moveLogotoArchived(prompted_logo_id: number, archived_logo_id: number) {
      // Move generated logos into archived logos file
      const logo_info = await this.getPromptedLogo(prompted_logo_id)
      
      if(logo_info?.filepath_to_logo) {
        const oldPath = `${logo_info.filepath_to_logo}`;
        const newPath = `archived/${path.basename(logo_info.filepath_to_logo).replace('generated_', 'archived_')}`;
          
        // Move file with renaming
        await this.s3.moveObject(oldPath, newPath);

        // Update filepath of logo
        await this.updatePromptedLogo(prompted_logo_id, { filepath_to_logo: '' })
        await this.updateArchivedLogo(archived_logo_id, { filepath: `/archived/${path.basename(logo_info.filepath_to_logo).replace('generated_', 'archived_')}` })
      }
    }

    // async getLogosURLs(logo_ids: number[]) {
    //   let urls: string[] = []

    //   for(let i = 0; i < logo_ids.length; i++) {
    //     let resp = await this.db.pics.findFirst({ where: { id_pics: logo_ids[i] }})

    //     urls.push(resp ? resp.url ?? '' : '')
    //   }

    //   return urls
    // }

    // #region PRIVATE FUNCTIONS
    private async _findStripeProductPrice(product_id, currency) {
        const stripe = new Stripe(getSecret(process.env.STRIPE_SECRET_KEY ?? ''));
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

    private async _deleteLocalImages(filepaths: string[]) {
      const deletions = filepaths.map(async (filepath) => {
        try {
          if (!filepath || filepath.trim() === '') return;

          const absolutePath = path.resolve('public', filepath); 

          await unlink(absolutePath);

          console.log(`Deleted image: ${absolutePath}`);
        } catch (err: any) {
          console.warn(`Failed to delete ${filepath}: ${err.message}`);
        }
      });
    
      await Promise.all(deletions); 
    }
    // #endregion
}
