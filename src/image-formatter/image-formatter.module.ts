import { Module } from '@nestjs/common';

import { ImageFormatterService } from './image-formatter.service';

// Modules
import { S3Module } from 'src/s3/s3.module';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  imports: [
    S3Module,
  ],
  providers: [ImageFormatterService],
  exports: [ImageFormatterService],
})
export class ImageFormatterModule {}
