import { Injectable } from '@nestjs/common';
import { Product_types } from '@prisma/client';

// Services
import { DatabaseService } from 'src/database/database.service';

//
const prompted_logo_name = 'temp_logo'

@Injectable()
export class ProductTypesService {
    constructor(
        private readonly db: DatabaseService,
    ) {}

    async getProductType(product_type_id: number): Promise<Product_types | null> {
        return await this.db.product_types.findFirst({ 
            where: { id_product_type: product_type_id }
        })
    }

    async getProductTypeByName(product_type_name: string): Promise<Product_types | null> {
        return await this.db.product_types.findFirst({ 
            where: { name: product_type_name }
        })
    }

    async getGeneratedLogoProductType(): Promise<Product_types | null> {
        return await this.db.product_types.findFirst({ 
            where: { name: prompted_logo_name }
        })
    }
}
