import { Module } from '@nestjs/common';
import { TextCleanerService } from './text-cleaner.service';

@Module({
  providers: [TextCleanerService],
  exports: [TextCleanerService],
})
export class TextCleanerModule {}
