import { Module } from '@nestjs/common';
import { S3Service } from './s3.service';
import { ConfigModule } from 'src/config/config.module';
import { LoggerModule } from 'src/logger/logger.module';

@Module({
  imports: [
    ConfigModule,
    LoggerModule,
  ],
  providers: [S3Service],
  exports: [S3Service],
})
export class S3Module {}
