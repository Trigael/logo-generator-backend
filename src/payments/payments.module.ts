import { Module } from '@nestjs/common';

import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { HttpModule } from '@nestjs/axios';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  imports: [HttpModule, DatabaseModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService]
})
export class PaymentsModule {}
