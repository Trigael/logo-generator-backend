import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { Currencies, Orders, Prisma } from '@prisma/client';
import { connect } from 'http2';
import { DatabaseService } from 'src/database/database.service';
import { LogoService } from 'src/logo/logo.service';
import { PricesService } from 'src/prices/prices.service';
import { ProductTypesService } from 'src/product_types/product_types.service';
import { getSecret } from 'src/utils/helpers.util';

import { Order_item } from 'src/utils/types.util';



@Injectable()
export class OrdersService {
    constructor(
        private readonly db: DatabaseService,
        private readonly pricesService: PricesService,
        private readonly productTypesService: ProductTypesService,

        @Inject(forwardRef(() => LogoService))
        private readonly logoService: LogoService,
    ) {}

    async createOrder(
        user_id: number,
        currency: Currencies,
        order_items: Order_item[]
    ): Promise<Orders> {
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
        this.saveItemsIntoOrder(order, order_items)

        return order
    }

    async getOrder(order_id: number): Promise<Orders | null> {
        return await this.db.orders.findFirst({
            where: { id_order: order_id }
        })
    }

    async updateOrder(order_id: number, data: Prisma.OrdersUpdateInput): Promise<Orders> {
        return await this.db.orders.update({
            where: { id_order: order_id },
            data
        })
    }

    async saveItemsIntoOrder(order: Orders, order_items: Order_item[]) {
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

    async getOrdersLogoFilepaths(order_id: number, as_url?: boolean) {
        const filepaths: string[] = []
        const order_items = await this.db.order_items.findMany({ 
            where: { order_id: order_id }
        })
        console.log(order_items)
        for(let i = 0; i < order_items.length; i++) {
            const logo = await this.logoService.getArchivedLogo(order_items[i].archived_logo_id as number)

            if(logo?.filepath != null) filepaths.push(as_url ? `https://nbg1.your-objectstorage.com/logonest-ai${logo?.filepath}` : logo?.filepath)
        }
        console.log(filepaths)
        return filepaths
    }
}
