import { Test, TestingModule } from '@nestjs/testing';
import { TransformedLogoService } from './transformed-logo.service';

describe('TransformedLogoService', () => {
  let service: TransformedLogoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TransformedLogoService],
    }).compile();

    service = module.get<TransformedLogoService>(TransformedLogoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
