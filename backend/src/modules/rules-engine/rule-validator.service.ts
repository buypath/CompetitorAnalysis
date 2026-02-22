// MIT Licence — AI CFO Wallet — Buypath Ltd
// Rule validator — validates parsed rules against business context

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RuleParsingException } from '../../common/exceptions/business.exception';
import type { ParsedRule, BusinessContext } from './rules-engine.types';

@Injectable()
export class RuleValidatorService {
  private readonly logger = new Logger(RuleValidatorService.name);

  // Valid wallet identifiers the rules engine understands
  private readonly KNOWN_WALLETS = [
    'gbp_primary', 'usdc_treasury', 'vat_ring_fence',
    'pension_pot', 'payroll_gbp', 'emergency_fund', 'surplus_sweep',
  ];

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validates a parsed rule against the business's actual wallets and context.
   * Throws RuleParsingException if invalid.
   */
  async validate(rule: ParsedRule, businessContext: BusinessContext): Promise<void> {
    this.validateStructure(rule);
    await this.validateWallets(rule, businessContext);
    this.validateCronExpression(rule);
    this.validateAction(rule);
    this.logger.debug(`Rule '${rule.name}' passed validation for business ${businessContext.businessId}`);
  }

  /**
   * Builds a BusinessContext from the database for rule validation and execution.
   */
  async buildBusinessContext(businessId: string): Promise<BusinessContext> {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
    });

    if (!business) throw new Error(`Business ${businessId} not found`);

    const wallets = await this.prisma.wallet.findMany({
      where: { businessId },
    });

    // Calculate monthly averages from recent transactions
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentTx = await this.prisma.transaction.aggregate({
      where: {
        businessId,
        status: 'COMPLETED',
        createdAt: { gte: thirtyDaysAgo },
      },
      _sum: { amount: true },
    });

    return {
      businessId,
      currency: (business.settings as Record<string, string>)['defaultCurrency'] ?? 'GBP',
      timezone: business.timezone,
      monthlyRevenue: 0, // Would be calculated from categorised transactions
      monthlyExpenses: recentTx._sum.amount ? Number(recentTx._sum.amount) : 0,
      wallets: wallets.map((w) => ({
        id: w.id,
        label: w.label ?? '',
        currency: w.currency,
        balance: Number(w.balance),
        type: w.type,
      })),
    };
  }

  // ─── Private validators ───────────────────────────────────────────────────────

  private validateStructure(rule: ParsedRule): void {
    if (!rule.trigger) throw new RuleParsingException('Rule must have a trigger');
    if (!rule.action) throw new RuleParsingException('Rule must have an action');
    if (!rule.name || rule.name.trim().length === 0) {
      throw new RuleParsingException('Rule must have a name');
    }

    if (rule.trigger === 'schedule' && !rule.schedule?.cron) {
      throw new RuleParsingException('Schedule rules must include a cron expression');
    }
    if (rule.trigger === 'threshold' && !rule.condition) {
      throw new RuleParsingException('Threshold rules must include a condition');
    }
  }

  private async validateWallets(rule: ParsedRule, context: BusinessContext): Promise<void> {
    const walletRefs = [rule.action.from_wallet, rule.action.to_wallet].filter(Boolean);

    for (const walletRef of walletRefs) {
      if (!walletRef) continue;
      const isKnown = this.KNOWN_WALLETS.includes(walletRef);
      const existsInBusiness = context.wallets.some(
        (w) => w.id === walletRef || w.label.toLowerCase().replace(/\s+/g, '_') === walletRef,
      );

      if (!isKnown && !existsInBusiness) {
        this.logger.warn(`Unknown wallet reference '${walletRef}' — will be resolved at runtime`);
      }
    }
  }

  private validateCronExpression(rule: ParsedRule): void {
    if (rule.trigger !== 'schedule') return;
    const cron = rule.schedule?.cron ?? rule.cronExpression;
    if (!cron) throw new RuleParsingException('Schedule rule missing cron expression');

    // Basic cron format validation: 5 or 6 fields
    const parts = cron.trim().split(/\s+/);
    if (parts.length < 5 || parts.length > 6) {
      throw new RuleParsingException(`Invalid cron expression: '${cron}'`);
    }
  }

  private validateAction(rule: ParsedRule): void {
    const validActions = ['transfer', 'convert', 'convert_excess', 'schedule_payment', 'alert', 'ring_fence'];
    if (!validActions.includes(rule.action.type)) {
      throw new RuleParsingException(`Unknown action type: '${rule.action.type}'`);
    }
  }
}
