import { Test, TestingModule } from '@nestjs/testing';
import { MailService } from './mail.service';
import { PaymentsService } from 'src/payments/payments.service';
import { UsersService } from 'src/users/users.service';
import { LogoService } from 'src/logo/logo.service';

jest.mock('src/utils/helpers.util', () => ({
  getSecret: jest.fn((v: string) => v || 'mock-secret'),
  getCurrencySymbol: jest.fn(() => '$'), 
}));

describe('MailService', () => {
  let service: MailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        { provide: PaymentsService, useValue: {} },
        { provide: UsersService, useValue: {} },
        { provide: LogoService, useValue: {} },
      ],
    }).compile();

    service = module.get<MailService>(MailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
