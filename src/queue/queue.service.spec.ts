import { Test, TestingModule } from '@nestjs/testing';
import { QueueService } from './queue.service';
import { getQueueToken } from '@nestjs/bullmq';

describe('QueueService', () => {
  let service: QueueService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueService,
        {
          provide: getQueueToken('mailjetQueue'), 
          useValue: {
            add: jest.fn(), 
          },
        },
      ],
    }).compile();

    service = module.get<QueueService>(QueueService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
