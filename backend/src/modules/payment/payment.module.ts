// MIT Licence — AI CFO Wallet — Buypath Ltd

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { PaymentController } from './payment.controller';
import { StripeService } from './stripe.service';
import { ModulrService } from './modulr.service';
import { CircleService } from './circle.service';
import { BatchPayoutService } from './batch-payout.service';
import { PaymentOrchestratorService } from './payment-orchestrator.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'payment-processing' }),
  ],
  controllers: [PaymentController],
  providers: [
    StripeService,
    ModulrService,
    CircleService,
    BatchPayoutService,
    PaymentOrchestratorService,
  ],
  exports: [PaymentOrchestratorService, BatchPayoutService],
})
export class PaymentModule {}
