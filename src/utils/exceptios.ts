/* eslint-disable prettier/prettier */
import { HttpException, HttpStatus } from '@nestjs/common';

export class InvalidTokenException extends HttpException {
  constructor(message?: string, errorCode?: string) {
    super(
      { 
        statusCode: 401, 
        message: message ?? 'Invalid or expired access token', 
        error: 'Unauthorized',
        errorCode: errorCode ?? 'INVALID_TOKEN'
    } as Record<string, unknown>,
      HttpStatus.UNAUTHORIZED,
    );
  }
}

export class UnauthorizedException extends HttpException {
    constructor(message?: string, errorCode?: string) {
      super(
        { 
          statusCode: 401, 
          message: message ?? 'Provide authorization token to access', 
          error: 'Unauthorized',
          errorCode: errorCode ?? 'UNAUTHORIZED'
      } as Record<string, unknown>,
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  export class InvalidDataException extends HttpException {
    constructor(message?: string, errorCode?: string) {
      super(
        { 
          statusCode: 400, 
          message: message ?? 'Provided data is invalid', 
          error: 'Bad Request',
          errorCode: errorCode ?? 'INVALID_DATA'
      } as Record<string, unknown>,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  export class InternalErrorException extends HttpException {
    constructor(message?: string, errorCode?: string) {
      super(
        { 
          statusCode: 500, 
          message: message ?? 'An unexpected error occurred', 
          error: 'Internal Error',
          errorCode: errorCode ?? 'INTERNAL_ERROR'
      } as Record<string, unknown>,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  export class FullCapacityException extends HttpException {
    constructor(message?: string, errorCode?: string) {
      super(
        { 
          statusCode: 409, 
          message: message ?? 'Gym at this time is already full', 
          error: 'Conflict',
          errorCode: errorCode ?? 'CAPACITY_FULL'
      } as Record<string, unknown>,
        HttpStatus.CONFLICT,
      );
    }
  }

  export class RequestTimeoutException extends HttpException {
    constructor(message?: string, errorCode?: string) {
      super(
        { 
          statusCode: 408, 
          message: message ?? 'Request Timeout', 
          error: 'Request Timeout',
          errorCode: errorCode ?? 'REQUEST_TIMEOUT'
      } as Record<string, unknown>,
        HttpStatus.REQUEST_TIMEOUT,
      );
    }
  }

  export class PaymentFailedException extends HttpException {
    constructor(message?: string, errorCode?: string) {
      super(
        { 
          statusCode: 422, 
          message: message ?? 'Payment was denied or failed.', 
          error: 'Unprocessable Entity',
          errorCode: errorCode ?? 'PAYMENT_FAILED'
      } as Record<string, unknown>,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
  }

  export class BadRequestException extends HttpException {
    constructor(message?: string, errorCode?: string) {
      super(
        { 
          statusCode: 400, 
          message: message ?? 'Bad Request', 
          error: 'Bad Request',
          errorCode: errorCode ?? 'BAD_REQUEST'
      } as Record<string, unknown>,
        HttpStatus.BAD_REQUEST,
      );
    }
  }
