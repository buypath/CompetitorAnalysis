// MIT Licence — AI CFO Wallet — Buypath Ltd
// Type definitions for the Smart Account module

import { Currency } from '@prisma/client';

export interface CreateSmartAccountDto {
  ownerAddress: string;
  label?: string;
  currency?: Currency;
  multiSigConfig?: MultiSigConfig;
  spendingLimits?: SpendingLimitConfig[];
}

export interface SmartAccountInfo {
  walletId: string;
  smartAccountAddress: string;
  ownerAddress: string;
  chain: 'mainnet' | 'sepolia';
  chainId: number;
  isDeployed: boolean;
}

export interface UserOperationResult {
  success: boolean;
  requiresMultiSig: boolean;
  pendingApprovals: number;
  userOpHash: string | null;
  txHash?: string;
  error?: string;
}

export interface MultiSigConfig {
  signaturesRequired: number;
  signaturesTotal: number;
  threshold: number;        // Amount (in base currency) above which multi-sig is required
  signers: string[];        // Ethereum addresses of signers
}

export interface SpendingLimitConfig {
  role: string;             // UserRole
  dailyLimit: number;
  perTransactionLimit: number;
  currency: Currency;
  whitelist?: string[];     // Allowed recipient addresses
}

export interface SimulateTransactionDto {
  fromAddress: string;
  toAddress: string;
  valueWei?: string;
  callData?: string;
}

export interface SimulationResult {
  success: boolean;
  estimatedGas: string;
  estimatedGasUsd: string;
  isContractCall?: boolean;
  callData?: string;
  error?: string;
}

export interface PaymasterSponsorshipData {
  paymasterAddress: string;
  paymasterData: string;
  preVerificationGas: string;
  verificationGasLimit: string;
  callGasLimit: string;
}

export interface UserOperation {
  sender: string;
  nonce: string;
  initCode: string;
  callData: string;
  callGasLimit: string;
  verificationGasLimit: string;
  preVerificationGas: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
  paymasterAndData: string;
  signature: string;
}
