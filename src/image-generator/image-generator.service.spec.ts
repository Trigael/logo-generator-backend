import { Test, TestingModule } from '@nestjs/testing';
import { ImageGeneratorService } from './image-generator.service';
import { HttpService } from '@nestjs/axios';
import { PromptsService } from 'src/prompts/prompts.service';

describe('ImageGeneratorService', () => {
  let service: ImageGeneratorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImageGeneratorService,
        { provide: HttpService, useValue: {} },
        { provide: PromptsService, useValue: {} },
      ],
    }).compile();

    service = module.get<ImageGeneratorService>(ImageGeneratorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
