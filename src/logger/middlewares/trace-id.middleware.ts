import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { nanoid } from 'nanoid';
import { AsyncLocalStorage } from 'async_hooks';

export const traceStorage = new AsyncLocalStorage<Map<string, string>>();

@Injectable()
export class TraceIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const store = new Map<string, string>();
    const traceId = nanoid(6); 
    const ip = req.ip ?? req.headers['x-forwarded-for'] ?? req.socket.remoteAddress;

    store.set('traceId', traceId);
    store.set('ip', typeof ip === 'string' ? ip : '');

    traceStorage.run(store, () => {
      next();
    });
  }
}
