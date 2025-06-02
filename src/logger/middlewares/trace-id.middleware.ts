import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

import { AsyncLocalStorage } from 'async_hooks';

export const traceStorage = new AsyncLocalStorage<Map<string, string>>();

@Injectable()
export class TraceIdMiddleware implements NestMiddleware {
  async use(req: Request, res: Response, next: NextFunction) {
    const { nanoid } = await import('nanoid');
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
