import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule as ConfigModuleNest} from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { RequestContextService } from './common/request-context.service';

// Middlewares
import { SessionMiddleware } from './middleware/session.middleware';

// Module
import { ImageGeneratorModule } from './image-generator/image-generator.module';
import { LoggerModule } from './logger/logger.module';
import { PaymentsModule } from './payments/payments.module';
import { DatabaseModule } from './database/database.module';
import { LogoModule } from './logo/logo.module';
import { MailModule } from './mail/mail.module';
import { UsersModule } from './users/users.module';
import { PricesModule } from './prices/prices.module';
import { PromptsModule } from './prompts/prompts.module';
import { OrdersModule } from './orders/orders.module';
import { ProductTypesModule } from './product_types/product_types.module';
import { SessionsModule } from './sessions/sessions.module';
import { CommonModule } from './common/common.module';
import { QueueModule } from './queue/queue.module';
import { CronsModule } from './crons/crons.module';
import { HealthModule } from './health/health.module';
import { getSecret } from './utils/helpers.util';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { ConfigModule } from './config/config.module';
import { S3Module } from './s3/s3.module';
import { ImageFormatterModule } from './image-formatter/image-formatter.module';
import { TransformedLogoModule } from './transformed-logo/transformed-logo.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { TextCleanerModule } from './text-cleaner/text-cleaner.module';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
      serveRoot: '/', 
      exclude: ['/api*'],
    }),
    ConfigModuleNest.forRoot({
      isGlobal: true, 
    }),
    LogoModule, 
    HttpModule,
    ImageGeneratorModule,
    LoggerModule,
    PaymentsModule,
    DatabaseModule,
    MailModule,
    UsersModule,
    PricesModule,
    PromptsModule,
    OrdersModule,
    ProductTypesModule,
    SessionsModule,
    CommonModule,
    QueueModule,
    CronsModule,
    HealthModule,
    ConfigModule,
    S3Module,
    ImageFormatterModule,
    TransformedLogoModule,
    WebhooksModule,
    TextCleanerModule,
  ],
  controllers: [AppController],
  providers: [AppService, RequestContextService],
})

export class AppModule {}
