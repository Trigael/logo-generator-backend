import { forwardRef, Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

// Modules
import { DatabaseModule } from 'src/database/database.module';
import { MailModule } from 'src/mail/mail.module';
import { LogoModule } from 'src/logo/logo.module';

@Module({
  imports: [
    HttpModule, 
    DatabaseModule, 
    MailModule,
    forwardRef(() => LogoModule),
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService]
})
export class PaymentsModule {}
