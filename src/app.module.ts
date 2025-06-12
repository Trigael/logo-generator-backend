import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LogoModule } from './logo/logo.module';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { ImageGeneratorModule } from './image-generator/image-generator.module';
import { LoggerModule } from './logger/logger.module';
import { PaymentsModule } from './payments/payments.module';
import { DatabaseModule } from './database/database.module';
import { MailModule } from './mail/mail.module';
import { UsersModule } from './users/users.module';
import { PricesModule } from './prices/prices.module';
import { PromptsModule } from './prompts/prompts.module';
import { OrdersModule } from './orders/orders.module';
import { ProductTypesModule } from './product_types/product_types.module';

@Module({
  imports: [LogoModule, HttpModule,
    ConfigModule.forRoot({
      isGlobal: true, 
    }),
    ImageGeneratorModule,
    LoggerModule,
    PaymentsModule,
    DatabaseModule,
    MailModule,
    UsersModule,
    PricesModule,
    PromptsModule,
    OrdersModule,
    ProductTypesModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
