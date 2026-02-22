// MIT Licence — AI CFO Wallet — Buypath Ltd
// Xero CSV export service — generates Xero-compatible bank statement CSV

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TRANSACTION_CATEGORIES, type CategoryCode } from './transaction-categorizer.service';

export interface XeroExportOptions {
  businessId: string;
  fromDate: Date;
  toDate: Date;
  walletId?: string;
}

@Injectable()
export class XeroCsvExportService {
  private readonly logger = new Logger(XeroCsvExportService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates a Xero-compatible bank statement CSV.
   * Format: Date, Amount, Payee, Description, Reference, Analysis Code
   * Compatible with Xero's "Import a bank statement" feature.
   */
  async generateBankStatementCsv(options: XeroExportOptions): Promise<string> {
    this.logger.log(`Generating Xero CSV export for business ${options.businessId}`);

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

    const rows = [
      '*Date,*Amount,Payee,Description,Reference,Analysis Code',
    ];

    for (const tx of transactions) {
      // Determine debit/credit sign
      const isDebit = ['WITHDRAWAL', 'PAYMENT', 'CONVERSION'].includes(tx.type);
      const amount = isDebit ? -Number(tx.amount) : Number(tx.amount);

      const date = (tx.executedAt ?? tx.createdAt).toLocaleDateString('en-GB'); // DD/MM/YYYY
      const payee = this.derivePayee(tx);
      const description = tx.description ?? tx.type;
      const reference = tx.externalRef ?? tx.id.slice(0, 8).toUpperCase();
      const categoryCode = tx.category
        ? (TRANSACTION_CATEGORIES[tx.category as CategoryCode]?.code ?? '999')
        : '999';

      rows.push(
        [
          date,
          amount.toFixed(2),
          this.escapeCsv(payee),
          this.escapeCsv(description),
          this.escapeCsv(reference),
          categoryCode,
        ].join(','),
      );
    }

    return rows.join('\n');
  }

  /**
   * Generates a Xero Chart of Accounts compatible transaction export.
   * Used for manual journal imports.
   */
  async generateJournalCsv(options: XeroExportOptions): Promise<string> {
    const transactions = await this.prisma.transaction.findMany({
      where: {
        businessId: options.businessId,
        status: 'COMPLETED',
        createdAt: { gte: options.fromDate, lte: options.toDate },
      },
      include: { fromWallet: true, toWallet: true },
      orderBy: { executedAt: 'asc' },
    });

    const rows = [
      '*Narration,*Date,*Description,*Account Code,*Tax Rate,*Amount',
    ];

    for (const tx of transactions) {
      const date = (tx.executedAt ?? tx.createdAt).toLocaleDateString('en-GB');
      const categoryCode = tx.category
        ? (TRANSACTION_CATEGORIES[tx.category as CategoryCode]?.code ?? '999')
        : '999';
      const amount = Number(tx.amount);

      rows.push(
        [
          this.escapeCsv(`${tx.type} — ${tx.currency}`),
          date,
          this.escapeCsv(tx.description ?? tx.type),
          categoryCode,
          '20% (VAT on Expenses)',
          amount.toFixed(2),
        ].join(','),
      );
    }

    return rows.join('\n');
  }

  // ─── Private ─────────────────────────────────────────────────────────────────

  private derivePayee(tx: { fromWallet: { label: string | null } | null; toWallet: { label: string | null } | null; type: string }): string {
    if (tx.type === 'DEPOSIT') return tx.fromWallet?.label ?? 'Unknown sender';
    if (['WITHDRAWAL', 'PAYMENT'].includes(tx.type)) return tx.toWallet?.label ?? 'Unknown recipient';
    return 'Internal transfer';
  }

  private escapeCsv(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}
