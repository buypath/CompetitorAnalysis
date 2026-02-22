// MIT Licence — AI CFO Wallet — Buypath Ltd
// Unit tests for TransactionCategorizerService

import { Test, TestingModule } from '@nestjs/testing';
import { TransactionCategorizerService } from './transaction-categorizer.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

describe('TransactionCategorizerService', () => {
  let service: TransactionCategorizerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionCategorizerService,
        {
          provide: PrismaService,
          useValue: {
            transaction: { findMany: jest.fn(), update: jest.fn() },
          },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('test-key') },
        },
      ],
    }).compile();

    service = module.get<TransactionCategorizerService>(TransactionCategorizerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('applyRuleBasedCategories', () => {
    it('should categorise Stripe payments as SALES_REVENUE', () => {
      expect(service.applyRuleBasedCategories('Stripe — client payment')).toBe('SALES_REVENUE');
    });

    it('should categorise payroll as PAYROLL', () => {
      expect(service.applyRuleBasedCategories('Monthly payroll batch')).toBe('PAYROLL');
    });

    it('should categorise AWS as SAAS_SUBSCRIPTIONS', () => {
      expect(service.applyRuleBasedCategories('AWS — November invoice')).toBe('SAAS_SUBSCRIPTIONS');
    });

    it('should categorise HMRC VAT as VAT_PAYABLE', () => {
      expect(service.applyRuleBasedCategories('HMRC VAT payment Q3 2026')).toBe('VAT_PAYABLE');
    });

    it('should categorise contractor payments as CONTRACTORS', () => {
      expect(service.applyRuleBasedCategories('Payment to freelance developer')).toBe('CONTRACTORS');
    });

    it('should categorise GitHub as SAAS_SUBSCRIPTIONS', () => {
      expect(service.applyRuleBasedCategories('Github Teams subscription')).toBe('SAAS_SUBSCRIPTIONS');
    });

    it('should categorise gas fees as BANK_FEES', () => {
      expect(service.applyRuleBasedCategories('USDC gas fee for transaction')).toBe('BANK_FEES');
    });

    it('should return null for unrecognised descriptions', () => {
      expect(service.applyRuleBasedCategories('Random unknown payment xyz')).toBeNull();
    });
  });
});
