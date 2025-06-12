// all-exceptions.filter.ts
import { Catch, ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { SentryService } from '@ntegral/nestjs-sentry';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly sentryService: SentryService) {}

  catch(exception: any, host: ArgumentsHost) {
    // Send exception to Sentry
    this.sentryService.instance().captureException(exception);

    // Usual Nest error response logic here
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const status = exception.getStatus?.() || 500;
    const message = exception.message ?? 'Internal server error';

    response.status(status).json({
      statusCode: status,
      message,
    });
  }
}
