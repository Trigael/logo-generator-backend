import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LogoModule } from './logo/logo.module';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { ImageGeneratorModule } from './image-generator/image-generator.module';

@Module({
  imports: [LogoModule, HttpModule,
    ConfigModule.forRoot({
      isGlobal: true, 
    }),
    ImageGeneratorModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
