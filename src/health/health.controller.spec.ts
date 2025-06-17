import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { DiskHealthIndicator, HealthCheckService, HttpHealthIndicator, MemoryHealthIndicator, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { DatabaseModule } from 'src/database/database.module';
import { PrismaHealthCheckService } from './prisma.health';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: {} },
        { provide: HttpHealthIndicator, useValue: {} },
        { provide: DatabaseModule, useValue: {} },
        { provide: MemoryHealthIndicator, useValue: {} },
        { provide: DiskHealthIndicator, useValue: {} },
        { provide: PrismaHealthCheckService, useValue: {} },
        { provide: TypeOrmHealthIndicator, useValue: {} },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
