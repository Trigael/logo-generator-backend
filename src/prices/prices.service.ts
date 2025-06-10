import { Injectable } from '@nestjs/common';

import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class PricesService {
    constructor(
        private readonly db: DatabaseService,
    ) {}

    async getPriceOfGeneratedLogo() {
        const resp = await this.db.prices.findFirst({ where: { product: "generated_logo" }})
        
        return resp?.price
    }
}
