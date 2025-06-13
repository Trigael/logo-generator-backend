import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

// Services
import { RequestContextService } from 'src/common/request-context.service';
import { SessionsService } from 'src/sessions/sessions.service';
import { UsersService } from 'src/users/users.service';

@Injectable()
export class ConnectSessionMiddleware implements NestMiddleware {
  constructor(
    private readonly requestContext: RequestContextService,
    private readonly usersService: UsersService,
    private readonly sessionsService: SessionsService,
) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const email = req.body?.email;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const session_id = this.requestContext.sessionId;
    
    // Checking if request contains proper email
    if (typeof email === 'string' && emailRegex.test(email) && typeof session_id === 'string') {
      const user = await this.usersService.getOrCreateGuestUser(email)

      await this.sessionsService.updateSession(session_id, { user: { connect: { id_user: user.id_user }} })
    } 

    next();
  }
}
