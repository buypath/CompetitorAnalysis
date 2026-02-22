// MIT Licence — AI CFO Wallet — Buypath Ltd
// QuickBooks CSV export service — generates QuickBooks-compatible transaction CSV

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TRANSACTION_CATEGORIES, type CategoryCode } from './transaction-categorizer.service';
import type { XeroExportOptions } from './xero-csv-export.service';

@Injectable()
export class QuickbooksCsvExportService {
  private readonly logger = new Logger(QuickbooksCsvExportService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates a QuickBooks-compatible bank transactions CSV.
   * Format: Date, Description, Amount, Transaction Type, Memo, Account
   * Compatible with QuickBooks Online "Import transactions from CSV" feature.
   */
  async generateTransactionCsv(options: XeroExportOptions): Promise<string> {
    this.logger.log(`Generating QuickBooks CSV export for business ${options.businessId}`);

    const transactions = await this.prisma.transaction.findMany({
      where: {
        businessId: options.businessId,
        status: 'COMPLETED',
        createdAt: { gte: options.fromDate, lte: options.toDate },
        ...(options.walletId ? {
          OR: [{ fromWalletId: options.walletId }, { toWalletId: options.walletId }],
        } : {}),
      },
      include: { fromWallet: true, toWallet: true },
      orderBy: { executedAt: 'asc' },
    });

    // QuickBooks format: Date, Description, Amount, Transaction Type, Memo, Account
    const rows = ['Date,Description,Amount,Transaction Type,Memo,Account'];

    for (const tx of transactions) {
      const date = (tx.executedAt ?? tx.createdAt).toLocaleDateString('en-US'); // MM/DD/YYYY for QB
      const description = tx.description ?? tx.type;
      const isDebit = ['WITHDRAWAL', 'PAYMENT'].includes(tx.type);
      const amount = isDebit ? -Number(tx.amount) : Number(tx.amount);
      const txType = isDebit ? 'Expense' : 'Income';
      const category = tx.category
        ? (TRANSACTION_CATEGORIES[tx.category as CategoryCode]?.name ?? 'Uncategorised')
        : 'Uncategorised';
      const account = tx.fromWallet?.label ?? 'Business Current Account';

      rows.push(
        [
          date,
          this.escapeCsv(description),
          amount.toFixed(2),
          txType,
          this.escapeCsv(category),
          this.escapeCsv(account),
        ].join(','),
      );
    }

    return rows.join('\n');
  }

  /**
   * Phase 2 stub: Direct QuickBooks API sync (not MVP).
   * Placeholder for future QuickBooks Online OAuth integration.
   */
  async syncToQuickbooks(businessId: string, oauthToken: string): Promise<void> {
    void businessId;
    void oauthToken;
    throw new Error('QuickBooks direct sync is a Phase 2 feature — use CSV export in the interim');
  }

  private escapeCsv(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}
