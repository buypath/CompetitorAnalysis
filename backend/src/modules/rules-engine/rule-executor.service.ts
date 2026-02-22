// MIT Licence — AI CFO Wallet — Buypath Ltd
// Rule executor — processes rule execution jobs from BullMQ queue

import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue, Process, Processor } from '@nestjs/bull';
import { Queue, Job } from 'bull';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { RuleExecutionContext, RuleExecutionResult, ActionRecord } from './rules-engine.types';

@Injectable()
@Processor('rule-execution')
export class RuleExecutorService {
  private readonly logger = new Logger(RuleExecutorService.name);

  constructor(
    @InjectQueue('rule-execution') private readonly ruleQueue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Enqueues a rule for immediate execution.
   */
  async enqueueRule(context: RuleExecutionContext): Promise<void> {
    await this.ruleQueue.add('execute', context, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: false,
      removeOnFail: false,
    });
    this.logger.log(`Enqueued rule ${context.ruleId} for execution`);
  }

  /**
   * BullMQ processor — executes a rule from the queue.
   */
  @Process('execute')
  async processRuleJob(job: Job<RuleExecutionContext>): Promise<RuleExecutionResult> {
    const context = job.data;
    const startTime = Date.now();
    this.logger.log(`Executing rule ${context.ruleId}`);

    const result = await this.executeRule(context);

    // Record execution log
    await this.prisma.ruleExecutionLog.create({
      data: {
        ruleId: context.ruleId,
        success: result.success,
        inputData: { wallets: context.wallets, currentTime: context.currentTime },
        outputData: { actionsPerformed: result.actionsPerformed },
        error: result.error,
        durationMs: result.durationMs,
      },
    });

    // Update rule metadata
    await this.prisma.rule.update({
      where: { id: context.ruleId },
      data: {
        lastExecutedAt: new Date(),
        executionCount: { increment: 1 },
        errorCount: result.success ? undefined : { increment: 1 },
        lastError: result.error ?? null,
      },
    });

    return result;
  }

  /**
   * Core rule execution logic — dispatches to action handlers.
   */
  private async executeRule(context: RuleExecutionContext): Promise<RuleExecutionResult> {
    const startTime = Date.now();
    const actionsPerformed: ActionRecord[] = [];

    try {
      const { parsedLogic } = context;
      const action = parsedLogic.action;

      switch (action.type) {
        case 'transfer':
        case 'convert':
        case 'convert_excess':
          await this.executeTransferAction(context, actionsPerformed);
          break;

        case 'ring_fence':
          await this.executeRingFenceAction(context, actionsPerformed);
          break;

        case 'schedule_payment':
          await this.executeSchedulePaymentAction(context, actionsPerformed);
          break;

        case 'alert':
          await this.executeAlertAction(context, actionsPerformed);
          break;

        default:
          this.logger.warn(`Unknown action type: ${action.type}`);
      }

      return {
        success: true,
        actionsPerformed,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      this.logger.error(`Rule ${context.ruleId} execution failed: ${(error as Error).message}`);
      return {
        success: false,
        actionsPerformed,
        error: (error as Error).message,
        durationMs: Date.now() - startTime,
      };
    }
  }

  // ─── Action handlers ──────────────────────────────────────────────────────────

  private async executeTransferAction(
    context: RuleExecutionContext,
    actions: ActionRecord[],
  ): Promise<void> {
    const { parsedLogic, businessId } = context;
    const { action } = parsedLogic;

    // Resolve wallet IDs from the business context
    const fromWallet = this.resolveWallet(action.from_wallet, context);
    const toWallet = this.resolveWallet(action.to_wallet, context);

    if (!fromWallet || !toWallet) {
      throw new Error(`Cannot resolve wallets: from=${action.from_wallet}, to=${action.to_wallet}`);
    }

    // Calculate the transfer amount
    const amount = await this.calculateAmount(action.amount, context);
    if (amount <= 0) {
      this.logger.debug(`Transfer amount ${amount} — no action needed`);
      return;
    }

    // Check source wallet has sufficient balance
    const sourceWallet = await this.prisma.wallet.findUnique({ where: { id: fromWallet.id } });
    if (!sourceWallet || Number(sourceWallet.balance) < amount) {
      throw new Error(
        `Insufficient balance in ${fromWallet.label}: need ${amount}, have ${Number(sourceWallet?.balance ?? 0)}`,
      );
    }

    // Create transaction records (debit source, credit destination)
    const tx = await this.prisma.transaction.create({
      data: {
        businessId,
        type: action.type === 'convert' || action.type === 'convert_excess' ? 'CONVERSION' : 'TRANSFER',
        status: 'COMPLETED',
        fromWalletId: fromWallet.id,
        toWalletId: toWallet.id,
        amount,
        currency: fromWallet.currency as never,
        description: action.description,
        executedAt: new Date(),
        metadata: { ruleId: context.ruleId, actionType: action.type },
      },
    });

    // Update balances
    await this.prisma.$transaction([
      this.prisma.wallet.update({
        where: { id: fromWallet.id },
        data: { balance: { decrement: amount } },
      }),
      this.prisma.wallet.update({
        where: { id: toWallet.id },
        data: { balance: { increment: amount } },
      }),
    ]);

    actions.push({
      type: action.type,
      amount,
      currency: fromWallet.currency,
      fromWallet: fromWallet.label,
      toWallet: toWallet.label,
      txId: tx.id,
      timestamp: new Date(),
    });

    this.logger.log(`Transferred ${amount} ${fromWallet.currency} from ${fromWallet.label} to ${toWallet.label}`);
  }

  private async executeRingFenceAction(
    context: RuleExecutionContext,
    actions: ActionRecord[],
  ): Promise<void> {
    // Ring-fence is essentially a tagged transfer to a sub-wallet
    await this.executeTransferAction(context, actions);
  }

  private async executeSchedulePaymentAction(
    context: RuleExecutionContext,
    actions: ActionRecord[],
  ): Promise<void> {
    const amount = await this.calculateAmount(context.parsedLogic.action.amount, context);
    const fromWallet = this.resolveWallet(context.parsedLogic.action.from_wallet, context);

    await this.prisma.scheduledPayment.create({
      data: {
        businessId: context.businessId,
        ruleId: context.ruleId,
        amount,
        currency: (fromWallet?.currency as never) ?? 'GBP',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days default
        status: 'PENDING',
        description: context.parsedLogic.action.description,
      },
    });

    actions.push({
      type: 'schedule_payment',
      amount,
      currency: fromWallet?.currency,
      timestamp: new Date(),
    });
  }

  private async executeAlertAction(
    context: RuleExecutionContext,
    actions: ActionRecord[],
  ): Promise<void> {
    // In production: send notification via webhook or email
    this.logger.log(`Alert triggered for rule ${context.ruleId} in business ${context.businessId}`);
    actions.push({ type: 'alert', timestamp: new Date() });
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private resolveWallet(
    walletRef: string | undefined,
    context: RuleExecutionContext,
  ): { id: string; label: string; currency: string; balance: number } | null {
    if (!walletRef) return null;

    // Try direct match by label slug
    return context.wallets.find(
      (w) =>
        w.id === walletRef ||
        w.label.toLowerCase().replace(/[\s-]+/g, '_') === walletRef,
    ) ?? null;
  }

  private async calculateAmount(
    amountExpr: string | number,
    context: RuleExecutionContext,
  ): Promise<number> {
    if (typeof amountExpr === 'number') return amountExpr;

    // Percentage expressions e.g. "20%"
    const percentMatch = String(amountExpr).match(/^(\d+(?:\.\d+)?)%$/);
    if (percentMatch) {
      const pct = parseFloat(percentMatch[1]) / 100;
      return (context.wallets[0]?.balance ?? 0) * pct;
    }

    // Formula strings
    switch (amountExpr) {
      case 'calculated_3mo_opex':
        return (context.wallets.find((w) => w.label.includes('GBP'))?.balance ?? 0) * 0.5;
      case 'calculated_vat':
        return (context.wallets.find((w) => w.label.includes('GBP'))?.balance ?? 0) * 0.05;
      case 'excess_above_threshold':
        return Math.max(0, (context.wallets[0]?.balance ?? 0) - 30000);
      default:
        return parseFloat(String(amountExpr)) || 0;
    }
  }
}
