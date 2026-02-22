// MIT Licence — AI CFO Wallet — Buypath Ltd
// Type definitions for Payment Orchestration module

export type PaymentRail = 'stripe' | 'modulr' | 'circle' | 'stablecoin';
export type PaymentCurrency = 'GBP' | 'USD' | 'EUR' | 'USDC';
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface CreatePaymentDto {
  businessId: string;
  fromWalletId: string;
  toWalletId?: string;
  recipientAddress?: string;       // For stablecoin payments
  recipientBankDetails?: BankDetails;
  amount: number;
  currency: PaymentCurrency;
  description?: string;
  idempotencyKey: string;
  rail?: PaymentRail;              // Auto-selected if not specified
  scheduledAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface BankDetails {
  accountNumber: string;
  sortCode?: string;               // UK
  routingNumber?: string;          // US ACH
  iban?: string;                   // EU SEPA
  bic?: string;
  accountHolderName: string;
  bankName?: string;
}

export interface PaymentResult {
  id: string;
  status: PaymentStatus;
  externalRef?: string;            // Stripe/Modulr/Circle reference
  txHash?: string;                 // Blockchain tx hash for stablecoin
  estimatedSettlement?: Date;
  error?: string;
}

export interface BatchPayoutItem {
  supplierId?: string;
  recipientName: string;
  amount: number;
  currency: PaymentCurrency;
  paymentMethod: 'faster_payments' | 'ach' | 'sepa' | 'stablecoin';
  recipientAddress?: string;
  bankDetails?: BankDetails;
  description?: string;
  reference?: string;
}

export interface BatchPayoutResult {
  batchId: string;
  totalItems: number;
  succeeded: number;
  failed: number;
  totalAmount: number;
  currency: PaymentCurrency;
  items: Array<BatchPayoutItem & { status: PaymentStatus; error?: string; txId?: string }>;
}

// ─── Stripe types ─────────────────────────────────────────────────────────────
export interface StripeDepositIntent {
  paymentIntentId: string;
  clientSecret: string;
  amount: number;
  currency: string;
  status: string;
}

// ─── Modulr types (UK Faster Payments) ───────────────────────────────────────
export interface ModulrPaymentRequest {
  sourceAccountId: string;
  amount: number;
  currency: 'GBP';
  destination: {
    name: string;
    sortCode: string;
    accountNumber: string;
  };
  reference: string;
  externalReference?: string;
}

export interface ModulrPaymentResponse {
  id: string;
  status: 'PENDING' | 'PROCESSING' | 'EXECUTED' | 'FAILED';
  createdAt: string;
  executedAt?: string;
}

// ─── Circle types (USDC) ──────────────────────────────────────────────────────
export interface CircleTransferRequest {
  source: { type: 'wallet'; id: string };
  destination: { type: 'blockchain'; address: string; chain: string };
  amount: { amount: string; currency: 'USD' };
  idempotencyKey: string;
}

export interface CircleTransferResponse {
  id: string;
  status: 'pending' | 'running' | 'complete' | 'failed';
  transactionHash?: string;
}
