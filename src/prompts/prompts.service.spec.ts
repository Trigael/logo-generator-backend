import { Test, TestingModule } from '@nestjs/testing';
import { PromptsService } from './prompts.service';
import { DatabaseService } from 'src/database/database.service';

describe('PromptsService', () => {
  let service: PromptsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PromptsService,
        { provide: DatabaseService, useValue: {} },
      ],
    }).compile();

    service = module.get<PromptsService>(PromptsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
