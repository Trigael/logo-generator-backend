import { Test, TestingModule } from '@nestjs/testing';
import { ImageFormatterService } from './image-formatter.service';

describe('ImageFormatterService', () => {
  let service: ImageFormatterService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ImageFormatterService],
    }).compile();

    service = module.get<ImageFormatterService>(ImageFormatterService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
