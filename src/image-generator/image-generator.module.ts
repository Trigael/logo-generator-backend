import { Module } from '@nestjs/common';
import { ImageGeneratorService } from './image-generator.service';
import { HttpModule } from '@nestjs/axios';
import { PromptsModule } from 'src/prompts/prompts.module';

@Module({
  imports: [HttpModule, PromptsModule],
  providers: [ImageGeneratorService],
  exports: [ImageGeneratorService]
})
export class ImageGeneratorModule {}
