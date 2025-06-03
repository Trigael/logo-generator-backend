import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LogoModule } from './logo/logo.module';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { ImageGeneratorModule } from './image-generator/image-generator.module';
import { LoggerModule } from './logger/logger.module';
import { PaymentsModule } from './payments/payments.module';
import { DatabaseModule } from './database/database.module';
import { MailModule } from './mail/mail.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [LogoModule, HttpModule,
    ConfigModule.forRoot({
      isGlobal: true, 
    }),
    ImageGeneratorModule,
    LoggerModule,
    PaymentsModule,
    DatabaseModule,
    MailModule,
    UsersModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
