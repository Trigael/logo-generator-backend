/* eslint-disable prettier/prettier */
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const errorResponse = exception.getResponse();

      this.logger.error(`Caught HTTP Exception:`, JSON.stringify(errorResponse));

      response.status(status).json({
        statusCode: status,
        message: (errorResponse as any).message || "Unexpected error occurred",
        errorCode: (errorResponse as any).errorCode || "UNHANDLED_EXCEPTION",
      });

      return;
    }

    // Pokud to není `HttpException`, chytíme obecnou chybu
    this.logger.error(`Caught Unhandled Exception:`, exception);

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: "Internal Server Error",
      errorCode: "INTERNAL_ERROR",
    });
  }
}