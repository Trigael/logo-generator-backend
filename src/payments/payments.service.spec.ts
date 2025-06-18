import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { DatabaseService } from 'src/database/database.service';
import { HttpService } from '@nestjs/axios';
import { MailService } from 'src/mail/mail.service';
import { UsersService } from 'src/users/users.service';
import { LogoService } from 'src/logo/logo.service';
import { OrdersService } from 'src/orders/orders.service';
import { LoggerService } from 'src/logger/logger.service';
import { Payment_states } from '@prisma/client';
import Stripe from 'stripe';
import { QueueService } from 'src/queue/queue.service';

jest.mock('src/utils/helpers.util', () => ({
  getSecret: jest.fn((v: string) => v || 'mock-secret'),
  getCurrencySymbol: jest.fn(() => '$'), 
}));

const mockPayment = {
  id_payment: 1,
  order_id: 1,
  user_id: 1,
  stripe_id: 'stripe-session-id',
  state: Payment_states.CREATED,
  created_at: new Date(),
  updated_at: new Date(),
  deteled_at: null,
  deleted: false,
  metadata: {},
};

describe('PaymentsService', () => {
  let service: PaymentsService;
  let db: DatabaseService;

  const retrieveMock = jest.fn();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: DatabaseService,
          useValue: {
            payments: {
              findUnique: jest.fn().mockResolvedValue(mockPayment),
              findFirst: jest.fn().mockResolvedValue(mockPayment),
              update: jest.fn().mockResolvedValue({ ...mockPayment, state: Payment_states.COMPLETED }),
              create: jest.fn().mockResolvedValue(mockPayment),
            },
            order_items: {
              findMany: jest.fn().mockResolvedValue([]),
            },
            prompted_logos: {
              update: jest.fn(),
            },
            archived_logos: {
              findFirst: jest.fn(),
            },
          },
        },
        {
          provide: HttpService,
          useValue: {},
        },
        {
          provide: MailService,
          useValue: { sendLogoEmailAfterPayment: jest.fn() },
        },
        {
          provide: UsersService,
          useValue: { getUser: jest.fn().mockResolvedValue({ email: 'test@example.com' }) },
        },
        {
          provide: LoggerService,
          useValue: { log: jest.fn() },
        },
        {
          provide: LogoService,
          useValue: {},
        },
        {
          provide: OrdersService,
          useValue: {
            getOrder: jest.fn().mockResolvedValue({ total_amount_cents: 1000, currency: 'USD' }),
            updateOrder: jest.fn().mockResolvedValue({}),
          },
        },
        {
          provide: QueueService,
          useValue: {}
        }
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    db = module.get<DatabaseService>(DatabaseService);

    // Mock Stripe
    service.stripe = {
      checkout: {
        sessions: {
          retrieve: retrieveMock,
          create: jest.fn().mockResolvedValue({
            url: 'https://mock-stripe.com/payment',
            id: 'stripe-session-id',
          }),
        },
      },
      webhooks: {
        constructEvent: jest.fn().mockReturnValue({
          type: 'checkout.session.completed',
          data: { object: { id: 'stripe-session-id' } },
        }),
      },
    } as any;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('getPayment should return payment', async () => {
    const result = await service.getPayment(1);
    expect(result).toEqual(mockPayment);
  });

  it('getPaymentByStripeID should return payment', async () => {
    const result = await service.getPaymentByStripeID('stripe-session-id');
    expect(result).toEqual(mockPayment);
  });

  it('updatePayment should update and return payment', async () => {
    const result = await service.updatePayment(99, { state: Payment_states.COMPLETED });
    expect(result.state).toBe(Payment_states.COMPLETED);
  });

  it('updatePaymentByStripeID should update payment state', async () => {
    const result = await service.updatePaymentByStripeID('stripe-session-id', Payment_states.COMPLETED);
    expect(result.state).toBe(Payment_states.COMPLETED);
  });

  it('verifyPayment should return PAID if session is paid', async () => {
    const stripeSessionMock = {
      payment_status: 'paid',
      id: 'stripe-session-id',
    };

    retrieveMock.mockResolvedValue(stripeSessionMock);

    const result = await service.verifyPayment({ session_id: 'stripe-session-id' });
    expect(result.payment_state).toBe('PAID');
    expect(retrieveMock).toHaveBeenCalledWith('stripe-session-id');
  });

  it('verifyPayment should return UNPAID if session not paid', async () => {
    const stripeSessionMock = {
      payment_status: 'unpaid',
      id: 'stripe-session-id',
    };

    retrieveMock.mockResolvedValue(stripeSessionMock);

    const result = await service.verifyPayment({ session_id: 'stripe-session-id' });
    expect(result.payment_state).toBe('UNPAID');
    expect(retrieveMock).toHaveBeenCalledWith('stripe-session-id');
  });
});
