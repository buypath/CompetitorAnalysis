// MIT Licence — AI CFO Wallet — Buypath Ltd
// Tax estimator service — UK VAT, Corporation Tax, and dividend tax estimates

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AiProviderService } from './ai-provider.service';

export interface TaxEstimate {
  period: { from: string; to: string };
  vat: {
    outputTax: number;        // VAT collected from customers
    inputTax: number;         // VAT paid to suppliers (reclaimable)
    liability: number;        // Net liability
    nextReturnDue: string;
  };
  corporationTax: {
    estimatedProfit: number;
    rate: number;             // 25% main rate, 19% small profits rate
    liability: number;
    yearEndDate: string;
  };
  dividendTax?: {
    dividend: number;
    basicRate: number;        // 8.75%
    higherRate: number;       // 33.75%
    personalAllowance: number;// £1,000 dividend allowance
    estimatedLiability: number;
  };
  totalLiability: number;
  recommendedReserve: number;
  nextActions: Array<{ description: string; dueDate: string; amount: number }>;
}

// UK tax constants (2024/25)
const UK_VAT_RATE = 0.20;
const UK_CORP_TAX_MAIN_RATE = 0.25;
const UK_CORP_TAX_SMALL_RATE = 0.19;
const UK_SMALL_PROFITS_THRESHOLD = 50000;
const UK_DIVIDEND_ALLOWANCE = 1000;
const UK_DIVIDEND_BASIC_RATE = 0.0875;

@Injectable()
export class TaxEstimatorService {
  private readonly logger = new Logger(TaxEstimatorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiProviderService,
  ) {}

  /**
   * Estimates UK tax liabilities based on categorised transaction data.
   * Covers VAT, Corporation Tax, and (optionally) personal dividend tax.
   */
  async estimateTaxLiabilities(businessId: string): Promise<TaxEstimate> {
    this.logger.log(`Estimating tax liabilities for business ${businessId}`);

    const quarterStart = this.getQuarterStart();
    const quarterEnd = new Date();

    const transactions = await this.prisma.transaction.findMany({
      where: {
        businessId,
        status: 'COMPLETED',
        createdAt: { gte: quarterStart, lte: quarterEnd },
      },
    });

    // Categorise transactions by type
    const revenue = transactions
      .filter((t) => t.type === 'DEPOSIT')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const expenses = transactions
      .filter((t) => ['WITHDRAWAL', 'PAYMENT'].includes(t.type))
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const estimatedProfit = revenue - expenses;

    // VAT calculation
    const outputTax = revenue * UK_VAT_RATE;
    const inputTax = expenses * (UK_VAT_RATE / (1 + UK_VAT_RATE)); // Assume VAT-inclusive expenses
    const vatLiability = Math.max(0, outputTax - inputTax);

    // Corporation tax
    const corpTaxRate = estimatedProfit * 4 < UK_SMALL_PROFITS_THRESHOLD
      ? UK_CORP_TAX_SMALL_RATE
      : UK_CORP_TAX_MAIN_RATE;
    const corpTaxLiability = Math.max(0, estimatedProfit * corpTaxRate);

    const totalLiability = vatLiability + corpTaxLiability;

    const nextVatReturn = this.getNextVatReturn();
    const business = await this.prisma.business.findUnique({ where: { id: businessId } });

    return {
      period: { from: quarterStart.toISOString(), to: quarterEnd.toISOString() },
      vat: {
        outputTax: Math.round(outputTax * 100) / 100,
        inputTax: Math.round(inputTax * 100) / 100,
        liability: Math.round(vatLiability * 100) / 100,
        nextReturnDue: nextVatReturn.toISOString(),
      },
      corporationTax: {
        estimatedProfit: Math.round(estimatedProfit * 100) / 100,
        rate: corpTaxRate,
        liability: Math.round(corpTaxLiability * 100) / 100,
        yearEndDate: this.getYearEnd(business?.createdAt).toISOString(),
      },
      totalLiability: Math.round(totalLiability * 100) / 100,
      recommendedReserve: Math.round(totalLiability * 1.1 * 100) / 100, // 10% buffer
      nextActions: [
        {
          description: 'VAT return submission and payment',
          dueDate: nextVatReturn.toISOString(),
          amount: Math.round(vatLiability * 100) / 100,
        },
        {
          description: 'Corporation tax payment on account',
          dueDate: this.getCorpTaxDue().toISOString(),
          amount: Math.round(corpTaxLiability * 100) / 100,
        },
      ],
    };
  }

  // ─── UK tax date helpers ─────────────────────────────────────────────────────

  private getQuarterStart(): Date {
    const now = new Date();
    const month = now.getMonth();
    const quarterMonth = month - (month % 3);
    return new Date(now.getFullYear(), quarterMonth, 1);
  }

  private getNextVatReturn(): Date {
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    date.setDate(7); // 7th of following month
    return date;
  }

  private getYearEnd(registrationDate?: Date): Date {
    const date = registrationDate ? new Date(registrationDate) : new Date();
    date.setFullYear(date.getFullYear() + 1);
    date.setDate(date.getDate() - 1);
    return date;
  }

  private getCorpTaxDue(): Date {
    const date = new Date();
    date.setMonth(date.getMonth() + 9); // 9 months + 1 day after year end
    return date;
  }
}
