import { Module } from '@nestjs/common';

import { WINSTON_MODULE_NEST_PROVIDER, WinstonModule } from 'nest-winston';
import * as winston from 'winston';

import { LokiTransport } from './loki-transport';

import { LoggerService } from './logger.service';

// Modules
import { CommonModule } from 'src/common/common.module';

@Module({
  imports: [
    WinstonModule.forRoot({
      transports: [],
    }),
    CommonModule,
  ],
  providers: [
    LoggerService,
    {
      provide: WINSTON_MODULE_NEST_PROVIDER,
      useFactory: () => {
        const logger = winston.createLogger();

        logger.add(
          new winston.transports.Console({
            format: winston.format.combine(
              winston.format.timestamp(),
              winston.format.printf(
                ({ timestamp, level, message, context, traceId, ip, metadata }) => {
                  const module = typeof context === 'string' ? context : 'GENERAL';
                  const trace = typeof traceId === 'string' ? `[${traceId}]` : '';
                  const ipPart = typeof ip === 'string' ? `:${ip}` : '';
                  const metaStr = metadata ? ` ${JSON.stringify(metadata)}` : '';
                  return `[${timestamp}][${level.toUpperCase()}][${module}]${trace}${ipPart} ${message}${metaStr}`;
                },
              ),
            ),
          }),
        );

        // Loki transport
        logger.add(new LokiTransport())

        return logger;
      },
    },
  ],
  exports: [LoggerService],
})
export class LoggerModule {}
