// MIT Licence — AI CFO Wallet — Buypath Ltd
// Anomaly detector — flags unusual transactions vs business spending patterns

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AiProviderService } from './ai-provider.service';

export interface AnomalyAlert {
  transactionId: string;
  type: 'unusual_amount' | 'unusual_recipient' | 'unusual_timing' | 'rapid_succession' | 'large_single_payment';
  severity: 'low' | 'medium' | 'high';
  description: string;
  amount: number;
  currency: string;
  detectedAt: Date;
  suggestedAction: string;
}

const ANOMALY_DETECTOR_PROMPT = `You are a financial fraud and anomaly detection system for UK SMEs.
Analyse the provided transactions and identify anomalies.

Return ONLY valid JSON:
{
  "anomalies": [
    {
      "transactionId": "string",
      "type": "unusual_amount" | "unusual_recipient" | "unusual_timing" | "rapid_succession" | "large_single_payment",
      "severity": "low" | "medium" | "high",
      "description": "string — clear explanation for the business owner",
      "suggestedAction": "string — what to do"
    }
  ]
}

Detection rules:
- Flag payments >3 standard deviations from average transaction size
- Flag payments to new recipients above £5,000
- Flag multiple payments to same recipient within 24 hours
- Flag transactions outside normal business hours (8am-8pm GMT)
- Flag round-number large payments (e.g. exactly £10,000)`;

@Injectable()
export class AnomalyDetectorService {
  private readonly logger = new Logger(AnomalyDetectorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiProviderService,
  ) {}

  /**
   * Runs anomaly detection against the last 24 hours of transactions.
   * Called hourly by the cron scheduler and also triggered on transaction events.
   */
  async detectAnomalies(businessId: string): Promise<AnomalyAlert[]> {
    this.logger.debug(`Running anomaly detection for business ${businessId}`);

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [recentTx, historicalStats] = await this.prisma.$transaction([
      this.prisma.transaction.findMany({
        where: {
          businessId,
          createdAt: { gte: yesterday },
          status: { in: ['COMPLETED', 'PENDING'] },
        },
      }),
      this.prisma.transaction.aggregate({
        where: {
          businessId,
          status: 'COMPLETED',
          createdAt: { lt: yesterday },
        },
        _avg: { amount: true },
        _max: { amount: true },
        _count: true,
      }),
    ]);

    if (recentTx.length === 0) return [];

    // Run rule-based detection first (fast, no AI cost)
    const ruleBasedAnomalies = this.runRuleBasedDetection(recentTx, historicalStats);

    // For high-value or complex patterns, use AI detection
    if (recentTx.some((tx) => Number(tx.amount) > 5000)) {
      return this.runAiDetection(recentTx, ruleBasedAnomalies, historicalStats);
    }

    return ruleBasedAnomalies;
  }

  /**
   * Hourly anomaly scan across all active businesses.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async runScheduledDetection(): Promise<void> {
    const businesses = await this.prisma.business.findMany({
      where: { kycStatus: 'APPROVED' },
      select: { id: true },
    });

    for (const business of businesses) {
      try {
        const anomalies = await this.detectAnomalies(business.id);
        if (anomalies.length > 0) {
          this.logger.warn(
            `${anomalies.length} anomalies detected for business ${business.id}: ` +
            anomalies.map((a) => `[${a.severity}] ${a.type}`).join(', '),
          );
          // In production: send webhook notification and in-app alert
        }
      } catch (error) {
        this.logger.error(`Anomaly detection failed for ${business.id}: ${(error as Error).message}`);
      }
    }
  }

  // ─── Private ─────────────────────────────────────────────────────────────────

  private runRuleBasedDetection(
    transactions: Array<{ id: string; amount: unknown; type: string; createdAt: Date; currency: string }>,
    stats: { _avg: { amount: unknown }; _max: { amount: unknown }; _count: number },
  ): AnomalyAlert[] {
    const anomalies: AnomalyAlert[] = [];
    const avgAmount = Number(stats._avg.amount ?? 0);
    const threshold = avgAmount * 3;

    for (const tx of transactions) {
      const amount = Number(tx.amount);

      // Flag unusually large amounts
      if (amount > Math.max(threshold, 5000)) {
        anomalies.push({
          transactionId: tx.id,
          type: 'unusual_amount',
          severity: amount > 25000 ? 'high' : 'medium',
          description: `Payment of £${amount.toFixed(2)} is ${Math.round(amount / avgAmount)}x your average transaction`,
          amount,
          currency: tx.currency,
          detectedAt: new Date(),
          suggestedAction: 'Review this payment and confirm it was authorised',
        });
      }

      // Flag unusual timing (outside 6am-11pm)
      const hour = tx.createdAt.getHours();
      if (hour < 6 || hour > 23) {
        anomalies.push({
          transactionId: tx.id,
          type: 'unusual_timing',
          severity: 'low',
          description: `Transaction processed at ${tx.createdAt.toTimeString().slice(0, 5)} — outside normal business hours`,
          amount,
          currency: tx.currency,
          detectedAt: new Date(),
          suggestedAction: 'Confirm this was an automated rule execution, not unauthorised access',
        });
      }
    }

    return anomalies;
  }

  private async runAiDetection(
    transactions: Array<{ id: string; amount: unknown; type: string; createdAt: Date }>,
    existingAnomalies: AnomalyAlert[],
    stats: { _avg: { amount: unknown }; _count: number },
  ): Promise<AnomalyAlert[]> {
    const userMessage = `
Recent transactions (last 24h):
${JSON.stringify(transactions.map((t) => ({
  id: t.id,
  type: t.type,
  amount: Number(t.amount),
  createdAt: t.createdAt.toISOString(),
})), null, 2)}

Historical baseline:
- Average transaction: £${Number(stats._avg.amount ?? 0).toFixed(2)}
- Total transactions to date: ${stats._count}

Already flagged by rule engine: ${existingAnomalies.map((a) => a.transactionId).join(', ')}`;

    try {
      const response = await this.ai.complete(ANOMALY_DETECTOR_PROMPT, userMessage, {
        maxTokens: 1024,
      });

      const jsonMatch = response.content.match(/\{[\s\S]+\}/);
      if (!jsonMatch) return existingAnomalies;

      const aiResult = JSON.parse(jsonMatch[0]) as { anomalies: AnomalyAlert[] };
      const aiAnomalies = aiResult.anomalies.map((a) => ({ ...a, detectedAt: new Date() }));

      // Merge, deduplicating by transactionId
      const allAnomalies = [...existingAnomalies];
      for (const aiAnomaly of aiAnomalies) {
        if (!allAnomalies.find((a) => a.transactionId === aiAnomaly.transactionId)) {
          allAnomalies.push(aiAnomaly);
        }
      }

      return allAnomalies;
    } catch (error) {
      this.logger.error(`AI anomaly detection failed: ${(error as Error).message}`);
      return existingAnomalies;
    }
  }
}
