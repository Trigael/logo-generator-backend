import { Injectable, Inject } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

// Middlewares
import { traceStorage } from './middlewares/trace-id.middleware'; 

// Utils
import { sanitizeLogData } from './sanitize-log.util';

// Services
import { RequestContextService } from 'src/common/request-context.service';

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

    private readonly requestContext: RequestContextService,
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
      dynamicMeta: (logEvent) => ({
        session_id: this.requestContext.sessionId,
      })
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
      dynamicMeta: (logEvent) => ({
        session_id: this.requestContext.sessionId,
      })
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
      dynamicMeta: (logEvent) => ({
        session_id: this.requestContext.sessionId,
      })
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
      dynamicMeta: (logEvent) => ({
        session_id: this.requestContext.sessionId,
      })
    });
  }

  //#region PRIVATE FUNCTIONS
  private maybeSanitize(metadata?: Record<string, any>) {
    return isSanitizationEnabled() && metadata ? sanitizeLogData(metadata) : metadata;
  }  
  //#endregion
}
