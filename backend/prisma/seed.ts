// MIT Licence — AI CFO Wallet — Buypath Ltd
// Prisma seed: creates a test business with wallets, rules, and suppliers

import { PrismaClient, KycStatus, SubscriptionTier, UserRole, WalletType, Currency, RuleStatus, TriggerType, PaymentMethod } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('Seeding database...');

  // Create test business
  const business = await prisma.business.upsert({
    where: { id: 'seed-business-001' },
    update: {},
    create: {
      id: 'seed-business-001',
      name: 'Acme Digital Agency Ltd',
      registrationNumber: '12345678',
      vatNumber: 'GB123456789',
      kycStatus: KycStatus.APPROVED,
      subscriptionTier: SubscriptionTier.GROWTH,
      country: 'GB',
      timezone: 'Europe/London',
      settings: {
        notifications: { email: true, webhook: false },
        twoFactorRequired: false,
        defaultCurrency: 'GBP',
      },
    },
  });

  // Create owner user
  await prisma.user.upsert({
    where: { email: 'owner@acmedigital.co.uk' },
    update: {},
    create: {
      businessId: business.id,
      email: 'owner@acmedigital.co.uk',
      firstName: 'Sarah',
      lastName: 'Mitchell',
      role: UserRole.OWNER,
      permissions: { all: true },
    },
  });

  await prisma.user.upsert({
    where: { email: 'finance@acmedigital.co.uk' },
    update: {},
    create: {
      businessId: business.id,
      email: 'finance@acmedigital.co.uk',
      firstName: 'James',
      lastName: 'Thornton',
      role: UserRole.ADMIN,
      permissions: {
        payments: { create: true, approve: true, limit: 10000 },
        rules: { create: true, activate: true },
        reports: { view: true, export: true },
      },
    },
  });

  // Create wallets
  const gbpWallet = await prisma.wallet.upsert({
    where: { id: 'seed-wallet-gbp' },
    update: {},
    create: {
      id: 'seed-wallet-gbp',
      businessId: business.id,
      type: WalletType.FIAT,
      currency: Currency.GBP,
      balance: 85000.00,
      label: 'Primary GBP Account',
      isDefault: true,
      smartAccountAddress: '0x1234567890abcdef1234567890abcdef12345678',
    },
  });

  await prisma.wallet.upsert({
    where: { id: 'seed-wallet-usdc' },
    update: {},
    create: {
      id: 'seed-wallet-usdc',
      businessId: business.id,
      type: WalletType.STABLECOIN,
      currency: Currency.USDC,
      balance: 25000.00,
      label: 'USDC Treasury',
      smartAccountAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
    },
  });

  await prisma.wallet.upsert({
    where: { id: 'seed-wallet-vat' },
    update: {},
    create: {
      id: 'seed-wallet-vat',
      businessId: business.id,
      type: WalletType.SUB_WALLET,
      currency: Currency.GBP,
      balance: 12400.00,
      label: 'VAT Ring-Fence',
      parentWalletId: gbpWallet.id,
    },
  });

  await prisma.wallet.upsert({
    where: { id: 'seed-wallet-pension' },
    update: {},
    create: {
      id: 'seed-wallet-pension',
      businessId: business.id,
      type: WalletType.SUB_WALLET,
      currency: Currency.GBP,
      balance: 5200.00,
      label: 'Pension Allocation',
      parentWalletId: gbpWallet.id,
    },
  });

  // Create rules
  await prisma.rule.upsert({
    where: { id: 'seed-rule-vat' },
    update: {},
    create: {
      id: 'seed-rule-vat',
      businessId: business.id,
      name: 'Weekly VAT Allocation',
      naturalLanguageInput: 'Move VAT aside weekly — estimate VAT liability from transactions and transfer to ring-fenced VAT sub-wallet every Friday',
      parsedLogic: {
        trigger: 'schedule',
        schedule: { cron: '0 17 * * 5', timezone: 'Europe/London' },
        calculation: { type: 'vat_liability_estimate', vatRate: 0.20 },
        action: {
          type: 'transfer',
          from: 'gbp_primary',
          to: 'vat_ring_fence',
          amount: 'calculated_vat',
        },
      },
      status: RuleStatus.ACTIVE,
      triggerType: TriggerType.SCHEDULE,
      cronExpression: '0 17 * * 5',
      executionCount: 12,
    },
  });

  await prisma.rule.upsert({
    where: { id: 'seed-rule-opex' },
    update: {},
    create: {
      id: 'seed-rule-opex',
      businessId: business.id,
      name: 'Operating Expense Reserve',
      naturalLanguageInput: 'Keep 3 months operating expenses in GBP at all times — convert any excess to USDC for yield',
      parsedLogic: {
        trigger: 'threshold',
        condition: {
          type: 'balance_exceeds',
          wallet: 'gbp_primary',
          threshold: 'calculated_3mo_opex',
          checkInterval: 'daily',
        },
        action: {
          type: 'convert_excess',
          from_currency: 'GBP',
          to_currency: 'USDC',
          destination: 'usdc_treasury',
        },
      },
      status: RuleStatus.ACTIVE,
      triggerType: TriggerType.THRESHOLD,
      thresholdConfig: { metric: '3mo_opex', checkInterval: 'daily' },
    },
  });

  // Create suppliers
  await prisma.supplier.upsert({
    where: { id: 'seed-supplier-001' },
    update: {},
    create: {
      id: 'seed-supplier-001',
      businessId: business.id,
      name: 'CloudHost Pro Ltd',
      email: 'billing@cloudhostpro.com',
      paymentMethod: PaymentMethod.FASTER_PAYMENTS,
      defaultCurrency: Currency.GBP,
      tags: ['infrastructure', 'recurring'],
      bankDetailsEncrypted: {
        encrypted: true,
        algorithm: 'AES-256-GCM',
        data: 'ENCRYPTED_BANK_DETAILS_PLACEHOLDER',
      },
    },
  });

  await prisma.supplier.upsert({
    where: { id: 'seed-supplier-002' },
    update: {},
    create: {
      id: 'seed-supplier-002',
      businessId: business.id,
      name: 'Maria Santos (Contractor — PH)',
      email: 'maria.santos@freelance.ph',
      paymentMethod: PaymentMethod.STABLECOIN,
      walletAddress: '0xdeadbeef1234567890abcdef1234567890abcdef',
      defaultCurrency: Currency.USDC,
      tags: ['contractor', 'philippines', 'design'],
    },
  });

  await prisma.supplier.upsert({
    where: { id: 'seed-supplier-003' },
    update: {},
    create: {
      id: 'seed-supplier-003',
      businessId: business.id,
      name: 'Dev Crew Manila (Contractor — PH)',
      email: 'payments@devcrewmnl.com',
      paymentMethod: PaymentMethod.STABLECOIN,
      walletAddress: '0xfeedface1234567890abcdef1234567890abcdef',
      defaultCurrency: Currency.USDC,
      tags: ['contractor', 'philippines', 'development'],
    },
  });

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
