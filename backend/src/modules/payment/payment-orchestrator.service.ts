// MIT Licence — AI CFO Wallet — Buypath Ltd
// Payment orchestrator — routes payments to the correct rail automatically

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StripeService } from './stripe.service';
import { ModulrService } from './modulr.service';
import { CircleService } from './circle.service';
import {
  DuplicatePaymentException,
  InsufficientFundsException,
  KycNotApprovedException,
} from '../../common/exceptions/business.exception';
import type { CreatePaymentDto, PaymentResult, PaymentRail } from './payment.types';

@Injectable()
export class PaymentOrchestratorService {
  private readonly logger = new Logger(PaymentOrchestratorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
    private readonly modulr: ModulrService,
    private readonly circle: CircleService,
  ) {}

  /**
   * Entry point for all outbound payments.
   * Validates, selects the optimal rail, executes, and records.
   */
  async createPayment(dto: CreatePaymentDto): Promise<PaymentResult> {
    // 1. Idempotency check — prevent duplicate execution
    const existing = await this.prisma.transaction.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
    });

    if (existing) {
      if (existing.status === 'COMPLETED') {
        throw new DuplicatePaymentException(dto.idempotencyKey);
      }
      return { id: existing.id, status: existing.status as PaymentResult['status'] };
    }

    // 2. KYC check
    const business = await this.prisma.business.findUnique({ where: { id: dto.businessId } });
    if (!business || business.kycStatus !== 'APPROVED') {
      throw new KycNotApprovedException();
    }

    // 3. Balance check
    const wallet = await this.prisma.wallet.findUnique({ where: { id: dto.fromWalletId } });
    if (!wallet || Number(wallet.balance) < dto.amount) {
      throw new InsufficientFundsException(
        String(dto.amount),
        String(wallet?.balance ?? 0),
        dto.currency,
      );
    }

    // 4. Select payment rail
    const rail = dto.rail ?? this.selectRail(dto);
    this.logger.log(`Routing ${dto.amount} ${dto.currency} via ${rail}`);

    // 5. Create pending transaction record
    const tx = await this.prisma.transaction.create({
      data: {
        businessId: dto.businessId,
        type: 'PAYMENT',
        status: 'PENDING',
        fromWalletId: dto.fromWalletId,
        toWalletId: dto.toWalletId,
        amount: dto.amount,
        currency: dto.currency as never,
        idempotencyKey: dto.idempotencyKey,
        description: dto.description,
        metadata: { rail, ...dto.metadata },
      },
    });

    // 6. Execute payment
    try {
      const result = await this.executeOnRail(rail, dto, tx.id);

      // Update transaction to completed
      await this.prisma.transaction.update({
        where: { id: tx.id },
        data: {
          status: 'COMPLETED',
          externalRef: result.externalRef,
          txHash: result.txHash,
          executedAt: new Date(),
        },
      });

      // Debit the source wallet
      await this.prisma.wallet.update({
        where: { id: dto.fromWalletId },
        data: { balance: { decrement: dto.amount } },
      });

      return { ...result, id: tx.id, status: 'completed' };
    } catch (error) {
      await this.prisma.transaction.update({
        where: { id: tx.id },
        data: { status: 'FAILED', metadata: { ...(dto.metadata ?? {}), error: (error as Error).message } },
      });
      throw error;
    }
  }

  // ─── Private ─────────────────────────────────────────────────────────────────

  /**
   * Auto-selects the payment rail based on currency and recipient type.
   */
  private selectRail(dto: CreatePaymentDto): PaymentRail {
    if (dto.currency === 'USDC') return 'circle';
    if (dto.recipientAddress) return 'stablecoin';
    if (dto.recipientBankDetails?.sortCode) return 'modulr';   // UK bank
    if (dto.recipientBankDetails?.routingNumber) return 'stripe'; // US ACH via Stripe
    return 'stripe';
  }

  private async executeOnRail(
    rail: PaymentRail,
    dto: CreatePaymentDto,
    txId: string,
  ): Promise<Omit<PaymentResult, 'id' | 'status'>> {
    switch (rail) {
      case 'modulr': {
        const result = await this.modulr.sendFasterPayment(
          dto.fromWalletId,
          dto.amount,
          dto.recipientBankDetails!,
          dto.description ?? `Payment ${txId}`,
          dto.idempotencyKey,
        );
        return { externalRef: result.id };
      }

      case 'circle':
      case 'stablecoin': {
        const result = await this.circle.transferUsdc(
          dto.fromWalletId,
          dto.recipientAddress!,
          dto.amount,
          'BASE',
          dto.idempotencyKey,
        );
        return { externalRef: result.id, txHash: result.transactionHash };
      }

      case 'stripe': {
        const intent = await this.stripe.createDepositIntent(
          dto.businessId,
          Math.round(dto.amount * 100),
          dto.currency,
          dto.idempotencyKey,
        );
        return { externalRef: intent.paymentIntentId };
      }

      default:
        throw new Error(`Unsupported payment rail: ${rail}`);
    }
  }
}
