// MIT Licence — AI CFO Wallet — Buypath Ltd
// Transaction categoriser — AI-powered categorisation for accounting exports

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../../common/prisma/prisma.service';

// Standard accounting categories (mapped to Xero/QuickBooks chart of accounts)
export const TRANSACTION_CATEGORIES = {
  // Revenue
  SALES_REVENUE: { code: '200', name: 'Sales Revenue', type: 'REVENUE' },
  OTHER_INCOME: { code: '260', name: 'Other Income', type: 'REVENUE' },

  // Expenses
  ADVERTISING: { code: '400', name: 'Advertising & Marketing', type: 'EXPENSE' },
  BANK_FEES: { code: '404', name: 'Bank Fees & Charges', type: 'EXPENSE' },
  CONTRACTORS: { code: '407', name: 'Contractors & Freelancers', type: 'EXPENSE' },
  PAYROLL: { code: '477', name: 'Wages & Salaries', type: 'EXPENSE' },
  RENT_OFFICE: { code: '469', name: 'Rent & Office Costs', type: 'EXPENSE' },
  SAAS_SUBSCRIPTIONS: { code: '415', name: 'Software & SaaS Subscriptions', type: 'EXPENSE' },
  PROFESSIONAL_FEES: { code: '463', name: 'Professional Fees', type: 'EXPENSE' },
  TRAVEL: { code: '493', name: 'Travel & Accommodation', type: 'EXPENSE' },
  EQUIPMENT: { code: '720', name: 'Equipment & Hardware', type: 'EXPENSE' },
  TRANSFERS: { code: '850', name: 'Internal Transfers', type: 'TRANSFER' },

  // Tax
  VAT_PAYABLE: { code: '820', name: 'VAT Payable', type: 'LIABILITY' },
  CORP_TAX: { code: '830', name: 'Corporation Tax Payable', type: 'LIABILITY' },

  UNCATEGORISED: { code: '999', name: 'Uncategorised', type: 'EXPENSE' },
} as const;

export type CategoryCode = keyof typeof TRANSACTION_CATEGORIES;

const CATEGORISER_PROMPT = `You are an expert UK bookkeeper. Categorise each transaction description.
Return ONLY valid JSON: { "categories": [ { "id": "tx_id", "category": "CATEGORY_CODE" } ] }

Available categories:
SALES_REVENUE, OTHER_INCOME, ADVERTISING, BANK_FEES, CONTRACTORS, PAYROLL,
RENT_OFFICE, SAAS_SUBSCRIPTIONS, PROFESSIONAL_FEES, TRAVEL, EQUIPMENT, TRANSFERS,
VAT_PAYABLE, CORP_TAX, UNCATEGORISED

Rules:
- Use SALES_REVENUE for customer payments and subscriptions
- Use CONTRACTORS for payments to freelancers and agencies
- Use SAAS_SUBSCRIPTIONS for monthly tool/software payments
- Use TRANSFERS for wallet-to-wallet movements
- Use BANK_FEES for stablecoin gas fees and FX charges`;

@Injectable()
export class TransactionCategorizerService {
  private readonly logger = new Logger(TransactionCategorizerService.name);
  private readonly anthropic: Anthropic;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.anthropic = new Anthropic({
      apiKey: this.config.get<string>('ANTHROPIC_API_KEY', ''),
    });
  }

  /**
   * Categorises a batch of uncategorised transactions using Claude.
   * Processes in batches of 50 to stay within token limits.
   */
  async categoriseTransactions(businessId: string, fromDate?: Date): Promise<number> {
    this.logger.log(`Categorising transactions for business ${businessId}`);

    const uncategorised = await this.prisma.transaction.findMany({
      where: {
        businessId,
        category: null,
        status: 'COMPLETED',
        ...(fromDate ? { createdAt: { gte: fromDate } } : {}),
      },
      take: 200,
    });

    if (uncategorised.length === 0) return 0;

    let categorised = 0;
    const batchSize = 50;

    for (let i = 0; i < uncategorised.length; i += batchSize) {
      const batch = uncategorised.slice(i, i + batchSize);
      try {
        const categories = await this.categoriseBatch(batch);

        // Update categories in bulk
        await Promise.all(
          categories.map(({ id, category }) =>
            this.prisma.transaction.update({
              where: { id },
              data: { category },
            }),
          ),
        );

        categorised += categories.length;
      } catch (error) {
        this.logger.error(`Batch categorisation failed: ${(error as Error).message}`);
      }
    }

    this.logger.log(`Categorised ${categorised} transactions for business ${businessId}`);
    return categorised;
  }

  /**
   * Applies rule-based categorisation (fast, no AI cost) for common patterns.
   * Call this before AI categorisation to reduce token usage.
   */
  applyRuleBasedCategories(description: string): CategoryCode | null {
    const desc = description.toLowerCase();

    if (desc.includes('stripe') || desc.includes('customer payment')) return 'SALES_REVENUE';
    if (desc.includes('payroll') || desc.includes('salary') || desc.includes('wages')) return 'PAYROLL';
    if (desc.includes('contractor') || desc.includes('freelance')) return 'CONTRACTORS';
    if (desc.includes('aws') || desc.includes('google cloud') || desc.includes('github') ||
        desc.includes('notion') || desc.includes('slack') || desc.includes('figma')) return 'SAAS_SUBSCRIPTIONS';
    if (desc.includes('vat payment') || desc.includes('hmrc vat')) return 'VAT_PAYABLE';
    if (desc.includes('corporation tax') || desc.includes('ct61')) return 'CORP_TAX';
    if (desc.includes('bank fee') || desc.includes('transaction fee') || desc.includes('gas fee')) return 'BANK_FEES';
    if (desc.includes('transfer') || desc.includes('internal')) return 'TRANSFERS';

    return null;
  }

  // ─── Private ─────────────────────────────────────────────────────────────────

  private async categoriseBatch(
    transactions: Array<{ id: string; description: string | null; amount: unknown; type: string }>,
  ): Promise<Array<{ id: string; category: string }>> {
    const userMessage = `Categorise these transactions:\n${JSON.stringify(
      transactions.map((t) => ({
        id: t.id,
        description: t.description ?? 'No description',
        amount: Number(t.amount),
        type: t.type,
      })),
      null,
      2,
    )}`;

    const message = await this.anthropic.messages.create({
      model: this.config.get<string>('ANTHROPIC_MODEL', 'claude-opus-4-6'),
      max_tokens: 1024,
      system: CATEGORISER_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '{}';
    const jsonMatch = responseText.match(/\{[\s\S]+\}/);
    if (!jsonMatch) return [];

    const result = JSON.parse(jsonMatch[0]) as { categories: Array<{ id: string; category: string }> };
    return result.categories ?? [];
  }
}
