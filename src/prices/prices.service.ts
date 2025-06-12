import { Injectable } from '@nestjs/common';
import { Currencies, Prices, Product_types } from '@prisma/client';
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

    async getPriceOfGeneratedLogo(currency: Currencies): Promise<Prices | null> {
        const product_type: Product_types | null = await this.productTypesService.getGeneratedLogoProductType()

        console.log(`sesssion_id: ${this.requestContext.sessionId}`)

        if(!product_type) return null

        return await this.db.prices.findFirst({
            where : { 
                product_type_id: product_type.id_product_type,
                currency: currency 
            }
        })
    }

    async getPriceOfProductType(currency: Currencies, product_type_id: number): Promise<Prices | null> {
        return await this.db.prices.findFirst({
            where : { 
                product_type_id: product_type_id,
                currency: currency 
            }
        })
    }
}
