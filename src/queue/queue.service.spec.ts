import { Test, TestingModule } from '@nestjs/testing';
import { QueueService } from './queue.service';
import { getQueueToken } from '@nestjs/bullmq';

jest.mock('src/utils/helpers.util', () => ({
  getSecret: jest.fn((v: string) => v || 'mock-secret'),
  getCurrencySymbol: jest.fn(() => '$'), 
}));

jest.mock('node-mailjet', () => ({
  Client: {
    apiConnect: jest.fn(() => ({
      post: jest.fn(() => ({
        request: jest.fn().mockResolvedValue({ body: { success: true } }),
      })),
    })),
  },
}));

describe('QueueService', () => {
  let service: QueueService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueService,
        {
          provide: getQueueToken('mailQueue'), 
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
