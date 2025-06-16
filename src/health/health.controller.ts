import {
  Controller,
  Get,
} from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  HttpHealthIndicator,
  TypeOrmHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';
import { PrismaHealthCheckService } from './prisma.health';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly http: HttpHealthIndicator,
    private readonly db: TypeOrmHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
    private readonly disk: DiskHealthIndicator,
    private readonly prismaHealth: PrismaHealthCheckService,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.memory.checkHeap('heap_memory', 300 * 1024 * 1024), // 300MB
      () => this.disk.checkStorage('disk_health', {
        path: '/', // TODO: Docker upgrade
        thresholdPercent: 0.75, // 75%
      }),
      () => this.prismaHealth.checkPrisma(),
    ]);
  }
}
