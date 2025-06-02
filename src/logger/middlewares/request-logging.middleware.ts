import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { LoggerService } from 'src/logger/logger.service';

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  constructor(private readonly logger: LoggerService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl } = req;
    const ip: any =
      req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    const start = Date.now();

    res.on('finish', () => {
      const statusCode = res.statusCode;
      const duration = Date.now() - start;

      this.logger.log(`${method} ${originalUrl} ${statusCode} - ${duration}ms`, {
        context: 'HTTP',
        ip, 
        metadata: {
          userAgent: req.headers['user-agent'],
        },
      });
    });

    next();
  }
}
