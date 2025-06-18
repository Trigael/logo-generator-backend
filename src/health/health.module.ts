import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';
import { HealthController } from './health.controller';
import { PrismaHealthCheckService } from './prisma.health';
import { PrismaClient } from '@prisma/client';

@Module({
  imports: [TerminusModule, HttpModule],
  controllers: [HealthController],
  providers: [
    PrismaHealthCheckService,
    {
      provide: PrismaClient,
      useFactory: () => {
        const prisma = new PrismaClient();
        return prisma;
      },
    },
  ]
})
export class HealthModule {}
