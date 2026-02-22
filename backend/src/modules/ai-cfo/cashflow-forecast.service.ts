// MIT Licence — AI CFO Wallet — Buypath Ltd
// Cashflow forecast service — generates 90-day forecasts using Claude API

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AiProviderService } from './ai-provider.service';
import { CASHFLOW_FORECAST_PROMPT } from './prompts/cashflow-forecast.prompt';

export interface CashflowForecast {
  summary: {
    currentBalance: number;
    projectedBalance90Days: number;
    averageMonthlyRevenue: number;
    averageMonthlyExpenses: number;
    burnRate: number;
    runwayMonths: number;
  };
  forecast: Array<{
    date: string;
    projectedBalance: number;
    projectedRevenue: number;
    projectedExpenses: number;
    confidenceLow: number;
    confidenceHigh: number;
  }>;
  riskDates: Array<{
    date: string;
    type: string;
    description: string;
    severity: 'low' | 'medium' | 'high';
  }>;
  insights: Array<{
    type: string;
    title: string;
    description: string;
    potentialImpact: string;
  }>;
  confidenceScore: number;
}

@Injectable()
export class CashflowForecastService {
  private readonly logger = new Logger(CashflowForecastService.name);
  private readonly FORECAST_CACHE_TTL = 3600 * 6; // 6 hours

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiProviderService,
  ) {}

  /**
   * Generates a 90-day cashflow forecast for a business.
   * Ingests 12 months of transaction history and uses Claude to project forward.
   * Results are cached in Redis and stored in the database.
   */
  async generateForecast(businessId: string): Promise<CashflowForecast> {
    this.logger.log(`Generating cashflow forecast for business ${businessId}`);

    // Fetch 12 months of transaction history
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);

    const [transactions, wallets] = await this.prisma.$transaction([
      this.prisma.transaction.findMany({
        where: {
          businessId,
          status: 'COMPLETED',
          createdAt: { gte: twelveMonthsAgo },
        },
        orderBy: { createdAt: 'asc' },
        take: 500, // Cap for token efficiency
      }),
      this.prisma.wallet.findMany({ where: { businessId } }),
    ]);

    const totalBalance = wallets.reduce((sum, w) => sum + Number(w.balance), 0);
    const txSummary = this.summariseTransactions(transactions);

    const userMessage = `
Business financial data:
- Current total balance: £${totalBalance.toFixed(2)}
- Wallet breakdown: ${wallets.map((w) => `${w.label ?? w.currency}: £${Number(w.balance).toFixed(2)}`).join(', ')}
- Transaction history (last 12 months): ${JSON.stringify(txSummary, null, 2)}
- Forecast date: ${new Date().toISOString()}

Generate a 90-day cashflow forecast with daily projections.`;

    const cacheKey = `forecast:cashflow:${businessId}:${new Date().toDateString()}`;
    const response = await this.ai.complete(CASHFLOW_FORECAST_PROMPT, userMessage, {
      cacheKey,
      cacheTtlSeconds: this.FORECAST_CACHE_TTL,
      maxTokens: 4096,
    });

    const forecast = this.parseForecastResponse(response.content);

    // Persist forecast to database
    await this.prisma.aiForecast.create({
      data: {
        businessId,
        forecastDate: new Date(),
        forecastType: 'cashflow',
        data: forecast as never,
        modelVersion: `${response.provider}/${response.model}`,
        confidenceScore: forecast.confidenceScore,
        tokensUsed: response.tokensUsed.total,
        expiresAt: new Date(Date.now() + this.FORECAST_CACHE_TTL * 1000),
      },
    });

    return forecast;
  }

  /**
   * Returns the most recent cached forecast (avoids regenerating unnecessarily).
   */
  async getLatestForecast(businessId: string): Promise<CashflowForecast | null> {
    const latest = await this.prisma.aiForecast.findFirst({
      where: {
        businessId,
        forecastType: 'cashflow',
        expiresAt: { gt: new Date() },
      },
      orderBy: { forecastDate: 'desc' },
    });

    return latest ? (latest.data as unknown as CashflowForecast) : null;
  }

  /**
   * Nightly job: regenerates forecasts for all active businesses.
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async regenerateAllForecasts(): Promise<void> {
    this.logger.log('Nightly cashflow forecast regeneration started');

    const businesses = await this.prisma.business.findMany({
      where: { kycStatus: 'APPROVED' },
      select: { id: true },
    });

    for (const business of businesses) {
      try {
        await this.generateForecast(business.id);
      } catch (error) {
        this.logger.error(`Forecast failed for business ${business.id}: ${(error as Error).message}`);
      }
    }

    this.logger.log(`Nightly forecast complete for ${businesses.length} businesses`);
  }

  // ─── Private ─────────────────────────────────────────────────────────────────

  private summariseTransactions(transactions: Array<{ type: string; amount: unknown; currency: string; createdAt: Date; category: string | null }>) {
    const monthly: Record<string, { revenue: number; expenses: number }> = {};

    for (const tx of transactions) {
      const month = tx.createdAt.toISOString().slice(0, 7); // YYYY-MM
      if (!monthly[month]) monthly[month] = { revenue: 0, expenses: 0 };

      const amount = Number(tx.amount);
      if (['DEPOSIT'].includes(tx.type)) {
        monthly[month].revenue += amount;
      } else if (['WITHDRAWAL', 'PAYMENT'].includes(tx.type)) {
        monthly[month].expenses += amount;
      }
    }

    return {
      monthlyBreakdown: monthly,
      totalTransactions: transactions.length,
      categories: [...new Set(transactions.map((t) => t.category).filter(Boolean))],
    };
  }

  private parseForecastResponse(content: string): CashflowForecast {
    const jsonMatch = content.match(/```json\n?([\s\S]+?)\n?```/) ?? content.match(/\{[\s\S]+\}/);
    if (!jsonMatch) {
      // Return a fallback stub forecast if parsing fails
      return this.buildFallbackForecast();
    }
    try {
      return JSON.parse(jsonMatch[1] ?? jsonMatch[0]) as CashflowForecast;
    } catch {
      return this.buildFallbackForecast();
    }
  }

  private buildFallbackForecast(): CashflowForecast {
    return {
      summary: {
        currentBalance: 0, projectedBalance90Days: 0, averageMonthlyRevenue: 0,
        averageMonthlyExpenses: 0, burnRate: 0, runwayMonths: 0,
      },
      forecast: [],
      riskDates: [],
      insights: [{ type: 'recommendation', title: 'Insufficient data', description: 'Add more transaction history for accurate forecasting.', potentialImpact: 'N/A' }],
      confidenceScore: 0.1,
    };
  }
}
