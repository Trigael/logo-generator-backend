import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

// Modules
import { DatabaseModule } from 'src/database/database.module';
import { MailModule } from 'src/mail/mail.module';

@Module({
  imports: [
    HttpModule, 
    DatabaseModule, 
    MailModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService]
})
export class PaymentsModule {}
