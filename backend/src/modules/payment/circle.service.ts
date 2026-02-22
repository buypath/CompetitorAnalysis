// MIT Licence — AI CFO Wallet — Buypath Ltd
// Circle service — USDC on/off ramp via Circle API

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { PaymentFailedException } from '../../common/exceptions/business.exception';
import type { CircleTransferRequest, CircleTransferResponse } from './payment.types';

@Injectable()
export class CircleService {
  private readonly logger = new Logger(CircleService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly walletSetId: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = this.config.get<string>('CIRCLE_BASE_URL', 'https://api-sandbox.circle.com/v1');
    this.apiKey = this.config.get<string>('CIRCLE_API_KEY', '');
    this.walletSetId = this.config.get<string>('CIRCLE_WALLET_SET_ID', '');
  }

  /**
   * Transfers USDC from a Circle wallet to an external blockchain address.
   * Supports Base L2 (primary), Ethereum, and Polygon.
   */
  async transferUsdc(
    sourceWalletId: string,
    destinationAddress: string,
    amountUsdc: number,
    chain: 'BASE' | 'ETH' | 'MATIC' = 'BASE',
    idempotencyKey?: string,
  ): Promise<CircleTransferResponse> {
    const payload: CircleTransferRequest = {
      source: { type: 'wallet', id: sourceWalletId },
      destination: { type: 'blockchain', address: destinationAddress, chain },
      amount: { amount: amountUsdc.toFixed(6), currency: 'USD' },
      idempotencyKey: idempotencyKey ?? uuidv4(),
    };

    try {
      const response = await this.makeRequest<{ data: CircleTransferResponse }>(
        'POST',
        '/transfers',
        payload,
      );

      this.logger.log(`USDC transfer initiated: ${response.data.id} — ${amountUsdc} USDC to ${destinationAddress}`);
      return response.data;
    } catch (error) {
      throw new PaymentFailedException((error as Error).message, 'Circle');
    }
  }

  /**
   * Creates a USDC on-ramp: fiat deposit → USDC mint.
   * Generates a Circle-hosted payment page link for bank transfer or card.
   */
  async createOnRamp(
    businessId: string,
    amountUsdc: number,
    redirectUrl: string,
    idempotencyKey?: string,
  ): Promise<{ paymentId: string; redirectUrl: string }> {
    const payload = {
      amount: { amount: amountUsdc.toFixed(2), currency: 'USD' },
      settlementCurrency: 'USD',
      redirectUrl,
      idempotencyKey: idempotencyKey ?? uuidv4(),
      metadata: { businessId },
    };

    const response = await this.makeRequest<{ data: { id: string; approveUrl: string } }>(
      'POST',
      '/paymentIntents',
      payload,
    );

    return { paymentId: response.data.id, redirectUrl: response.data.approveUrl };
  }

  /**
   * Redeems USDC back to fiat (off-ramp).
   * USDC → bank wire or ACH.
   */
  async redeemUsdc(
    walletId: string,
    bankAccountId: string,
    amountUsdc: number,
    idempotencyKey?: string,
  ): Promise<{ payoutId: string; status: string }> {
    const payload = {
      source: { type: 'wallet', id: walletId },
      destination: { type: 'wire', id: bankAccountId },
      amount: { amount: amountUsdc.toFixed(2), currency: 'USD' },
      idempotencyKey: idempotencyKey ?? uuidv4(),
    };

    const response = await this.makeRequest<{ data: { id: string; status: string } }>(
      'POST',
      '/payouts',
      payload,
    );

    this.logger.log(`USDC redemption initiated: ${response.data.id}`);
    return { payoutId: response.data.id, status: response.data.status };
  }

  /**
   * Creates a Circle developer-controlled wallet for a business.
   */
  async createWallet(businessId: string): Promise<{ walletId: string; address: string }> {
    const payload = {
      idempotencyKey: uuidv4(),
      walletSetId: this.walletSetId,
      count: 1,
      metadata: [{ name: businessId }],
      blockchains: ['BASE'],
    };

    const response = await this.makeRequest<{
      data: { wallets: Array<{ id: string; address: string }> };
    }>('POST', '/developer/wallets', payload);

    const wallet = response.data.wallets[0];
    return { walletId: wallet.id, address: wallet.address };
  }

  /**
   * Gets the USDC balance for a Circle wallet.
   */
  async getWalletBalance(walletId: string): Promise<number> {
    const response = await this.makeRequest<{
      data: { balances: Array<{ amount: string; currency: string }> };
    }>('GET', `/wallets/${walletId}`);

    const usdcBalance = response.data.balances.find((b) => b.currency === 'USD');
    return parseFloat(usdcBalance?.amount ?? '0');
  }

  // ─── Private ─────────────────────────────────────────────────────────────────

  private async makeRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
    if (!this.apiKey) {
      this.logger.warn('Circle API key not configured — returning stub response');
      return {
        data: {
          id: `stub-${uuidv4()}`,
          status: 'pending',
          wallets: [{ id: `stub-wallet-${uuidv4()}`, address: '0x0000000000000000000000000000000000000000' }],
          balances: [{ amount: '0.000000', currency: 'USD' }],
          approveUrl: 'https://sandbox.circle.com/pay/stub',
        },
      } as T;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Circle API error ${response.status}: ${errorText}`);
    }

    return response.json() as Promise<T>;
  }
}
