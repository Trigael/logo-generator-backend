import { Test, TestingModule } from '@nestjs/testing';
import { LogoService } from './logo.service';
import { DatabaseService } from 'src/database/database.service';
import { ImageGeneratorService } from 'src/image-generator/image-generator.service';
import { PricesService } from 'src/prices/prices.service';
import { UsersService } from 'src/users/users.service';
import { OrdersService } from 'src/orders/orders.service';
import { ProductTypesService } from 'src/product_types/product_types.service';
import { PaymentsService } from 'src/payments/payments.service';

describe('LogoService', () => {
  let service: LogoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LogoService,
        { provide: DatabaseService, useValue: {} },
        { provide: ImageGeneratorService, useValue: {} },
        { provide: PricesService, useValue: {} },
        { provide: UsersService, useValue: {} },
        { provide: OrdersService, useValue: {} },
        { provide: ProductTypesService, useValue: {} },
        { provide: PaymentsService, useValue: {} },
      ],
    }).compile();

    service = module.get<LogoService>(LogoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
