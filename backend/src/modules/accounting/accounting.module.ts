// MIT Licence — AI CFO Wallet — Buypath Ltd

import { Module } from '@nestjs/common';
import { AccountingController } from './accounting.controller';
import { TransactionCategorizerService } from './transaction-categorizer.service';
import { XeroCsvExportService } from './xero-csv-export.service';
import { QuickbooksCsvExportService } from './quickbooks-csv-export.service';

@Module({
  controllers: [AccountingController],
  providers: [
    TransactionCategorizerService,
    XeroCsvExportService,
    QuickbooksCsvExportService,
  ],
  exports: [TransactionCategorizerService],
})
export class AccountingModule {}
