// src/common/request-context/request-context.service.ts
import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

interface RequestContextStore {
  sessionId?: string;
  session?: any;
}

@Injectable()
export class RequestContextService {
  private readonly asyncLocalStorage = new AsyncLocalStorage<RequestContextStore>();

  run(store: RequestContextStore, callback: (...args: any[]) => void) {
    this.asyncLocalStorage.run(store, callback);
  }

  get store(): RequestContextStore {
    return this.asyncLocalStorage.getStore() ?? {};
  }

  get sessionId(): string | undefined {
    return this.store.sessionId;
  }

  get session(): any | undefined {
    return this.store.session;
  }
}
