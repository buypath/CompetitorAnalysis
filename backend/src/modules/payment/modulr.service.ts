// MIT Licence — AI CFO Wallet — Buypath Ltd
// Modulr service — UK Faster Payments and bank-to-bank transfers

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentFailedException } from '../../common/exceptions/business.exception';
import type { ModulrPaymentRequest, ModulrPaymentResponse, BankDetails } from './payment.types';

@Injectable()
export class ModulrService {
  private readonly logger = new Logger(ModulrService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly customerId: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = this.config.get<string>('MODULR_BASE_URL', 'https://api-sandbox.modulrfinance.com/api-sandbox');
    this.apiKey = this.config.get<string>('MODULR_API_KEY', '');
    this.apiSecret = this.config.get<string>('MODULR_API_SECRET', '');
    this.customerId = this.config.get<string>('MODULR_CUSTOMER_ID', '');
  }

  /**
   * Sends a GBP payment via UK Faster Payments (Modulr).
   * Typically settles within 2 hours, often near-instantly.
   */
  async sendFasterPayment(
    sourceAccountId: string,
    amount: number,
    recipient: BankDetails,
    reference: string,
    idempotencyKey: string,
  ): Promise<ModulrPaymentResponse> {
    const payload: ModulrPaymentRequest = {
      sourceAccountId,
      amount: Math.round(amount * 100), // Modulr expects pence
      currency: 'GBP',
      destination: {
        name: recipient.accountHolderName,
        sortCode: recipient.sortCode?.replace(/-/g, '') ?? '',
        accountNumber: recipient.accountNumber,
      },
      reference,
      externalReference: idempotencyKey,
    };

    try {
      const response = await this.makeRequest<ModulrPaymentResponse>(
        'POST',
        `/customers/${this.customerId}/payments`,
        payload,
        idempotencyKey,
      );

      this.logger.log(`Faster Payment sent: ${response.id} — status: ${response.status}`);
      return response;
    } catch (error) {
      throw new PaymentFailedException((error as Error).message, 'Modulr');
    }
  }

  /**
   * Creates a virtual account for receiving Faster Payments.
   */
  async createVirtualAccount(businessId: string): Promise<{ accountId: string; sortCode: string; accountNumber: string }> {
    const response = await this.makeRequest<{
      id: string;
      sortCode: string;
      accountNumber: string;
    }>('POST', `/customers/${this.customerId}/accounts`, {
      externalReference: businessId,
      productCode: 'PAYR',
      currency: 'GBP',
    });

    return {
      accountId: response.id,
      sortCode: response.sortCode,
      accountNumber: response.accountNumber,
    };
  }

  /**
   * Retrieves the current status of a payment.
   */
  async getPaymentStatus(paymentId: string): Promise<ModulrPaymentResponse> {
    return this.makeRequest<ModulrPaymentResponse>('GET', `/payments/${paymentId}`);
  }

  /**
   * Handles Modulr webhooks for payment status updates.
   */
  handleWebhook(body: unknown): { paymentId: string; status: string } | null {
    const payload = body as { id?: string; status?: string };
    if (!payload.id || !payload.status) return null;
    return { paymentId: payload.id, status: payload.status };
  }

  // ─── Private ─────────────────────────────────────────────────────────────────

  private async makeRequest<T>(
    method: string,
    path: string,
    body?: unknown,
    idempotencyKey?: string,
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${Buffer.from(`${this.apiKey}:${this.apiSecret}`).toString('base64')}`,
    };

    if (idempotencyKey) {
      headers['X-Idempotency-Key'] = idempotencyKey;
    }

    // Stub response for sandbox — replace with real fetch in production
    if (!this.apiKey || this.apiKey === '') {
      this.logger.warn('Modulr API key not configured — returning stub response');
      return {
        id: `STUB-${Date.now()}`,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
      } as T;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Modulr API error ${response.status}: ${errorText}`);
    }

    return response.json() as Promise<T>;
  }
}
