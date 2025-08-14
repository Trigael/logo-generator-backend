import { Injectable } from '@nestjs/common';
import { currencies, prices, product_types } from '@prisma/client';
import { RequestContextService } from 'src/common/request-context.service';

import { DatabaseService } from 'src/database/database.service';
import { ProductTypesService } from 'src/product_types/product_types.service';

@Injectable()
export class PricesService {
    constructor(
        private readonly db: DatabaseService,
        private readonly productTypesService: ProductTypesService,
        private readonly requestContext: RequestContextService,
    ) {}

    async getPriceOfGeneratedLogo(currency: currencies): Promise<prices | null> {
        const product_type: product_types | null = await this.productTypesService.getGeneratedLogoProductType()

        if(!product_type) return null

        const price = await this.db.prices.findFirst({
            where : { 
                product_type_id: product_type.id_product_type,
                currency: currency 
            }
        })

        if(!price) {
            return await this.db.prices.findFirst({
                where : { 
                    product_type_id: product_type.id_product_type,
                    currency: currencies.EUR
                }
            })
        }

        return price
    }

    async getPriceOfProductType(currency: currencies, product_type_id: number): Promise<prices | null> {
        return await this.db.prices.findFirst({
            where : { 
                product_type_id: product_type_id,
                currency: currency 
            }
        })
    }
}
