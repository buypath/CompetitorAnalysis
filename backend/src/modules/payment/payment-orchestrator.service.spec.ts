// MIT Licence — AI CFO Wallet — Buypath Ltd
// Unit tests for PaymentOrchestratorService

import { Test, TestingModule } from '@nestjs/testing';
import { PaymentOrchestratorService } from './payment-orchestrator.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StripeService } from './stripe.service';
import { ModulrService } from './modulr.service';
import { CircleService } from './circle.service';
import {
  DuplicatePaymentException,
  InsufficientFundsException,
  KycNotApprovedException,
} from '../../common/exceptions/business.exception';

describe('PaymentOrchestratorService', () => {
  let service: PaymentOrchestratorService;
  let prisma: jest.Mocked<PrismaService>;

  const mockBusiness = {
    id: 'biz-001',
    kycStatus: 'APPROVED',
    name: 'Test Business',
    subscriptionTier: 'GROWTH',
    country: 'GB',
    timezone: 'Europe/London',
    settings: {},
    registrationNumber: null,
    vatNumber: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockWallet = {
    id: 'wallet-001',
    businessId: 'biz-001',
    type: 'FIAT',
    currency: 'GBP',
    balance: 10000,
    smartAccountAddress: null,
    parentWalletId: null,
    label: 'Primary GBP',
    isDefault: true,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockPrisma = {
      transaction: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      business: { findUnique: jest.fn() },
      wallet: { findUnique: jest.fn(), update: jest.fn() },
    };

    const mockStripe = { createDepositIntent: jest.fn() };
    const mockModulr = { sendFasterPayment: jest.fn() };
    const mockCircle = { transferUsdc: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentOrchestratorService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: StripeService, useValue: mockStripe },
        { provide: ModulrService, useValue: mockModulr },
        { provide: CircleService, useValue: mockCircle },
      ],
    }).compile();

    service = module.get<PaymentOrchestratorService>(PaymentOrchestratorService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createPayment', () => {
    const baseDto = {
      businessId: 'biz-001',
      fromWalletId: 'wallet-001',
      amount: 100,
      currency: 'GBP' as const,
      idempotencyKey: 'unique-key-001',
    };

    it('should throw DuplicatePaymentException if payment with same idempotency key is already completed', async () => {
      (prisma.transaction.findUnique as jest.Mock).mockResolvedValue({
        id: 'existing-tx',
        status: 'COMPLETED',
      });

      await expect(service.createPayment(baseDto)).rejects.toThrow(DuplicatePaymentException);
    });

    it('should return existing pending transaction without re-processing', async () => {
      (prisma.transaction.findUnique as jest.Mock).mockResolvedValue({
        id: 'existing-tx',
        status: 'PENDING',
      });

      const result = await service.createPayment(baseDto);
      expect(result).toEqual({ id: 'existing-tx', status: 'PENDING' });
    });

    it('should throw KycNotApprovedException if business KYC is not approved', async () => {
      (prisma.transaction.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.business.findUnique as jest.Mock).mockResolvedValue({
        ...mockBusiness,
        kycStatus: 'PENDING',
      });

      await expect(service.createPayment(baseDto)).rejects.toThrow(KycNotApprovedException);
    });

    it('should throw InsufficientFundsException if wallet balance is insufficient', async () => {
      (prisma.transaction.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.business.findUnique as jest.Mock).mockResolvedValue(mockBusiness);
      (prisma.wallet.findUnique as jest.Mock).mockResolvedValue({
        ...mockWallet,
        balance: 50, // Less than the 100 amount
      });

      await expect(service.createPayment({ ...baseDto, amount: 100 })).rejects.toThrow(InsufficientFundsException);
    });
  });
});
