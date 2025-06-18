import { Catch, ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import * as Sentry from '@sentry/node';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    // Report to Sentry přímo
    Sentry.captureException(exception);

    // Response handling (stejné jako předtím)
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const status = exception.getStatus?.() ?? 500;
    const message = exception.message ?? 'Internal server error';

    response.status(status).json({
      statusCode: status,
      message,
    });
  }
}
