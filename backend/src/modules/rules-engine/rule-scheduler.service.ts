// MIT Licence — AI CFO Wallet — Buypath Ltd
// Rule scheduler — cron-based and threshold monitoring for active rules

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RuleExecutorService } from './rule-executor.service';
import { RuleValidatorService } from './rule-validator.service';

@Injectable()
export class RuleSchedulerService {
  private readonly logger = new Logger(RuleSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly executor: RuleExecutorService,
    private readonly validator: RuleValidatorService,
  ) {}

  /**
   * Runs every minute — checks all SCHEDULE rules that are due for execution.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async processScheduledRules(): Promise<void> {
    const now = new Date();

    const dueRules = await this.prisma.rule.findMany({
      where: {
        status: 'ACTIVE',
        triggerType: 'SCHEDULE',
        OR: [
          { nextExecutionAt: null },
          { nextExecutionAt: { lte: now } },
        ],
      },
    });

    if (dueRules.length === 0) return;

    this.logger.debug(`Processing ${dueRules.length} scheduled rules`);

    for (const rule of dueRules) {
      try {
        const context = await this.validator.buildBusinessContext(rule.businessId);

        await this.executor.enqueueRule({
          ruleId: rule.id,
          businessId: rule.businessId,
          parsedLogic: rule.parsedLogic as never,
          wallets: context.wallets,
          currentTime: now,
        });

        // Update next execution time based on cron
        const nextExecution = this.computeNextExecution(rule.cronExpression ?? '');
        if (nextExecution) {
          await this.prisma.rule.update({
            where: { id: rule.id },
            data: { nextExecutionAt: nextExecution },
          });
        }
      } catch (error) {
        this.logger.error(`Failed to schedule rule ${rule.id}: ${(error as Error).message}`);
      }
    }
  }

  /**
   * Runs every 5 minutes — evaluates THRESHOLD rules against current wallet balances.
   */
  @Cron('*/5 * * * *')
  async processThresholdRules(): Promise<void> {
    const thresholdRules = await this.prisma.rule.findMany({
      where: {
        status: 'ACTIVE',
        triggerType: 'THRESHOLD',
      },
    });

    if (thresholdRules.length === 0) return;

    this.logger.debug(`Evaluating ${thresholdRules.length} threshold rules`);

    for (const rule of thresholdRules) {
      try {
        const context = await this.validator.buildBusinessContext(rule.businessId);
        const parsedLogic = rule.parsedLogic as { condition?: { type: string; threshold: string | number } };

        const shouldExecute = await this.evaluateThreshold(parsedLogic, context);
        if (shouldExecute) {
          this.logger.log(`Threshold triggered for rule ${rule.id}`);
          await this.executor.enqueueRule({
            ruleId: rule.id,
            businessId: rule.businessId,
            parsedLogic: parsedLogic as never,
            wallets: context.wallets,
            currentTime: new Date(),
          });
        }
      } catch (error) {
        this.logger.error(`Failed to evaluate rule ${rule.id}: ${(error as Error).message}`);
      }
    }
  }

  /**
   * Activates a rule — sets status to ACTIVE and computes next execution.
   */
  async activateRule(ruleId: string): Promise<void> {
    const rule = await this.prisma.rule.findUnique({ where: { id: ruleId } });
    if (!rule) throw new Error(`Rule ${ruleId} not found`);

    const nextExecution =
      rule.triggerType === 'SCHEDULE'
        ? this.computeNextExecution(rule.cronExpression ?? '')
        : null;

    await this.prisma.rule.update({
      where: { id: ruleId },
      data: { status: 'ACTIVE', nextExecutionAt: nextExecution },
    });

    this.logger.log(`Activated rule ${ruleId}, next execution: ${nextExecution?.toISOString() ?? 'on-threshold'}`);
  }

  /**
   * Pauses a rule — stops future executions without deleting it.
   */
  async pauseRule(ruleId: string): Promise<void> {
    await this.prisma.rule.update({
      where: { id: ruleId },
      data: { status: 'PAUSED', nextExecutionAt: null },
    });
    this.logger.log(`Paused rule ${ruleId}`);
  }

  // ─── Private ─────────────────────────────────────────────────────────────────

  private evaluateThreshold(
    parsedLogic: { condition?: { type: string; threshold: string | number } },
    context: { wallets: Array<{ balance: number; label: string }> },
  ): boolean {
    const condition = parsedLogic.condition;
    if (!condition) return false;

    const primaryWallet = context.wallets.find((w) => w.label.includes('Primary')) ?? context.wallets[0];
    const balance = primaryWallet?.balance ?? 0;
    const threshold = typeof condition.threshold === 'number'
      ? condition.threshold
      : 30000; // Default 3mo opex fallback

    switch (condition.type) {
      case 'balance_exceeds': return balance > threshold;
      case 'balance_below': return balance < threshold;
      default: return false;
    }
  }

  private computeNextExecution(cronExpression: string): Date | null {
    if (!cronExpression) return null;
    // Simplified: add 1 week. Production uses 'cron-parser' library.
    const next = new Date();
    next.setDate(next.getDate() + 7);
    return next;
  }
}
