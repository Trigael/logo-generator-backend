import { Test, TestingModule } from '@nestjs/testing';
import { PricesService } from './prices.service';
import { DatabaseService } from 'src/database/database.service';
import { ProductTypesService } from 'src/product_types/product_types.service';
import { RequestContextService } from 'src/common/request-context.service';

describe('PricesService', () => {
  let service: PricesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PricesService,
        { provide: DatabaseService, useValue: {} },
        { provide: ProductTypesService, useValue: {} },
        { provide: RequestContextService, useValue: {} },
      ],
    }).compile();

    service = module.get<PricesService>(PricesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
