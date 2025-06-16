// src/health/prisma.health.ts

import { Injectable } from '@nestjs/common';
import { HealthIndicatorResult } from '@nestjs/terminus';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaHealthCheckService {
  constructor(private readonly prisma: PrismaClient) {}

  async checkPrisma(): Promise<HealthIndicatorResult> {
    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');
      return {
        prisma: {
          status: 'up',
        },
      };
    } catch {
      return {
        prisma: {
          status: 'down',
        },
      };
    }
  }
}
