// MIT Licence — AI CFO Wallet — Buypath Ltd
// Business service — KYC, subscription management, and business profile

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BusinessNotFoundException } from '../../common/exceptions/business.exception';
import type { Business, KycStatus, SubscriptionTier } from '@prisma/client';

export interface CreateBusinessDto {
  name: string;
  registrationNumber?: string;
  vatNumber?: string;
  country?: string;
  timezone?: string;
  ownerEmail: string;
  ownerFirstName: string;
  ownerLastName: string;
}

@Injectable()
export class BusinessService {
  private readonly logger = new Logger(BusinessService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateBusinessDto): Promise<Business> {
    this.logger.log(`Creating business: ${dto.name}`);

    const business = await this.prisma.business.create({
      data: {
        name: dto.name,
        registrationNumber: dto.registrationNumber,
        vatNumber: dto.vatNumber,
        country: dto.country ?? 'GB',
        timezone: dto.timezone ?? 'Europe/London',
        settings: { defaultCurrency: 'GBP', notifications: { email: true } },
        users: {
          create: {
            email: dto.ownerEmail,
            firstName: dto.ownerFirstName,
            lastName: dto.ownerLastName,
            role: 'OWNER',
            permissions: { all: true },
          },
        },
      },
    });

    return business;
  }

  async findById(id: string): Promise<Business> {
    const business = await this.prisma.business.findUnique({
      where: { id },
      include: { wallets: true, users: true },
    });
    if (!business) throw new BusinessNotFoundException(id);
    return business;
  }

  async updateKycStatus(id: string, status: KycStatus): Promise<void> {
    await this.prisma.business.update({ where: { id }, data: { kycStatus: status } });
    this.logger.log(`Business ${id} KYC status updated to ${status}`);
  }

  async updateSubscriptionTier(id: string, tier: SubscriptionTier): Promise<void> {
    await this.prisma.business.update({ where: { id }, data: { subscriptionTier: tier } });
    this.logger.log(`Business ${id} subscription updated to ${tier}`);
  }
}
