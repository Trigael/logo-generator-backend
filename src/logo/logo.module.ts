import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { LogoController } from './logo.controller';
import { LogoService } from './logo.service';

// Modules
import { ImageGeneratorModule } from 'src/image-generator/image-generator.module';
import { DatabaseModule } from 'src/database/database.module';
import { PaymentsModule } from 'src/payments/payments.module';
import { PricesModule } from 'src/prices/prices.module';
import { UsersModule } from 'src/users/users.module';

@Module({
  imports: [
    HttpModule, 
    ImageGeneratorModule, 
    DatabaseModule,
    PaymentsModule,
    PricesModule,
    UsersModule,
  ],
  controllers: [LogoController],
  providers: [LogoService],
  exports: [LogoService],
})
export class LogoModule {}
