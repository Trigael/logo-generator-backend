import { forwardRef, Module } from '@nestjs/common';
import { OrdersService } from './orders.service';

// Modules
import { DatabaseModule } from 'src/database/database.module';
import { PricesModule } from 'src/prices/prices.module';
import { ProductTypesModule } from 'src/product_types/product_types.module';
import { LogoModule } from 'src/logo/logo.module';

@Module({
  imports: [
    DatabaseModule,
    PricesModule,
    ProductTypesModule,
    forwardRef(() => LogoModule)
  ],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
