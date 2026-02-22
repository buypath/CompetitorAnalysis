// MIT Licence — AI CFO Wallet — Buypath Ltd
// AI CFO controller — REST endpoints for forecasts, tax, and treasury intelligence

import { Controller, Get, Post, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { CashflowForecastService } from './cashflow-forecast.service';
import { TaxEstimatorService } from './tax-estimator.service';
import { TreasuryAdvisorService } from './treasury-advisor.service';
import { AnomalyDetectorService } from './anomaly-detector.service';

@ApiTags('ai-cfo')
@ApiBearerAuth('JWT')
@Controller({ path: 'ai-cfo', version: '1' })
export class AiCfoController {
  constructor(
    private readonly forecastService: CashflowForecastService,
    private readonly taxService: TaxEstimatorService,
    private readonly treasuryService: TreasuryAdvisorService,
    private readonly anomalyService: AnomalyDetectorService,
  ) {}

  @Get('forecast/cashflow')
  @ApiOperation({ summary: 'Get 90-day cashflow forecast (generates fresh if none cached)' })
  @ApiQuery({ name: 'businessId', required: true })
  @ApiQuery({ name: 'refresh', required: false, type: Boolean, description: 'Force fresh generation' })
  async getCashflowForecast(
    @Query('businessId') businessId: string,
    @Query('refresh') refresh = false,
  ) {
    if (!refresh) {
      const cached = await this.forecastService.getLatestForecast(businessId);
      if (cached) return { forecast: cached, fromCache: true };
    }

    const forecast = await this.forecastService.generateForecast(businessId);
    return { forecast, fromCache: false };
  }

  @Get('tax/estimate')
  @ApiOperation({ summary: 'Get current quarter tax liability estimates (VAT, Corp Tax)' })
  @ApiQuery({ name: 'businessId', required: true })
  async getTaxEstimate(@Query('businessId') businessId: string) {
    return this.taxService.estimateTaxLiabilities(businessId);
  }

  @Get('treasury/analysis')
  @ApiOperation({ summary: 'Get AI-powered treasury allocation analysis and recommendations' })
  @ApiQuery({ name: 'businessId', required: true })
  async getTreasuryAnalysis(@Query('businessId') businessId: string) {
    return this.treasuryService.analyseAllocation(businessId);
  }

  @Get('treasury/summary')
  @ApiOperation({ summary: 'Get quick allocation summary for dashboard (no AI, fast)' })
  @ApiQuery({ name: 'businessId', required: true })
  async getAllocationSummary(@Query('businessId') businessId: string) {
    return this.treasuryService.getQuickAllocationSummary(businessId);
  }

  @Get('anomalies')
  @ApiOperation({ summary: 'Get anomaly detection results for the last 24 hours' })
  @ApiQuery({ name: 'businessId', required: true })
  async getAnomalies(@Query('businessId') businessId: string) {
    const anomalies = await this.anomalyService.detectAnomalies(businessId);
    return { anomalies, count: anomalies.length, scannedAt: new Date().toISOString() };
  }

  @Post('forecast/cashflow/refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trigger immediate cashflow forecast regeneration' })
  async refreshForecast(@Query('businessId') businessId: string) {
    const forecast = await this.forecastService.generateForecast(businessId);
    return { forecast, generatedAt: new Date().toISOString() };
  }
}
