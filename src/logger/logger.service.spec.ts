import { Test, TestingModule } from '@nestjs/testing';
import { LoggerService } from './logger.service';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { RequestContextService } from 'src/common/request-context.service';

describe('LoggerService', () => {
  let service: LoggerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoggerService,
        { provide: WINSTON_MODULE_NEST_PROVIDER, useValue: {} },
        { provide: RequestContextService, useValue: {} },
      ],
    }).compile();

    service = module.get<LoggerService>(LoggerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
