import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { currencies, orders, Prisma } from '@prisma/client';
import { CONFIG_OPTIONS, ConfigService } from 'src/config/config.service';

import { DatabaseService } from 'src/database/database.service';
import { LogoService } from 'src/logo/logo.service';
import { PricesService } from 'src/prices/prices.service';
import { ProductTypesService } from 'src/product_types/product_types.service';
import { S3Service } from 'src/s3/s3.service';

import { Order_item } from 'src/utils/types.util';



@Injectable()
export class OrdersService {
    private BUCKET_NAME: string;

    constructor(
        private readonly db: DatabaseService,
        private readonly pricesService: PricesService,
        private readonly productTypesService: ProductTypesService,
        private readonly config: ConfigService,
        private readonly s3: S3Service,

        @Inject(forwardRef(() => LogoService))
        private readonly logoService: LogoService,
    ) {}

    async onModuleInit() {
      this.BUCKET_NAME = await this.config.get(CONFIG_OPTIONS.BUCKET_NAME) as string;
    }

    async createOrder(
        user_id: number,
        currency: currencies,
        order_items: Order_item[]
    ): Promise<orders> {
        let total_price = 0

        // Calculating total price for each item
        for(let i = 0; i < order_items.length; i++) {
            let price = await this.pricesService.getPriceOfProductType(
                currency,
                order_items[i].product_type_id
            )

            if(price?.amount_cents) {
                total_price += price?.amount_cents * order_items[i].amount
            }
        }

        const order = await this.db.orders.create({ data: {
            user: { connect: { id_user: user_id }},
            currency: currency,
            total_amount_cents: total_price
        } })

        // Save every item into the order
        await this.saveItemsIntoOrder(order, order_items)

        return order
    }

    async getOrder(order_id: number): Promise<orders | null> {
        return await this.db.orders.findFirst({
            where: { id_order: order_id }
        })
    }

    async updateOrder(order_id: number, data: Prisma.ordersUpdateInput): Promise<orders> {
        return await this.db.orders.update({
            where: { id_order: order_id },
            data
        })
    }

    async saveItemsIntoOrder(order: orders, order_items: Order_item[]) {
        const generated_logo_type = await this.productTypesService.getGeneratedLogoProductType()

        for(let i = 0; i < order_items.length; i++) {
            await this.db.order_items.create({
              data: {
                order: { connect: { id_order: order.id_order } },
                product_type: { connect: { id_product_type: order_items[i].product_type_id } },
                archived_logo:
                  order_items[i].product_type_name === generated_logo_type?.name && order_items[i].product_id
                    ? { connect: { id_archived_logo: order_items[i].product_id } }
                    : undefined,
                currency: order.currency,
                amount_cents: order_items[i].price,
              },
            });
        }
    }

    async getOrdersLogoFilepaths(order_id: number, as_url?: boolean, only_watermarked = true) {
        const filepaths: string[] = []
        const watermarked_filepaths: string[] = []
        const order_items = await this.db.order_items.findMany({ 
            where: { order_id: order_id }
        })

        for(let i = 0; i < order_items.length; i++) {
            const archived_id = order_items[i].archived_logo_id

            if(archived_id == null) continue

            const logo = await this.logoService.getArchivedLogo(archived_id)
            const prompted_logo_id = logo?.prompted_logo_id

            if(prompted_logo_id == null) continue
            
            const prompted_logo = await this.logoService.getPromptedLogo(prompted_logo_id)
            
            if(!only_watermarked && logo?.filepath != null) filepaths.push(as_url ? await this.s3.getImage(logo?.filepath) : logo?.filepath)
            if(prompted_logo?.watermark_filepath != null) watermarked_filepaths.push(as_url ? await this.s3.getImage(prompted_logo.watermark_filepath) : prompted_logo.watermark_filepath)
        }

        return {
            filepaths, watermarked_filepaths
        }
    }
}
