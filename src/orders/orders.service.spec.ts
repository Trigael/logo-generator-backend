import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { DatabaseService } from 'src/database/database.service';
import { PricesService } from 'src/prices/prices.service';
import { ProductTypesService } from 'src/product_types/product_types.service';

describe('OrdersService', () => {
  let service: OrdersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: DatabaseService, useValue: {} },
        { provide: PricesService, useValue: {} },
        { provide: ProductTypesService, useValue: {} },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
