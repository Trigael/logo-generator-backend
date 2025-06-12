// src/sessions/session.service.ts
import { Injectable } from '@nestjs/common';
import { Sessions } from '@prisma/client';
import { UAParser } from 'ua-parser-js';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class SessionsService {
  constructor(private readonly db: DatabaseService) {}

  async getSession(sessionId: string): Promise<Sessions | null> {
    return this.db.sessions.findUnique({
      where: { id_session: sessionId },
    });
  }

  async createSession(ipAddress: string, userAgent: string): Promise<Sessions> {
    const parser = new UAParser(userAgent);
    const ua = parser.getResult();
    
    return this.db.sessions.create({
      data: {
        ip_address: ipAddress,
        user_agent: userAgent,
        browser: `${ua.browser.name ?? ''} ${ua.browser.version ?? ''}`,
      },
    });
  }
}
