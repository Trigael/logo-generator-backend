import { Test, TestingModule } from '@nestjs/testing';
import { CronsService } from './crons.service';
import { LogoService } from 'src/logo/logo.service';

describe('CronsService', () => {
  let service: CronsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CronsService,
        { provide: LogoService, useValue: {} }
      ],
    }).compile();

    service = module.get<CronsService>(CronsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
