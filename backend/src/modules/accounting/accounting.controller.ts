// MIT Licence — AI CFO Wallet — Buypath Ltd
// Accounting controller — CSV export and auto-categorisation endpoints

import {
  Controller, Get, Post, Query, Res, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth, ApiProduces } from '@nestjs/swagger';
import { Response } from 'express';
import { TransactionCategorizerService } from './transaction-categorizer.service';
import { XeroCsvExportService } from './xero-csv-export.service';
import { QuickbooksCsvExportService } from './quickbooks-csv-export.service';

@ApiTags('accounting')
@ApiBearerAuth('JWT')
@Controller({ path: 'accounting', version: '1' })
export class AccountingController {
  constructor(
    private readonly categorizer: TransactionCategorizerService,
    private readonly xeroExport: XeroCsvExportService,
    private readonly qbExport: QuickbooksCsvExportService,
  ) {}

  @Post('categorise')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'AI-categorise all uncategorised transactions for a business' })
  @ApiQuery({ name: 'businessId', required: true })
  async categoriseTransactions(
    @Query('businessId') businessId: string,
    @Query('fromDate') fromDate?: string,
  ) {
    const count = await this.categorizer.categoriseTransactions(
      businessId,
      fromDate ? new Date(fromDate) : undefined,
    );
    return { categorised: count, message: `${count} transactions categorised` };
  }

  @Get('export/xero')
  @ApiProduces('text/csv')
  @ApiOperation({ summary: 'Export transactions as Xero-compatible bank statement CSV' })
  @ApiQuery({ name: 'businessId', required: true })
  @ApiQuery({ name: 'from', required: true, description: 'ISO date string (start of period)' })
  @ApiQuery({ name: 'to', required: true, description: 'ISO date string (end of period)' })
  @ApiQuery({ name: 'walletId', required: false })
  async exportXero(
    @Query('businessId') businessId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('walletId') walletId: string | undefined,
    @Res() res: Response,
  ) {
    const csv = await this.xeroExport.generateBankStatementCsv({
      businessId,
      fromDate: new Date(from),
      toDate: new Date(to),
      walletId,
    });

    const filename = `xero-export-${new Date(from).toISOString().slice(0, 10)}-to-${new Date(to).toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }

  @Get('export/xero/journal')
  @ApiProduces('text/csv')
  @ApiOperation({ summary: 'Export transactions as Xero journal import CSV' })
  @ApiQuery({ name: 'businessId', required: true })
  @ApiQuery({ name: 'from', required: true })
  @ApiQuery({ name: 'to', required: true })
  async exportXeroJournal(
    @Query('businessId') businessId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Res() res: Response,
  ) {
    const csv = await this.xeroExport.generateJournalCsv({
      businessId,
      fromDate: new Date(from),
      toDate: new Date(to),
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="xero-journal-${new Date(from).toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  }

  @Get('export/quickbooks')
  @ApiProduces('text/csv')
  @ApiOperation({ summary: 'Export transactions as QuickBooks-compatible CSV' })
  @ApiQuery({ name: 'businessId', required: true })
  @ApiQuery({ name: 'from', required: true })
  @ApiQuery({ name: 'to', required: true })
  async exportQuickBooks(
    @Query('businessId') businessId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Res() res: Response,
  ) {
    const csv = await this.qbExport.generateTransactionCsv({
      businessId,
      fromDate: new Date(from),
      toDate: new Date(to),
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="quickbooks-export-${new Date(from).toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  }
}
