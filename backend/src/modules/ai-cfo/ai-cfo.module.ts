// MIT Licence — AI CFO Wallet — Buypath Ltd

import { Module } from '@nestjs/common';
import { AiCfoController } from './ai-cfo.controller';
import { CashflowForecastService } from './cashflow-forecast.service';
import { TaxEstimatorService } from './tax-estimator.service';
import { TreasuryAdvisorService } from './treasury-advisor.service';
import { AnomalyDetectorService } from './anomaly-detector.service';
import { AiProviderService } from './ai-provider.service';

@Module({
  controllers: [AiCfoController],
  providers: [
    AiProviderService,
    CashflowForecastService,
    TaxEstimatorService,
    TreasuryAdvisorService,
    AnomalyDetectorService,
  ],
  exports: [CashflowForecastService, TreasuryAdvisorService, AnomalyDetectorService],
})
export class AiCfoModule {}
