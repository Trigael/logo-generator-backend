import { Module } from '@nestjs/common';
import { LogoController } from './logo.controller';
import { LogoService } from './logo.service';

// Modules
import { HttpModule } from '@nestjs/axios';
import { ImageGeneratorModule } from 'src/image-generator/image-generator.module';

@Module({
  imports: [HttpModule, ImageGeneratorModule],
  controllers: [LogoController],
  providers: [LogoService],
  exports: [LogoService],
})
export class LogoModule {}
