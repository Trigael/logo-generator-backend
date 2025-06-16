import { Module } from '@nestjs/common';
import { CronsService } from './crons.service';

// Modules
import { LogoModule } from 'src/logo/logo.module';

@Module({
  imports: [
    LogoModule,
  ],
  providers: [CronsService],
  exports: [CronsService],
})
export class CronsModule {}
