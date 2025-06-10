import { Module } from '@nestjs/common';
import { PricesService } from './prices.service';

import { DatabaseModule } from 'src/database/database.module';
import { PricesController } from './prices.controller';

@Module({
  imports: [DatabaseModule],
  providers: [PricesService],
  exports: [PricesService],
  controllers: [PricesController],
})
export class PricesModule {}
