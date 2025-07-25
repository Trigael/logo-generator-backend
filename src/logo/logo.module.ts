import { forwardRef, Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { LogoController } from './logo.controller';
import { LogoService } from './logo.service';

// Modules
import { ImageGeneratorModule } from 'src/image-generator/image-generator.module';
import { DatabaseModule } from 'src/database/database.module';
import { PaymentsModule } from 'src/payments/payments.module';
import { PricesModule } from 'src/prices/prices.module';
import { UsersModule } from 'src/users/users.module';
import { OrdersModule } from 'src/orders/orders.module';
import { ProductTypesModule } from 'src/product_types/product_types.module';
import { ConfigModule } from 'src/config/config.module';
import { S3Module } from 'src/s3/s3.module';

@Module({
  imports: [
    HttpModule, 
    ImageGeneratorModule, 
    DatabaseModule,
    PricesModule,
    UsersModule,
    OrdersModule,
    ProductTypesModule,
    ConfigModule,
    S3Module,
    forwardRef(() => PaymentsModule),
  ],
  controllers: [LogoController],
  providers: [LogoService],
  exports: [LogoService],
})
export class LogoModule {}
