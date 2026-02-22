// MIT Licence — AI CFO Wallet — Buypath Ltd
// Smart Account module — ERC-4337 account abstraction on Base L2

import { Module } from '@nestjs/common';
import { SmartAccountService } from './smart-account.service';
import { SmartAccountController } from './smart-account.controller';
import { PaymasterService } from './paymaster.service';
import { SubWalletService } from './sub-wallet.service';

@Module({
  controllers: [SmartAccountController],
  providers: [SmartAccountService, PaymasterService, SubWalletService],
  exports: [SmartAccountService, SubWalletService],
})
export class SmartAccountModule {}
