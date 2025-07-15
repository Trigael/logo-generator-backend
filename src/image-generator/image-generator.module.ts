import { forwardRef, Module } from '@nestjs/common';
import { ImageGeneratorService } from './image-generator.service';

import { HttpModule } from '@nestjs/axios';
import { PromptsModule } from 'src/prompts/prompts.module';
import { ConfigModule } from 'src/config/config.module';
import { S3Module } from 'src/s3/s3.module';

@Module({
  imports: [
    HttpModule, 
    PromptsModule,
    S3Module,

    forwardRef(() => ConfigModule),
  ],
  providers: [ImageGeneratorService],
  exports: [ImageGeneratorService]
})
export class ImageGeneratorModule {}
