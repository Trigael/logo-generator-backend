import { Module } from '@nestjs/common';
import { ImageGeneratorService } from './image-generator.service';

import { HttpModule } from '@nestjs/axios';
import { PromptsModule } from 'src/prompts/prompts.module';
import { ConfigModule } from 'src/config/config.module';

@Module({
  imports: [
    HttpModule, 
    PromptsModule,
    ConfigModule,
  ],
  providers: [ImageGeneratorService],
  exports: [ImageGeneratorService]
})
export class ImageGeneratorModule {}
