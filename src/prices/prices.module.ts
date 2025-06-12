import { Module } from '@nestjs/common';
import { PricesService } from './prices.service';

import { DatabaseModule } from 'src/database/database.module';
import { PricesController } from './prices.controller';
import { ProductTypesModule } from 'src/product_types/product_types.module';
import { CommonModule } from 'src/common/common.module';

@Module({
  imports: [
    DatabaseModule,
    ProductTypesModule,
    CommonModule,
  ],
  providers: [PricesService],
  exports: [PricesService],
  controllers: [PricesController],
})
export class PricesModule {}
