import { Module } from '@nestjs/common';

import { TransformedLogoService } from './transformed-logo.service';

// Modules
import { DatabaseModule } from 'src/database/database.module';

@Module({
  imports: [
    DatabaseModule
  ],
  providers: [TransformedLogoService],
  exports: [TransformedLogoService],
})
export class TransformedLogoModule {}
