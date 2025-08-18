import {
  Controller,
  Get,
} from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  HttpHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';
import { PrismaHealthCheckService } from './prisma.health';

@Controller()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly http: HttpHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
    private readonly disk: DiskHealthIndicator,
    private readonly prismaHealth: PrismaHealthCheckService,
  ) {}

  @Get('/health')
  healthCheck() {
    return {
      status: 'ok',
      commit: process.env.GIT_COMMIT_HASH ?? 'unknown',
    };
  }

  @Get('/ready')
  @HealthCheck()
  async ready() {
    return this.health.check([
      () => this.memory.checkHeap('heap_memory', 300 * 1024 * 1024), 
      () => this.disk.checkStorage('disk_health', { path: '/', thresholdPercent: 0.75 }),
      () => this.prismaHealth.checkPrisma(),
    ]);
  }
}
