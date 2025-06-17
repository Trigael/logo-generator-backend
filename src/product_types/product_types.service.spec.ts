import { Test, TestingModule } from '@nestjs/testing';
import { ProductTypesService } from './product_types.service';
import { DatabaseService } from 'src/database/database.service';

describe('ProductTypesService', () => {
  let service: ProductTypesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductTypesService,
        { provide: DatabaseService, useValue: {} },
      ],
    }).compile();

    service = module.get<ProductTypesService>(ProductTypesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
