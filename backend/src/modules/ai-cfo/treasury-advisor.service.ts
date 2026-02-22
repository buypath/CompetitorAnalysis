// MIT Licence — AI CFO Wallet — Buypath Ltd
// Treasury advisor — analyses allocation and recommends optimisations

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AiProviderService } from './ai-provider.service';
import { TREASURY_ADVISOR_PROMPT } from './prompts/treasury-advisor.prompt';

export interface TreasuryRecommendation {
  id: string;
  priority: 'high' | 'medium' | 'low';
  type: string;
  title: string;
  description: string;
  reasoning: string;
  suggestedAction: {
    type: string;
    fromWallet: string;
    toWallet: string;
    amount: number;
    currency: string;
  };
  estimatedImpact: string;
  confidence: number;
}

export interface TreasuryAnalysis {
  currentAllocation: {
    summary: string;
    efficiency: number;
    idleCashEstimate: number;
  };
  recommendations: TreasuryRecommendation[];
  optimalAllocation: {
    gbpOperating: number;
    usdcTreasury: number;
    vatReserve: number;
    pensionPot: number;
    emergencyFund: number;
  };
}

@Injectable()
export class TreasuryAdvisorService {
  private readonly logger = new Logger(TreasuryAdvisorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiProviderService,
  ) {}

  /**
   * Analyses the business's current treasury allocation and generates recommendations.
   * Considers FX exposure, yield opportunities, upcoming obligations, and risk tolerance.
   */
  async analyseAllocation(businessId: string): Promise<TreasuryAnalysis> {
    this.logger.log(`Running treasury analysis for business ${businessId}`);

    const wallets = await this.prisma.wallet.findMany({
      where: { businessId },
      include: { subWallets: true },
    });

    const upcomingPayments = await this.prisma.scheduledPayment.findMany({
      where: {
        businessId,
        status: 'PENDING',
        dueDate: {
          gte: new Date(),
          lte: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        },
      },
    });

    const userMessage = `
Current wallet allocation:
${wallets.map((w) => `- ${w.label ?? w.currency} (${w.type}): ${Number(w.balance).toFixed(2)} ${w.currency}`).join('\n')}

Total balance: £${wallets.reduce((sum, w) => sum + Number(w.balance), 0).toFixed(2)}

Upcoming obligations (90 days):
${upcomingPayments.map((p) => `- ${p.description ?? 'Payment'}: ${Number(p.amount).toFixed(2)} ${p.currency} due ${p.dueDate.toDateString()}`).join('\n')}

Analysis date: ${new Date().toISOString()}`;

    const cacheKey = `treasury:analysis:${businessId}:${new Date().toDateString()}`;
    const response = await this.ai.complete(TREASURY_ADVISOR_PROMPT, userMessage, {
      cacheKey,
      cacheTtlSeconds: 3600 * 4, // 4 hours
      maxTokens: 2048,
    });

    return this.parseAnalysisResponse(response.content);
  }

  /**
   * Returns a quick allocation summary without AI processing.
   * Used for dashboard widgets that need fast responses.
   */
  async getQuickAllocationSummary(businessId: string): Promise<{
    totalBalance: number;
    gbpBalance: number;
    usdcBalance: number;
    idleCash: number;
    allocatedToRules: number;
  }> {
    const wallets = await this.prisma.wallet.findMany({ where: { businessId } });

    const gbp = wallets.filter((w) => w.currency === 'GBP').reduce((s, w) => s + Number(w.balance), 0);
    const usdc = wallets.filter((w) => w.currency === 'USDC').reduce((s, w) => s + Number(w.balance), 0);

    // Estimate idle cash: anything in primary wallet above the 3-month opex reserve
    const primaryWallet = wallets.find((w) => w.isDefault);
    const primaryBalance = Number(primaryWallet?.balance ?? 0);
    const estimatedOpex = primaryBalance * 0.3; // Stub — would use actual calculation
    const idleCash = Math.max(0, primaryBalance - estimatedOpex * 3);

    return {
      totalBalance: gbp + usdc,
      gbpBalance: gbp,
      usdcBalance: usdc,
      idleCash,
      allocatedToRules: wallets.filter((w) => w.type === 'SUB_WALLET').reduce((s, w) => s + Number(w.balance), 0),
    };
  }

  // ─── Private ─────────────────────────────────────────────────────────────────

  private parseAnalysisResponse(content: string): TreasuryAnalysis {
    const jsonMatch = content.match(/```json\n?([\s\S]+?)\n?```/) ?? content.match(/\{[\s\S]+\}/);
    if (!jsonMatch) {
      return {
        currentAllocation: { summary: 'Analysis unavailable', efficiency: 0, idleCashEstimate: 0 },
        recommendations: [],
        optimalAllocation: { gbpOperating: 0, usdcTreasury: 0, vatReserve: 0, pensionPot: 0, emergencyFund: 0 },
      };
    }
    try {
      return JSON.parse(jsonMatch[1] ?? jsonMatch[0]) as TreasuryAnalysis;
    } catch {
      return {
        currentAllocation: { summary: 'Parse error — retry later', efficiency: 0, idleCashEstimate: 0 },
        recommendations: [],
        optimalAllocation: { gbpOperating: 0, usdcTreasury: 0, vatReserve: 0, pensionPot: 0, emergencyFund: 0 },
      };
    }
  }
}
