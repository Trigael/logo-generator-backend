import { Test, TestingModule } from '@nestjs/testing';
import { TextCleanerService } from './text-cleaner.service';

describe('TextCleanerService', () => {
  let service: TextCleanerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TextCleanerService],
    }).compile();

    service = module.get<TextCleanerService>(TextCleanerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
