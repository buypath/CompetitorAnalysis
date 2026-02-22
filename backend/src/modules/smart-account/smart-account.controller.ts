// MIT Licence — AI CFO Wallet — Buypath Ltd
// Smart Account controller — REST endpoints for ERC-4337 smart accounts

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SmartAccountService } from './smart-account.service';
import { SubWalletService } from './sub-wallet.service';

@ApiTags('smart-accounts')
@ApiBearerAuth('JWT')
@Controller({ path: 'smart-accounts', version: '1' })
export class SmartAccountController {
  constructor(
    private readonly smartAccountService: SmartAccountService,
    private readonly subWalletService: SubWalletService,
  ) {}

  @Post('create')
  @ApiOperation({ summary: 'Create a new ERC-4337 smart account for the business' })
  @ApiResponse({ status: 201, description: 'Smart account created (counterfactual address returned)' })
  async createSmartAccount(
    @Body() body: { businessId: string; ownerAddress: string; label?: string },
  ) {
    return this.smartAccountService.createSmartAccount(body.businessId, {
      ownerAddress: body.ownerAddress,
      label: body.label,
    });
  }

  @Get(':walletId')
  @ApiOperation({ summary: 'Get smart account info for a wallet' })
  async getSmartAccountInfo(@Param('walletId') walletId: string) {
    return this.smartAccountService.getSmartAccountInfo(walletId);
  }

  @Post('simulate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Simulate a transaction (dry run) before execution' })
  @ApiResponse({ status: 200, description: 'Simulation result with estimated gas cost' })
  async simulateTransaction(
    @Body() body: {
      fromAddress: string;
      toAddress: string;
      valueWei?: string;
      callData?: string;
    },
  ) {
    return this.smartAccountService.simulateTransaction(body);
  }

  @Post(':walletId/execute')
  @ApiOperation({ summary: 'Execute a user operation via the ERC-4337 bundler' })
  async executeUserOperation(
    @Param('walletId') walletId: string,
    @Body() body: { businessId: string; callData: string; value?: string },
  ) {
    return this.smartAccountService.executeUserOperation(
      body.businessId,
      walletId,
      body.callData,
      body.value,
    );
  }

  @Patch(':walletId/spending-limits')
  @ApiOperation({ summary: 'Update per-role spending limits on a smart account' })
  async updateSpendingLimits(
    @Param('walletId') walletId: string,
    @Body() body: { limits: Array<{ role: string; dailyLimit: number; perTransactionLimit: number; currency: string }> },
  ) {
    await this.smartAccountService.updateSpendingLimits(walletId, body.limits as never);
    return { success: true };
  }

  @Patch(':walletId/multi-sig')
  @ApiOperation({ summary: 'Configure multi-signature requirements for large payments' })
  async configureMultiSig(
    @Param('walletId') walletId: string,
    @Body() body: {
      signaturesRequired: number;
      signaturesTotal: number;
      threshold: number;
      signers: string[];
    },
  ) {
    await this.smartAccountService.configureMultiSig(walletId, body);
    return { success: true };
  }

  @Post(':walletId/sub-wallets')
  @ApiOperation({ summary: 'Create a deterministic sub-wallet (ring-fenced account)' })
  @ApiResponse({ status: 201, description: 'Sub-wallet created with deterministic address' })
  async createSubWallet(
    @Param('walletId') walletId: string,
    @Body() body: {
      businessId: string;
      label: string;
      currency: string;
      purpose: string;
    },
  ) {
    return this.subWalletService.createSubWallet({
      businessId: body.businessId,
      parentWalletId: walletId,
      label: body.label,
      currency: body.currency as never,
      purpose: body.purpose as never,
    });
  }

  @Get(':walletId/sub-wallets')
  @ApiOperation({ summary: 'List all sub-wallets for a smart account' })
  async listSubWallets(@Param('walletId') walletId: string) {
    return this.subWalletService.listSubWallets(walletId);
  }
}
