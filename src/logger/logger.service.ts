import { Injectable, Inject } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

import { traceStorage } from './middlewares/trace-id.middleware'; 
import { sanitizeLogData } from './sanitize-log.util';

interface LogOptions {
  context?: string;
  traceId?: string;
  ip?: string;
  metadata?: Record<string, any>;
}

const isSanitizationEnabled = () => process.env.SANITIZE_LOGS === 'true';

@Injectable()
export class LoggerService {
    constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: any,
  ) {}

  log(message: string, options: LogOptions = {}) {
    const store = traceStorage.getStore();

    this.logger.log({
      level: 'info',
      message,
      ...options,
      traceId: options.traceId ?? store?.get('traceId'),
      ip: options.ip ?? store?.get('ip'),
      metadata: this.maybeSanitize(options.metadata),
    });
  }

  error(message: string, options: LogOptions = {}) {
    const store = traceStorage.getStore();

    this.logger.error({
      level: 'error',
      message,
      ...options,
      traceId: options.traceId ?? store?.get('traceId'),
      ip: options.ip ?? store?.get('ip'),
      metadata: this.maybeSanitize(options.metadata),
    });
  }

  warn(message: string, options: LogOptions = {}) {
    const store = traceStorage.getStore();

    this.logger.warn({
      level: 'warn',
      message,
      ...options,
      traceId: options.traceId ?? store?.get('traceId'),
      ip: options.ip ?? store?.get('ip'),
      metadata: this.maybeSanitize(options.metadata),
    });
  }

  debug(message: string, options: LogOptions = {}) {
    const store = traceStorage.getStore();

    this.logger.debug({
      level: 'debug',
      message,
      ...options,
      traceId: options.traceId ?? store?.get('traceId'),
      ip: options.ip ?? store?.get('ip'),
      metadata: this.maybeSanitize(options.metadata),
    });
  }

  //#region PRIVATE FUNCTIONS
  private maybeSanitize(metadata?: Record<string, any>) {
    return isSanitizationEnabled() && metadata ? sanitizeLogData(metadata) : metadata;
  }  
  //#endregion
}
