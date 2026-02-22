// MIT Licence — AI CFO Wallet — Buypath Ltd
// Sub-wallet service — creates deterministic sub-wallets (ring-fenced accounts)

import { Injectable, Logger } from '@nestjs/common';
import { ethers } from 'ethers';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Currency, WalletType } from '@prisma/client';

export interface CreateSubWalletDto {
  businessId: string;
  parentWalletId: string;
  label: string;
  currency: Currency;
  purpose: 'vat' | 'pension' | 'payroll' | 'emergency' | 'surplus' | 'custom';
}

@Injectable()
export class SubWalletService {
  private readonly logger = new Logger(SubWalletService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a deterministic sub-wallet address using CREATE2.
   * Sub-wallets are ring-fenced accounts for specific purposes (VAT, pension, etc).
   * Addresses are derived from parent wallet + purpose + salt.
   */
  async createSubWallet(dto: CreateSubWalletDto): Promise<{ id: string; address: string }> {
    const parent = await this.prisma.wallet.findUnique({
      where: { id: dto.parentWalletId },
    });

    if (!parent?.smartAccountAddress) {
      throw new Error('Parent wallet must have a smart account address');
    }

    // Deterministic address: hash(parent + purpose + businessId)
    const salt = ethers.keccak256(
      ethers.solidityPacked(
        ['address', 'string', 'string'],
        [parent.smartAccountAddress, dto.purpose, dto.businessId],
      ),
    );

    const subAddress = ethers.getAddress(`0x${salt.slice(26)}`);

    const subWallet = await this.prisma.wallet.create({
      data: {
        businessId: dto.businessId,
        type: WalletType.SUB_WALLET,
        currency: dto.currency,
        balance: 0,
        smartAccountAddress: subAddress,
        parentWalletId: dto.parentWalletId,
        label: dto.label,
        isDefault: false,
        metadata: {
          purpose: dto.purpose,
          derivedFrom: parent.smartAccountAddress,
          salt,
        },
      },
    });

    this.logger.log(`Created sub-wallet '${dto.label}' at ${subAddress}`);
    return { id: subWallet.id, address: subAddress };
  }

  /**
   * Lists all sub-wallets for a given parent wallet.
   */
  async listSubWallets(parentWalletId: string) {
    return this.prisma.wallet.findMany({
      where: { parentWalletId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Returns a pre-computed address for a given sub-wallet purpose,
   * without persisting to the database (useful for rules engine previews).
   */
  computeSubWalletAddress(parentAddress: string, purpose: string, businessId: string): string {
    const salt = ethers.keccak256(
      ethers.solidityPacked(
        ['address', 'string', 'string'],
        [parentAddress, purpose, businessId],
      ),
    );
    return ethers.getAddress(`0x${salt.slice(26)}`);
  }
}
