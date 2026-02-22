// MIT Licence — AI CFO Wallet — Buypath Ltd
// Payment controller — REST endpoints for all payment operations

import {
  Controller, Get, Post, Body, Param, Query,
  HttpCode, HttpStatus, Headers, RawBodyRequest, Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Request } from 'express';
import { PaymentOrchestratorService } from './payment-orchestrator.service';
import { BatchPayoutService } from './batch-payout.service';
import { StripeService } from './stripe.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { BatchPayoutItem } from './payment.types';

@ApiTags('payments')
@ApiBearerAuth('JWT')
@Controller({ path: 'payments', version: '1' })
export class PaymentController {
  constructor(
    private readonly orchestrator: PaymentOrchestratorService,
    private readonly batchPayout: BatchPayoutService,
    private readonly stripe: StripeService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a single payment (auto-routes to optimal rail)' })
  @ApiResponse({ status: 201, description: 'Payment created and dispatched' })
  async createPayment(
    @Body() body: {
      businessId: string;
      fromWalletId: string;
      recipientAddress?: string;
      amount: number;
      currency: string;
      description?: string;
      idempotencyKey: string;
    },
  ) {
    return this.orchestrator.createPayment({ ...body, currency: body.currency as never });
  }

  @Post('batch')
  @ApiOperation({ summary: 'Process a batch of payouts (mixed fiat + stablecoin)' })
  @ApiResponse({ status: 200, description: 'Batch processed — returns per-item results' })
  @HttpCode(HttpStatus.OK)
  async processBatch(
    @Body() body: {
      businessId: string;
      items: BatchPayoutItem[];
      scheduledAt?: string;
      batchRef?: string;
    },
  ) {
    if (body.scheduledAt) {
      const batchId = await this.batchPayout.scheduleBatch(
        body.businessId,
        body.items,
        new Date(body.scheduledAt),
      );
      return { batchId, scheduled: true, scheduledAt: body.scheduledAt };
    }

    return this.batchPayout.processBatch(body.businessId, body.items, body.batchRef);
  }

  @Get()
  @ApiOperation({ summary: 'List transactions for a business' })
  @ApiQuery({ name: 'businessId', required: true })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'from', required: false, description: 'ISO date string' })
  @ApiQuery({ name: 'to', required: false, description: 'ISO date string' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async listTransactions(
    @Query('businessId') businessId: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 25,
  ) {
    const skip = (Number(page) - 1) * Number(limit);

    const [transactions, total] = await this.prisma.$transaction([
      this.prisma.transaction.findMany({
        where: {
          businessId,
          ...(type ? { type: type as never } : {}),
          ...(status ? { status: status as never } : {}),
          ...(from || to ? {
            createdAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          } : {}),
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
        include: { fromWallet: true, toWallet: true },
      }),
      this.prisma.transaction.count({ where: { businessId } }),
    ]);

    return {
      data: transactions,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
    };
  }

  @Get('scheduled')
  @ApiOperation({ summary: 'List upcoming scheduled payments' })
  @ApiQuery({ name: 'businessId', required: true })
  async listScheduledPayments(
    @Query('businessId') businessId: string,
    @Query('limit') limit = 20,
  ) {
    return this.prisma.scheduledPayment.findMany({
      where: { businessId, status: 'PENDING', dueDate: { gte: new Date() } },
      include: { supplier: true, rule: true },
      orderBy: { dueDate: 'asc' },
      take: Number(limit),
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single transaction by ID' })
  async getTransaction(@Param('id') id: string) {
    return this.prisma.transaction.findUnique({
      where: { id },
      include: { fromWallet: true, toWallet: true, scheduledPayment: true },
    });
  }

  @Post('stripe/deposit-intent')
  @ApiOperation({ summary: 'Create a Stripe PaymentIntent for card deposit' })
  async createDepositIntent(
    @Body() body: { businessId: string; amountPence: number; currency: string; idempotencyKey: string },
  ) {
    return this.stripe.createDepositIntent(
      body.businessId,
      body.amountPence,
      body.currency,
      body.idempotencyKey,
    );
  }

  @Post('stripe/webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stripe webhook receiver — verifies signature and processes events' })
  async handleStripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    const rawBody = req.rawBody;
    if (!rawBody) return { received: false };

    const event = await this.stripe.handleWebhook(rawBody, signature);
    if (!event) return { received: false };

    await this.prisma.transaction.updateMany({
      where: { externalRef: event.paymentIntentId },
      data: { status: event.status === 'completed' ? 'COMPLETED' : 'FAILED' },
    });

    return { received: true };
  }
}
