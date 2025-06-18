import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { Sessions } from '@prisma/client';
import { randomUUID } from 'crypto';

// Services
import { SessionsService } from 'src/sessions/sessions.service';
import { RequestContextService } from 'src/common/request-context.service';
import { getSecret } from 'src/utils/helpers.util';

@Injectable()
export class SessionMiddleware implements NestMiddleware {
  constructor(
    private readonly sessionService: SessionsService,
    private readonly requestContext: RequestContextService,
) {}

  async use(req: Request, res: Response, next: NextFunction) {
    let sessionId = getSecret(process.env.NODE_ENV ?? '') == 'production' ? req.cookies?.session_id : 'dev_session'
    let session: Sessions | null = null;
    
    if (sessionId) {
      session = await this.sessionService.getSession(sessionId);
      
      if (!session) {
        // Session in cookie is invalid → generate new one
        sessionId = undefined;
      }
    }

    if (!sessionId) {
      // Create new session in DB
      session = await this.sessionService.createSession(
        req.ip ?? 'unspecified',
        req.headers['user-agent'] ?? '',
      );

      sessionId = session.id_session;

      // Set cookie
      res.cookie('session_id', sessionId, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 24 * 1, // 1 day
      });
    }

    // Save to RequestContextService (global per request)
    this.requestContext.run(
      { sessionId, session },
      () => {
        // Also attach to req 
        (req as any).sessionId = sessionId;
        (req as any).session = session;

        next();
      },
    );
  }
}
