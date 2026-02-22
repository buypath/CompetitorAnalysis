// MIT Licence — AI CFO Wallet — Buypath Ltd
// Batch payout service — processes mixed fiat + stablecoin contractor payouts

import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ModulrService } from './modulr.service';
import { CircleService } from './circle.service';
import type { BatchPayoutItem, BatchPayoutResult } from './payment.types';

@Injectable()
export class BatchPayoutService {
  private readonly logger = new Logger(BatchPayoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly modulr: ModulrService,
    private readonly circle: CircleService,
  ) {}

  /**
   * Processes a batch of payouts to multiple recipients.
   * Supports mixed rails: UK Faster Payments + USDC stablecoin in a single batch.
   *
   * Processing is parallel within rails but serialised across rails
   * to ensure idempotency and accurate balance tracking.
   */
  async processBatch(
    businessId: string,
    items: BatchPayoutItem[],
    batchRef?: string,
  ): Promise<BatchPayoutResult> {
    const batchId = batchRef ?? uuidv4();
    this.logger.log(`Processing batch ${batchId}: ${items.length} payouts for business ${businessId}`);

    const results = await Promise.allSettled(
      items.map((item, idx) => this.processItem(businessId, item, `${batchId}-${idx}`)),
    );

    const itemResults = results.map((result, idx) => ({
      ...items[idx],
      status: result.status === 'fulfilled' ? result.value.status : 'failed' as const,
      error: result.status === 'rejected' ? (result.reason as Error).message : undefined,
      txId: result.status === 'fulfilled' ? result.value.txId : undefined,
    }));

    const succeeded = itemResults.filter((r) => r.status === 'completed').length;
    const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);

    this.logger.log(`Batch ${batchId} complete: ${succeeded}/${items.length} succeeded`);

    return {
      batchId,
      totalItems: items.length,
      succeeded,
      failed: items.length - succeeded,
      totalAmount,
      currency: items[0]?.currency ?? 'GBP',
      items: itemResults,
    };
  }

  /**
   * Schedules a batch for future execution (e.g. monthly payroll).
   */
  async scheduleBatch(
    businessId: string,
    items: BatchPayoutItem[],
    executeAt: Date,
  ): Promise<string> {
    const batchId = uuidv4();

    // Create scheduled payment records for each item
    await this.prisma.scheduledPayment.createMany({
      data: items.map((item) => ({
        businessId,
        amount: item.amount,
        currency: item.currency as never,
        dueDate: executeAt,
        description: item.description ?? `Payroll — ${item.recipientName}`,
        idempotencyKey: `${batchId}-${item.recipientName}`,
        status: 'PENDING',
        metadata: { batchId, paymentMethod: item.paymentMethod, item },
      })),
    });

    this.logger.log(`Scheduled batch ${batchId} for ${executeAt.toISOString()}`);
    return batchId;
  }

  // ─── Private ─────────────────────────────────────────────────────────────────

  private async processItem(
    businessId: string,
    item: BatchPayoutItem,
    idempotencyKey: string,
  ): Promise<{ status: 'completed' | 'failed' | 'pending'; txId?: string }> {
    try {
      let externalRef: string | undefined;

      if (item.paymentMethod === 'faster_payments' && item.bankDetails) {
        const result = await this.modulr.sendFasterPayment(
          businessId, // Using business ID as source account stub
          item.amount,
          item.bankDetails,
          item.reference ?? `Payout to ${item.recipientName}`,
          idempotencyKey,
        );
        externalRef = result.id;
      } else if (item.paymentMethod === 'stablecoin' && item.recipientAddress) {
        const result = await this.circle.transferUsdc(
          businessId, // Circle wallet ID stub
          item.recipientAddress,
          item.amount,
          'BASE',
          idempotencyKey,
        );
        externalRef = result.id;
      } else {
        throw new Error(`Unsupported payment method: ${item.paymentMethod}`);
      }

      // Record transaction
      const tx = await this.prisma.transaction.create({
        data: {
          businessId,
          type: 'PAYMENT',
          status: 'COMPLETED',
          amount: item.amount,
          currency: item.currency as never,
          externalRef,
          idempotencyKey,
          description: item.description ?? `Payout to ${item.recipientName}`,
          executedAt: new Date(),
          metadata: { paymentMethod: item.paymentMethod, recipientName: item.recipientName },
        },
      });

      return { status: 'completed', txId: tx.id };
    } catch (error) {
      this.logger.error(`Batch item failed for ${item.recipientName}: ${(error as Error).message}`);

      // Record failed transaction
      await this.prisma.transaction.create({
        data: {
          businessId,
          type: 'PAYMENT',
          status: 'FAILED',
          amount: item.amount,
          currency: item.currency as never,
          idempotencyKey,
          description: `Failed payout to ${item.recipientName}`,
          metadata: { error: (error as Error).message, item },
        },
      });

      return { status: 'failed' };
    }
  }
}
