// MIT Licence — AI CFO Wallet — Buypath Ltd

import { Controller, Get, Post, Patch, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BusinessService } from './business.service';
import { PrismaService } from '../../common/prisma/prisma.service';

@ApiTags('business')
@ApiBearerAuth('JWT')
@Controller({ path: 'business', version: '1' })
export class BusinessController {
  constructor(
    private readonly businessService: BusinessService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Register a new business' })
  async create(@Body() body: {
    name: string;
    registrationNumber?: string;
    vatNumber?: string;
    country?: string;
    ownerEmail: string;
    ownerFirstName: string;
    ownerLastName: string;
  }) {
    return this.businessService.create(body);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get business profile' })
  async getById(@Param('id') id: string) {
    return this.businessService.findById(id);
  }

  @Get(':id/wallets')
  @ApiOperation({ summary: 'Get all wallets for a business' })
  async getWallets(@Param('id') id: string) {
    return this.prisma.wallet.findMany({
      where: { businessId: id },
      include: { subWallets: true },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }

  @Get(':id/suppliers')
  @ApiOperation({ summary: 'Get all suppliers for a business' })
  async getSuppliers(@Param('id') id: string) {
    return this.prisma.supplier.findMany({
      where: { businessId: id, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  @Patch(':id/kyc')
  @ApiOperation({ summary: 'Update KYC status (admin only)' })
  async updateKyc(@Param('id') id: string, @Body() body: { status: string }) {
    await this.businessService.updateKycStatus(id, body.status as never);
    return { success: true };
  }

  @Patch(':id/subscription')
  @ApiOperation({ summary: 'Update subscription tier' })
  async updateSubscription(@Param('id') id: string, @Body() body: { tier: string }) {
    await this.businessService.updateSubscriptionTier(id, body.tier as never);
    return { success: true };
  }
}
