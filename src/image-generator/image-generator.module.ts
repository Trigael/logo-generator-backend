import { forwardRef, Module } from '@nestjs/common';
import { ImageGeneratorService } from './image-generator.service';

import { HttpModule } from '@nestjs/axios';
import { PromptsModule } from 'src/prompts/prompts.module';
import { ConfigModule } from 'src/config/config.module';
import { S3Module } from 'src/s3/s3.module';
import { TextCleanerModule } from 'src/text-cleaner/text-cleaner.module';
import { ImageFormatterModule } from 'src/image-formatter/image-formatter.module';
import { LoggerModule } from 'src/logger/logger.module';

@Module({
  imports: [
    HttpModule, 
    PromptsModule,
    S3Module,
    TextCleanerModule,
    ImageFormatterModule,
    LoggerModule,
    forwardRef(() => ConfigModule), 
  ],
  providers: [ImageGeneratorService],
  exports: [ImageGeneratorService]
})
export class ImageGeneratorModule {}
