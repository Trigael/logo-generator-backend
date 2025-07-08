import { forwardRef, Module } from '@nestjs/common';

import { MailService } from './mail.service';

import { PaymentsModule } from 'src/payments/payments.module';
import { UsersModule } from 'src/users/users.module';
import { LogoModule } from 'src/logo/logo.module';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  imports: [
    forwardRef(() => DatabaseModule),
    forwardRef(() => PaymentsModule),
    forwardRef(() => UsersModule),
    forwardRef(() => LogoModule),
  ],
  providers: [MailService],
  exports: [MailService]
})
export class MailModule {}
